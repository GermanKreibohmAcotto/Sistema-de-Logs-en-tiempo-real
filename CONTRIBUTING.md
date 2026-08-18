# Contribuir

Gracias por el interés en aportar. Esta guía cubre cómo levantar el entorno,
qué se espera de un PR y cómo está organizado el proyecto para que puedas
orientarte rápido.

## Antes de empezar

Para cambios chicos (typos, bugs claros, docs) andá directo a abrir un PR. Para
algo más grande — una funcionalidad nueva, un cambio de arquitectura — abrí
primero un issue para discutir el approach; ahorra trabajo de los dos lados si
el enfoque necesita ajustes.

## Levantar el entorno

```bash
git clone https://github.com/GermanKreibohmAcotto/Sistema-de-Logs-en-tiempo-real.git
cd Sistema-de-Logs-en-tiempo-real
npm install
cp .env.example .env
docker compose up -d postgres redis   # o tu propia instancia
npm run db:migrate
npm run keys:create -- "mi-servicio" 6000
npm run dev:api     # http://localhost:4000
npm run dev:web     # http://localhost:5173
```

Más detalle en el [README](./README.md#desarrollo-local-sin-docker) y en
[docs/ARQUITECTURA.md](./docs/ARQUITECTURA.md) si querés entender el porqué de
las decisiones antes de tocar algo.

## Antes de abrir el PR

```bash
npm run lint
npm run typecheck
npm test
```

Los tres corren en CI sobre Node 20 y 22; que pasen en local ahorra una vuelta.
`npm run format` reescribe con Prettier si el linter se queja de estilo.

### Sobre los tests

- Los unitarios no requieren infraestructura y corren siempre.
- Los de integración (`apps/api/test/integration/`) necesitan Postgres y Redis
  reales — con `docker compose up -d postgres redis` alcanza. Si no están
  alcanzables, **se saltan solos** (`describe.skipIf(!available)`) en vez de
  romper el run; no te preocupes si los ves en skip en tu máquina.
- Un PR que agrega comportamiento nuevo debería agregar o actualizar un test
  que lo cubra. Un PR que arregla un bug idealmente incluye el test que lo
  hubiera atajado.

## Convención de commits

[Conventional Commits](https://www.conventionalcommits.org/), como el resto
del historial: `fix(web): ...`, `feat(api): ...`, `docs: ...`, `chore: ...`,
`ci: ...`, `refactor: ...`, `test: ...`. El scope entre paréntesis es opcional
pero ayuda a ubicar el cambio (`web`, `api`, `shared`, `client`, `loadgen`,
`docs`, `github`).

## Estructura del monorepo

```
apps/
  api/       Backend Fastify — ingesta, query, export, alertas, WS gateway
  web/       Dashboard React + Vite + Tailwind
  loadgen/   Generador de carga para pruebas
packages/
  shared/    Contratos Zod compartidos entre api y web
  client/    SDK productor sin dependencias
docs/        Documentación de arquitectura, API, configuración y despliegue
```

`docs/API.md` documenta los endpoints HTTP y el protocolo WebSocket si vas a
tocar el contrato entre frontend y backend.

## Código

- TypeScript estricto en todo el repo; el CI corre `typecheck` sobre cada
  workspace.
- ESLint + Prettier ya configurados (`eslint.config.js`, `.prettierrc.json`);
  no hace falta discutir estilo, lo aplica la herramienta.
- Los comentarios explican el _por qué_, no el _qué_ — si el código ya lo dice
  con nombres claros, no hace falta repetirlo en un comentario.

## Reportar bugs o proponer funcionalidades

Usá los templates de issue del repo. Para reportar una vulnerabilidad de
seguridad, no abras un issue público — ver [SECURITY.md](./SECURITY.md).
