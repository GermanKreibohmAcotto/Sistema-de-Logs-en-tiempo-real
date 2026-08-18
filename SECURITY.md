# Política de seguridad

## Reportar una vulnerabilidad

Si encontrás una vulnerabilidad de seguridad en este proyecto, **no abras un
issue público**. Reportala en privado usando [GitHub Security
Advisories](https://github.com/GermanKreibohmAcotto/Sistema-de-Logs-en-tiempo-real/security/advisories/new)
del repo, o por email a germanka2003@gmail.com.

Incluí, si es posible:

- Descripción del problema y su impacto.
- Pasos para reproducirlo.
- Versión/commit afectado.

Vas a recibir una respuesta en un plazo razonable. Coordinamos la publicación
del fix antes de hacer cualquier detalle público.

## Consideraciones de este proyecto

Este es un sistema autohospedable pensado para correr en tu propia
infraestructura. Dos puntos a tener en cuenta antes de exponerlo fuera de tu
red local:

- **`DASHBOARD_TOKEN` vacío = modo local abierto.** Sin esta variable
  configurada, cualquiera que llegue a la API puede leer todos los logs y
  exportarlos, sin autenticación. El backend avisa esto por log al arrancar en
  `NODE_ENV=production` si falta. Generá un token
  (`openssl rand -hex 32`) antes de desplegar fuera de tu red — ver
  [docs/CONFIGURACION.md](./docs/CONFIGURACION.md).
- **Las API keys de ingesta** (`npm run keys:create`) no tienen expiración
  automática; rotalas si sospechás que una quedó expuesta.

Fuera de eso, aplican las prácticas estándar: no comitees `.env`, usá
contraseñas propias para Postgres/Redis en producción (los defaults del
`docker-compose.yml` son solo para desarrollo local) y mantené las
dependencias al día — Dependabot ya está configurado para eso.
