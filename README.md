# doná — Mapa de donaciones e inventario solidario

Aplicación web en **React + TypeScript + Tailwind CSS + shadcn/ui** para conectar donantes con puntos de recepción en CABA y sedes de red en todo el país (`public/mapa.html`), y gestionar inventarios solidarios por sede con fotos en **Google Drive**, sincronización multi-dispositivo en **Google Sheets** y etiquetado automático con **Gemini** (`gemini-3.5-flash-lite`).

---

## Arquitectura general

- **Landing (`#/`)**: portada minimalista con `Quiero donar` (abre el mapa público `mapa.html`) y `Soy una organización` (con fallback CSS automático si el navegador no soporta WebGL2 o prefiere movimiento reducido).
- **Gestión de redes (`#/organizacion`, `#/organizacion/crear`, `#/organizacion/:orgId/unirse`)**:
  - Alta de organizaciones nuevas y adhesión de sedes nuevas desde cualquier celular o computadora.
  - Acceso protegido por **código de 6 caracteres** (`XXX-XXX`), almacenado únicamente como **hash SHA-256 con sal por sede/organización** y verificación en Apps Script con bloqueo temporal por intentos fallidos (5 intentos / 10 minutos).
- **Panel por sede (`#/sede/:sedeId`)**:
  - **Cargar donación**: foto desde cámara o galería → análisis vía **proxy Gemini en Apps Script** → clasificación inteligente local (`inferCategory`) mientras escribís → cola offline de fotos en IndexedDB (`dona-photos`) → subida automática a Google Drive (`w400` en planilla/miniaturas y `w1400` en el visor) y sincronización incremental con Google Sheets.
  - **Inventario, Donantes y Planilla**: entrega rápida, búsqueda, filtros, exportación CSV protegida contra inyección de fórmulas (`=`, `+`, `-`, `@`, `\t`, `\r`) y enlace de invitación `?ep=...`.
- **Panel Sede Central (`#/central/:orgId`)**:
  - Consolidado multi-sede con LWW (`dona:v2`, tombstones de borrado, pull delta `_srv > since`), alertas operativas, búsqueda de stock para redistribución, rotación de códigos (`Nuevo código` / `Rotar código Central`) y baja lógica de sedes (`Dar de baja`).
- **Mapa público (`public/mapa.html`)**:
  - Reúne los puntos curados de CABA y suma en vivo las **sedes activas de la red** (`action=publicSedes`, sin exponer `codeHash`), más escáner IA público conectado al proxy `tag` (rate-limited).
- **PWA instalable**: incluye `manifest.webmanifest`, íconos `icon-192.png` / `icon-512.png`, `favicon.svg` y `sw.js` (con `mapa.html` excluido del fallback SPA).

---

## Desarrollo local y pruebas

> En Windows PowerShell, si los scripts `.ps1` están bloqueados por política de ejecución, usá `npm.cmd` y `npx.cmd`.

```bash
npm.cmd install
npm.cmd run dev
```

### Servidor mock de Google Apps Script (sin cuenta de Google)

Podés probar creación de organizaciones, sedes, códigos de acceso, subida de fotos a Drive, proxy Gemini y sincronización entre dos sesiones en local levantando en otra terminal:

```bash
npm.cmd run mock:sheets
```

Esto inicia `http://127.0.0.1:8787/exec` ejecutando el archivo real `apps-script/Code.gs` dentro de Node. Luego abrí:

`http://localhost:5173/#/organizacion?ep=http%3A%2F%2F127.0.0.1%3A8787%2Fexec`

### Suite de tests y chequeos

```bash
npm.cmd test                      # Vitest (unit, backend Code.gs en VM, sync 2 dispositivos, a11y axe-core)
node scripts/check-contrast.mjs   # Verificación de contraste WCAG AA
npm.cmd run build                 # Compilación de producción en dist/
```

---

## Despliegue de backend propio (Google Sheets + Drive + Gemini)

1. Creá una hoja de cálculo nueva en [Google Sheets](https://sheets.google.com/).
2. Abrí **Extensiones › Apps Script**, borrá el contenido inicial y pegá el código completo de [`apps-script/Code.gs`](./apps-script/Code.gs).
3. En Apps Script, entrá a **Configuración del proyecto (engranaje) › Propiedades de la secuencia de comandos** y agregá:
   - `GEMINI_API_KEY`: tu clave gratuita de [Google AI Studio](https://aistudio.google.com/) (nunca se expone en el navegador).
4. Hacé clic en **Implementar › Nueva implementación › Aplicación web**:
   - **Ejecutar como:** Yo
   - **Quién tiene acceso:** Cualquier usuario
5. Copiá la URL terminada en `/exec`.
6. Pegala en cualquier panel en **Planilla › Endpoint Web App** (o compartí directamente el enlace generado con el botón **Copiar enlace de invitación**, que agrega `?ep=...` para configurar cada nuevo dispositivo con un clic).

> En **GitHub Pages**, el workflow `.github/workflows/deploy.yml` compila y publica automáticamente la carpeta `dist/` en cada push a `main`. Podés definir `VITE_SHEETS_ENDPOINT` y `VITE_SHEET_URL` como Variables del repositorio en GitHub si querés preconfigurar una planilla por defecto.
