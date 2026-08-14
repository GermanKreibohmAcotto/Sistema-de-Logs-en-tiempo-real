CREATE TABLE alert_rules (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name             TEXT NOT NULL,
  levels           log_level[] NOT NULL,
  service          TEXT,
  threshold        INTEGER NOT NULL,
  window_seconds   INTEGER NOT NULL,
  cooldown_seconds INTEGER NOT NULL DEFAULT 60,
  enabled          BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE alerts (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  rule_id        BIGINT NOT NULL REFERENCES alert_rules (id) ON DELETE CASCADE,
  rule_name      TEXT NOT NULL,
  count          INTEGER NOT NULL,
  threshold      INTEGER NOT NULL,
  window_seconds INTEGER NOT NULL,
  triggered_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX alerts_triggered_at_idx ON alerts (triggered_at DESC);
