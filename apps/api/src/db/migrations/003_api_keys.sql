CREATE TABLE api_keys (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name           TEXT NOT NULL,
  key_prefix     TEXT NOT NULL,
  key_hash       TEXT NOT NULL UNIQUE,
  rate_limit_rpm INTEGER NOT NULL DEFAULT 6000,
  enabled        BOOLEAN NOT NULL DEFAULT true,
  last_used_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at     TIMESTAMPTZ
);

CREATE INDEX api_keys_key_hash_idx ON api_keys (key_hash) WHERE revoked_at IS NULL;

ALTER TABLE logs
  ADD CONSTRAINT logs_api_key_id_fkey FOREIGN KEY (api_key_id) REFERENCES api_keys (id);
