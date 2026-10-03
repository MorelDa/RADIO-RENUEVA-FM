# Panel de Banners — Radio Renueva FM

Página web para que el cliente cambie los **banners (sliders)** de la app
sin publicar una versión nueva.

## Cómo funciona

1. El panel sube las imágenes y escribe `banners.json` en el repositorio de GitHub.
2. Vercel publica solo (detecta el cambio).
3. La app lee `https://radio-renueva-fm.vercel.app/banners.json` al abrir y muestra esos banners.
4. Si no hay internet o el archivo no existe, la app usa los banners que ya vienen dentro de la app.

## Puesta en marcha (una sola vez)

### 1. Subir el panel a la web

Copiá `index.html` dentro del proyecto web (el que está en Vercel) en una
carpeta llamada `panel/`, por ejemplo:

```
web/
  index.html
  panel/index.html      <-- este archivo
  banners.json          <-- lo crea el panel solo
  assets/banners/       <-- acá van las imágenes
```

Con Vercel conectado al repo, la página queda en:
`https://radio-renueva-fm.vercel.app/panel/`

> Si preferís que sea una página aparte, se puede publicar este mismo
> `index.html` como otro proyecto de Vercel.

### 2. Crear el token de GitHub (lo hace el cliente una vez)

- GitHub → botón de tu perfil → **Settings** → **Developer settings** →
  **Personal access tokens** → **Tokens (classic)** → **Generate new token**.
- Marcar el permiso **`public_repo`** (solo ese).
- Copiar el token (empieza con `ghp_...`).

### 3. En el panel

- **Usuario / organización**: `radio-renueva` (la cuenta donde está el repo)
- **Repositorio**: el nombre del repo de la web (por ejemplo `web`)
- **Rama**: `main`
- **Carpeta de imágenes**: `assets/banners`
- **Token**: el paso anterior

Botón **Probar conexión** → si dice "Conectado" ya puede subir banners.

## Uso del cliente

1. Abre el link del panel en el navegador (o lo guarda en la pantalla de inicio).
2. **Subir un banner** → elige la imagen (ideal **1200 × 500 px**) o pega el link.
3. Opcionalmente escribe un texto y un link (por ejemplo WhatsApp).
4. **Agregar al carrusel** → aparece en la lista.
5. Ordena con las flechas ↑ ↓.
6. **Publicar cambios** → listo, en ~30 segundos la app lo muestra.

## Tamaño recomendado de las imágenes

| | |
|---|---|
| Proporción | **2,4 : 1** (ancho/alto) |
| Ideal | **1200 × 500 px** |
| Mínimo | 1080 × 450 px |

Si la imagen tiene otra proporción se recorta un poco (no se deforma).

## Formato del `banners.json`

```json
[
  {
    "imagen": "https://raw.githubusercontent.com/usuario/repo/main/assets/banners/slider1.png",
    "texto": "Programación 24 horas",
    "link": "https://wa.me/595981922429"
  }
]
```

- `imagen` es obligatorio.
- `texto` y `link` son opcionales (se pueden quitar).
- Si el banner tiene `link`, al tocarlo en la app se abre.

## Ajustes en la app

En `src/config/config.ts`:

```ts
export const RADIO_BANNERS_REMOTE = true;
export const RADIO_BANNERS_URL =
  'https://radio-renueva-fm.vercel.app/banners.json';
```

- `RADIO_BANNERS_REMOTE = false` → deja de leer la web y usa solo los locales.
- `RADIO_BANNERS_URL` → la dirección donde vive el `banners.json`.

## Seguridad

- El token **nunca se publica** en la web: se queda en el navegador del cliente
  (`localStorage`) y solo se usa para hablar con GitHub.
- Si el token se filtra, se revoca en GitHub y se genera uno nuevo.
- El token solo puede modificar el repositorio del cliente (`public_repo`).
