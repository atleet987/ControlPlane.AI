# ControlPlane.AI

Policy-driven middleware that sits between a client application and an LLM API.
Every call is inspected on the way in and on the way out, scored against a
per-use-case risk policy, resolved to a single action, and audited.

> **Status: scaffold.** Module structure, contracts and wiring are in place.
> Business logic is deliberately unimplemented — service methods throw
> `not implemented` and detectors return no signals.

## Running locally

No Docker, no Kafka, no local database server.

```bash
npm install
cp .env.example .env   # fill in REDIS_URL and GEMINI_API_KEY
npm run start:dev
```

- API: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/docs` (non-production only)
- Health: `http://localhost:3000/health` · readiness: `/health/ready`

Only two environment variables are required — see [`.env.example`](.env.example).
Everything else has a working default.

| Variable | Purpose |
| --- | --- |
| `REDIS_URL` | Upstash Redis connection string. Must be `rediss://` (see below). |
| `GEMINI_API_KEY` | Google AI Studio key for the slow-path AI-as-judge detector. |

The service starts even when Redis is unreachable — it logs a warning and runs
without cache. It does not start without a working database.

## Local infrastructure choices

Three deliberate deviations from the production topology. All of them are
confined to configuration and one provider binding; no business logic differs.

### SQLite instead of MySQL — dev only

