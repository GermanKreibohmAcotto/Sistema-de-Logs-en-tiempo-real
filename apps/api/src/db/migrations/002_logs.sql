CREATE TYPE log_level AS ENUM ('DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL');

-- Particionada por rango de dia sobre `ts`. Las particiones concretas las
-- crea/elimina en runtime src/maintenance/partitions.ts (ver RETENTION_DAYS
-- y PARTITION_LOOKAHEAD_DAYS): retencion pasa a ser un DROP TABLE de la
-- particion vieja en vez de un DELETE masivo.
CREATE TABLE logs (
  id          BIGINT GENERATED ALWAYS AS IDENTITY,
  ts          TIMESTAMPTZ NOT NULL,
  level       log_level   NOT NULL,
  service     TEXT        NOT NULL,
  message     TEXT        NOT NULL,
  metadata    JSONB,
  trace_id    TEXT,
  api_key_id  BIGINT,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (ts, id)
) PARTITION BY RANGE (ts);

-- Un indice creado sobre la tabla particionada se propaga automaticamente
-- (desde PG11) a cada particion existente y a cada particion que se cree
-- despues via `CREATE TABLE ... PARTITION OF logs`, asi que no hace falta
-- recrear indices al rotar particiones.
CREATE INDEX logs_ts_brin_idx ON logs USING BRIN (ts);
CREATE INDEX logs_service_ts_idx ON logs (service, ts DESC);
CREATE INDEX logs_level_ts_idx ON logs (level, ts DESC);
CREATE INDEX logs_message_trgm_idx ON logs USING GIN (message gin_trgm_ops);

-- Red de seguridad: si src/maintenance/partitions.ts no llego a crear la
-- particion del dia (arranque en frio, reloj de un cliente adelantado mas
-- alla del margen de tolerancia, etc.) la fila cae aqui en vez de rechazar
-- el insert. La mayoria de las filas debe seguir cayendo en su particion
-- diaria, donde el pruning por rango realmente ayuda.
CREATE TABLE logs_default PARTITION OF logs DEFAULT;
