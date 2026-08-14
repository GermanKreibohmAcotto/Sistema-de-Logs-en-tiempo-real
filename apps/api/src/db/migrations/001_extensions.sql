-- pg_trgm habilita indices trigram (GIN) usados por la busqueda por subcadena
-- en logs.message. Se elige trigram sobre tsvector porque en logs se busca
-- por fragmentos (IDs, rutas, "timeout") en vez de por lexemas de lenguaje
-- natural.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
