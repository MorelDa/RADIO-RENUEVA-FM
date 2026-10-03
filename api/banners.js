/**
 * API del panel de banners (Vercel Serverless).
 *
 * El cliente NO necesita token de GitHub: esta función escribe
 * `banners.json` y las imágenes en el repositorio usando el token
 * guardado como variable de entorno (GITHUB_TOKEN) y valida un PIN.
 *
 *   GET  /api/banners            -> lista actual de banners
 *   POST /api/banners            -> { accion: 'subir', nombre, base64 }
 *   POST /api/banners            -> { banners: [...] }  (publica la lista)
 */

const REPO = process.env.PANEL_REPO || 'MorelDa/RADIO-RENUEVA-FM';
const BRANCH = process.env.PANEL_BRANCH || 'main';
const BANNERS_PATH = 'banners.json';
const IMG_DIR = process.env.PANEL_IMG_DIR || 'assets/banners';
const SITE = process.env.PANEL_SITE || 'https://radio-renueva-fm.vercel.app';
const MAX_BANNERS = 10;

function responder(res, code, data) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

async function github(path, options = {}) {
  const r = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN || ''}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`GitHub ${r.status}: ${t.slice(0, 200)}`);
  }
  return r.status === 204 ? null : r.json();
}

async function escribirArchivo(path, base64, mensaje) {
  let sha;
  try {
    const f = await github(`/contents/${path}?ref=${BRANCH}`);
    sha = f.sha;
  } catch (_) {
    sha = undefined;
  }
  await github(`/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: mensaje,
      content: base64,
      branch: BRANCH,
      ...(sha ? { sha } : {}),
    }),
  });
}

function leerBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.length) {
    try {
      return JSON.parse(req.body);
    } catch (_) {
      return {};
    }
  }
  return {};
}

module.exports = async (req, res) => {
  const pinEsperado = process.env.PANEL_PIN || '';
  const pinRecibido =
    req.headers['x-panel-pin'] || leerBody(req).pin || '';

  try {
    // ── Listar banners (público: la app y el panel lo pueden leer) ──
    if (req.method === 'GET') {
      try {
        const f = await github(`/contents/${BANNERS_PATH}?ref=${BRANCH}`);
        const texto = Buffer.from(f.content || '', 'base64').toString('utf8');
        const data = JSON.parse(texto);
        const lista = Array.isArray(data) ? data : data.banners || [];
        return responder(res, 200, { banners: lista });
      } catch (_) {
        return responder(res, 200, { banners: [] });
      }
    }

    if (req.method !== 'POST') {
      return responder(res, 405, { error: 'Método no permitido' });
    }

    // ── Todo lo que escribe exige el PIN ──
    if (!pinEsperado || pinRecibido !== pinEsperado) {
      return responder(res, 401, { error: 'PIN incorrecto' });
    }

    const body = leerBody(req);

    // Subir imagen
    if (body.accion === 'subir') {
      const nombre = String(body.nombre || '').replace(/[^\w.\-]/g, '_');
      const base64 = String(body.base64 || '');
      if (!nombre || !base64) {
        return responder(res, 400, { error: 'Falta el archivo' });
      }
      const path = `${IMG_DIR}/${nombre}`;
      await escribirArchivo(path, base64, `chore: banner ${nombre}`);
      return responder(res, 200, { ok: true, imagen: `${SITE}/${path}` });
    }

    // Publicar la lista
    if (!Array.isArray(body.banners)) {
      return responder(res, 400, { error: 'Falta la lista de banners' });
    }
    const limpio = body.banners
      .filter(b => b && typeof b.imagen === 'string' && /^https?:\/\//.test(b.imagen))
      .slice(0, MAX_BANNERS)
      .map(b => ({
        imagen: b.imagen,
        ...(b.texto ? { texto: String(b.texto).slice(0, 90) } : {}),
        ...(b.link ? { link: String(b.link).slice(0, 300) } : {}),
      }));

    await escribirArchivo(
      BANNERS_PATH,
      Buffer.from(JSON.stringify(limpio, null, 2)).toString('base64'),
      'chore: actualizar banners desde el panel'
    );
    return responder(res, 200, { ok: true, banners: limpio });
  } catch (error) {
    return responder(res, 500, { error: String((error && error.message) || error) });
  }
};
