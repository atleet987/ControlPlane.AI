-- Runs once on first container start, before the app connects.
CREATE DATABASE IF NOT EXISTS controlplane
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS controlplane_test
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

GRANT ALL PRIVILEGES ON controlplane.* TO 'controlplane'@'%';
GRANT ALL PRIVILEGES ON controlplane_test.* TO 'controlplane'@'%';
FLUSH PRIVILEGES;
