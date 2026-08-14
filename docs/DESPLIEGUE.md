# Desplegar en un servidor real

`docker compose up -d --build` alcanza para probarlo, pero para exponerlo más
allá de tu red local hay unos pasos más.

## 1. Configurar `DASHBOARD_TOKEN`

Sin esto, cualquiera que llegue a la API lee todos tus logs y puede crear o
borrar reglas de alerta. No es opcional en un despliegue real:

```bash
openssl rand -hex 32
```

Setealo como `DASHBOARD_TOKEN` en el entorno del servicio `api` (o en tu
`.env` si usás `docker-compose.yml` tal cual). Si arrancás la API en
`NODE_ENV=production` sin esta variable, el arranque tira un warning en el
log — no falla, para no romper un `docker compose up` de prueba, pero avisa.

## 2. TLS

La app no termina TLS — poné un reverse proxy delante (nginx, Caddy, Traefik,
un load balancer del proveedor de cloud) que haga el certificado y
proxyee HTTP y WebSocket (`Upgrade`/`Connection` headers) hacia
`web`/`api`. `apps/web/nginx.conf` ya muestra el proxy interno
`web → api` como referencia de cómo pasar esos headers.

## 3. Contraseña de Postgres

`docker-compose.yml` toma `POSTGRES_PASSWORD` del entorno (default `logs`
solo para que el `docker compose up` de prueba funcione sin config extra).
Seteala a algo real:

```bash
export POSTGRES_PASSWORD=$(openssl rand -hex 24)
```

## 4. Retención y backups

`RETENTION_DAYS` (default 30) dropea particiones diarias enteras — rápido,
pero irreversible. Si necesitás los datos más allá de eso, hacé tu propio
backup (`pg_dump`, snapshots del volumen `postgres-data`, o un export
periódico vía `GET /v1/logs/export`) antes de que la partición se dropee.

## 5. Límites conocidos

- **Un solo proceso WS**: el gateway guarda el estado de las conexiones en
  memoria de un único proceso Node. Escalar horizontalmente requeriría sticky
  sessions o mover el fan-out a Redis Streams con grupos de consumidores — no
  implementado.
- **Sin multi-tenancy**: todas las API keys ven el mismo espacio de logs. Si
  necesitás aislar equipos/clientes, es trabajo pendiente.
- **Sin notificaciones externas de alertas** (email/Slack/etc.) — el punto de
  extensión está listo en `broadcastAlert` (`apps/api/src/realtime/gateway.ts`),
  pero no hay integraciones armadas.
- **`DASHBOARD_TOKEN` es un secreto compartido**, no autenticación de
  usuarios individuales — no hay roles ni auditoría de quién hizo qué.