Local dev runs on SQLite (via [sql.js](https://sql.js.org), a pure-WASM SQLite
build with no native module to compile), stored at `./data/controlplane.sqlite`.

**Production uses MySQL with the same entities and the same schema.** The only
change is connection config:

```bash
DATABASE_DRIVER=mysql
MYSQL_HOST=... MYSQL_USER=... MYSQL_PASSWORD=... MYSQL_DATABASE=...
```

The switch lives in `buildDataSourceOptions()` in [src/app.module.ts](src/app.module.ts).
Entity column types are chosen to be portable across both — `varchar` rather
than a native enum, `simple-json` rather than a native json column — so no
entity has a second definition.

`DATABASE_SYNCHRONIZE` defaults to `true` on SQLite so tables are created on
first boot, and `false` on MySQL, where migrations own the schema.

### Upstash Redis instead of a Redis container

The client reads `REDIS_URL` and enables TLS when the scheme is `rediss://`,
which Upstash requires — ioredis does not infer TLS from the scheme on its own,
so the option is set explicitly. A plaintext `redis://` URL is accepted but logs
a warning, since Upstash will reject it.

See [src/modules/redis/redis.options.ts](src/modules/redis/redis.options.ts).

### Database audit table instead of Kafka — placeholder

The audit module writes each decision event as a row in the local `audit_events`
table instead of producing to a Kafka topic.

**Why:** no free hosted Kafka is available for prototype development (Upstash
withdrew its hosted Kafka offering), and running a broker locally requires
Docker, which this environment cannot run.

**What production would use:** Kafka. It gives durability independent of the
service's own database, and multi-consumer fan-out so alerting, analytics and
compliance archival can each read the stream at their own pace. A table gives
neither — every reader would poll the same rows and compete with the gateway's
own writes.

**Why the swap is cheap:** everything goes through one interface with one
method:

```ts
interface AuditPublisher {
  readonly transport: string;
  publishDecision(event: AuditEvent): Promise<void>;
}
```

`AuditEvent` is the same envelope that would be published to Kafka, and the
`audit_events` columns are a flat one-to-one mapping of it. Moving to Kafka
means providing a `KafkaAuditPublisher` for the `AUDIT_PUBLISHER` token in
[src/modules/audit/audit.module.ts](src/modules/audit/audit.module.ts).
`AuditService` and every caller stay untouched.

Rows are keyed by the producer-supplied `eventId`, so a replayed event is
idempotent — the same way a Kafka consumer would dedupe on the message key.
Content is stored as a SHA-256 hash, never in the clear.

### AI-as-judge is model-agnostic by design

The slow-path verification layer treats the judge model as a **swappable
component, not a dependency**. Nothing in detection, decisioning or audit knows
which vendor answers — they all speak to one interface:

```ts
interface JudgeProvider {
  readonly provider: string;
  readonly model: string;
  isConfigured(): boolean;
  judge(request: JudgeRequest): Promise<JudgeVerdict>;
}

interface JudgeVerdict {
  label: 'verified' | 'contradicted' | 'unverifiable';
  confidence: number; // 0..1
  reasoning?: string;
  model: string;
  latencyMs: number;
}
```

**Currently bound:** Google Gemini via the `@google/generative-ai` SDK, reading
`GEMINI_API_KEY`. The default model is `gemini-3.6-flash` — `gemini-2.5-flash`
is closed to new API keys and its endpoint returns 404 pointing at 3.6. Override
with `GEMINI_MODEL` on a key that still has access to an older model. Gemini is asked for
strict JSON through a response schema, at `temperature: 0` so the same content
does not drift between verdicts.

**Substituting a provider** — OpenAI, Anthropic, Mistral, a self-hosted model —
means adding a class that implements `JudgeProvider` and binding it to the
`JUDGE_PROVIDER` token in
[detection.module.ts](src/modules/detection/detection.module.ts). That module is
the only file in the codebase that names a judge vendor. The verdict contract,
the detector, the scoring, the policy thresholds and the audit records are all
unchanged by the swap.

Two details worth knowing:

- **Confidence is not severity.** The judge reports certainty in its own label;
  the pipeline needs a 0..1 severity score. `contradicted` maps to the
  confidence itself, `unverifiable` to half of it (unproven is not the same as
  proven wrong), and `verified` to `0`. See
  [verdict-severity.ts](src/modules/detection/slow-path/judge/verdict-severity.ts).
- **A verified verdict still emits a signal**, scored `0`. It trips no threshold
  but records in the audit trail that the judge ran and what it concluded.

A malformed reply — non-JSON, an unrecognised label, a non-numeric confidence —
is rejected rather than scored as clean, so a degraded judge cannot quietly
approve content.

### docker-compose is optional

[`docker-compose.prod-parity.yml`](docker-compose.prod-parity.yml) still
describes the full MySQL + Redis + Kafka topology, but **it is not required for
local development** and nothing in the normal workflow uses it. It is there for
production-parity testing later — validating the MySQL datasource and the
eventual Kafka publisher before deploying. It needs a working Docker engine.

## Pipeline

```
client ──▶ gateway ──▶ policy-config      resolve policy for useCaseId
                  ├──▶ detection          fast path (PII, toxicity)
                  │                       slow path (entailment, AI-as-judge)
                  ├──▶ decision-engine    allow | edit | escalate | block
                  ├──▶ upstream LLM       (only if the request passed)
                  └──▶ audit              one event per stage
```

Detection only reports; the decision engine only decides; audit only records.
Keeping those three separate is what makes the policy behaviour testable.

## Modules

| Module | Path | Responsibility |
| --- | --- | --- |
| `policy-config` | `src/modules/policy-config` | Versioned per-use-case risk config, cached in Redis |
| `detection` | `src/modules/detection` | Two-lane detector orchestration under separate latency budgets |
| `decision-engine` | `src/modules/decision-engine` | Maps signals + thresholds to one tiered action |
| `audit` | `src/modules/audit` | Publishes audit envelopes through `AuditPublisher` |
| `gateway` | `src/modules/gateway` | The seam itself — walks the pipeline per request |
| `redis` | `src/modules/redis` | Shared Upstash client |
| `health` | `src/modules/health` | Liveness / readiness probes |

Shared contracts (`InspectionContext`, `DetectionSignal`, the enums) live in
`src/common` so no feature module has to import another just for types.

### Detection lanes

- **Fast path** (`DETECTION_FAST_PATH_TIMEOUT_MS`, default 150ms) — deterministic,
  in-process, runs on every call. Overrunning detectors are dropped, not awaited.
- **Slow path** (`DETECTION_SLOW_PATH_TIMEOUT_MS`, default 25000ms — measured
  judge latency against a live model is 2.5-20s) — entailment
  against grounding passages and LLM-as-judge. Gated by risk tier and policy.
  The judge detector skips itself when no judge credentials are configured.

### Decision tiers

`allow` → pass through · `edit` → redact and pass · `escalate` → hold for human
review · `block` → refuse. The most severe matching rule wins, and unknown or
errored states resolve upward, never downward.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run build` | Compile to `dist/` |
| `npm run start:dev` | Watch-mode dev server |
| `npm run lint` | ESLint (flat config) with `--fix` |
| `npm run format` | Prettier over `src/` and `test/` |
| `npm test` | Unit tests |
| `npm run test:e2e` | Boots the real app on SQLite and exercises audit persistence |
| `npm run docker:up` / `docker:down` | Optional production-parity stack (not needed locally) |

## Next steps

1. Implement `PolicyConfigService.resolve` with a read-through Redis cache.
2. Fill in the fast-path detectors and their timeout race in `FastPathService`.
3. Register decision rules against the `DECISION_RULES` token.
4. Add TypeORM migrations for MySQL (`policy_configs`, `audit_events`).
5. Swap `AUDIT_PUBLISHER` to a `KafkaAuditPublisher` when a broker is available.
