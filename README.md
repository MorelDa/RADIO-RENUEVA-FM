# Radio Renueva FM — sitio web

Sitio de una página para **Radio Renueva FM** (San Antonio, Paraguay).
Estilo basado en el de *Splendor Disco*: hero a pantalla completa, título
sobrepuesto, logo en caja blanca, modo claro/oscuro y barra reproductora negra.

---

## 1. Abrir el sitio

Doble clic en `index.html`, o con un servidor local (recomendado):

```bash
python -m http.server 8080
```

Luego abrir <http://localhost:8080>

---

## 2. Poner el stream (lo único obligatorio)

Abrí `js/main.js` y cambiá **una sola línea** (está al principio del archivo,
buscá `STREAM_URL`):

```js
const STREAM_URL = 'https://TU-STREAM-AQUI/live/stream.mp3';
```

Formatos que funcionan:

| Tipo | Ejemplo |
|---|---|
| MP3 | `https://servidor:8000/stream` |
| AAC / OGG | `https://servidor:8000/stream.aac` |
| Shoutcast | `http://dominio:8000/;` |
| HLS | `https://dominio/live/stream.m3u8` |

> **Consejo:** si tu servidor usa Shoutcast con auto-DJ, agregá un `?` al final
> de la URL. El sitio ya lo hace solo.

### Metadatos (qué canción suena)

El sitio detecta solo el panel y muestra el nombre de la canción en el cuadro
del hero. Si tu panel no se reconoce, poné la URL de metadatos acá:

```js
const metaApi = null;   // ← poner tu URL
```

Detecta solo: **Zeno.fm**, **Icecast**, **Shoutcast** y **Radio Garden**.

---

## 3. Archivos

```
plantilla/
├── index.html            ← toda la página
├── css/styles.css        ← estilos (colores arriba en :root)
├── js/main.js            ← reproductor, modo oscuro, formulario
└── assets/
    ├── logo.png          ← tu logo (512x512, fondo transparente)
    └── hero.webp         ← foto del encabezado (1920x1080)
```

---

## 4. Cambiar colores

Todo está al principio de `css/styles.css`:

```css
:root {
  --acc:   #0f6fd0;   /* azul de acento */
  --acc-2: #0a56a8;
}
```

---

## 5. Cambiar fotos

| Quiero cambiar… | Archivo |
|---|---|
| El logo | `assets/logo.png` (mismo nombre de archivo) |
| La foto del encabezado | `assets/hero.webp` |

La foto del encabezado se muestra en **cover** (se recorta sola para llenar).
Conviene que mida al menos **1920 px de ancho**.

---

## 6. Datos de contacto

En `index.html`, dentro de la sección `id="contacto"`:

- Correo (hoy es uno de ejemplo)
- WhatsApp: `+595 981 922429`
- Links de Facebook y TikTok

---

## 7. Publicar

**Opción A — Vercel (gratis, como tus otras radios)**
1. Subí la carpeta a un repo de GitHub
2. En Vercel: *Add New* → *Project* → elegí el repo
3. Detectará HTML solo. No hay build.

**Opción B — Netlify**
1. Arrastrá la carpeta a <https://app.netlify.com/drop>

**Opción C — GitHub Pages**
1. Subí la carpeta a un repo
2. *Settings* → *Pages* → *Deploy from a branch* → `main` / `root`

En los tres casos la web queda en una URL libre tipo
`radio-renueva-fm.vercel.app`.

---

## 8. Conectar el formulario

Hoy el formulario **valida y muestra un mensaje, pero no envía nada**.

En `js/main.js`, buscá el `// Conectá tu backend acá:` y descomentá el `fetch`:

```js
fetch('/api/peticion', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ nombre, email, mensaje, asunto: form.asunto.value })
})
```

Alternativas sin servidor: **Formspree**, **Getform**, **Web3Forms**
(los tres gratis, solo cambiás la URL).
