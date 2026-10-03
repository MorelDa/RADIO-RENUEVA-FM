/**
 * API de notificaciones push (Vercel Serverless) para Radio Renueva FM.
 *
 *   GET  /api/notificar          -> { dispositivos: N }
 *   POST /api/notificar { accion: 'registrar', token }   -> registra el celular
 *   POST /api/notificar { accion: 'enviar', titulo, cuerpo, imagen }  -> avisa a todos
 *
 * Enviar usa FCM:
 *   - FCM_PROJECT_ID + FCM_CLIENT_EMAIL + FCM_PRIVATE_KEY  (HTTP v1, recomendado)
 *   - o FCM_SERVER_KEY                                       (API legacy, simple)
 */

const REPO = process.env.PANEL_REPO || 'MorelDa/RADIO-RENUEVA-FM';
const BRANCH = process.env.PANEL_BRANCH || 'main';
const DEVICES_PATH = 'devices.json';
const SITE = process.env.PANEL_SITE || 'https://radio-renueva-fm.vercel.app';

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
  if (!r.ok) throw new Error(`GitHub ${r.status}`);
  return r.status === 204 ? null : r.json();
}

async function escribirArchivo(path, texto, mensaje) {
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
      content: Buffer.from(texto).toString('base64'),
      branch: BRANCH,
      ...(sha ? { sha } : {}),
    }),
  });
}

async function leerDevices() {
  try {
    const f = await github(`/contents/${DEVICES_PATH}?ref=${BRANCH}`);
    const data = JSON.parse(Buffer.from(f.content || '', 'base64').toString('utf8'));
    return Array.isArray(data) ? data : data.devices || [];
  } catch (_) {
    return [];
  }
}

/* ── JWT (RS256) para la API v1 de FCM ── */
const b64 = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');

async function tokenV1() {
  const { createSign } = require('crypto');
  const key = (process.env.FCM_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const client = process.env.FCM_CLIENT_EMAIL || '';
  const scope = 'https://www.googleapis.com/auth/firebase.messaging';
  const ahora = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'RS256', typ: 'JWT' });
  const payload = b64({
    iss: client,
    scope,
    aud: 'https://oauth2.googleapis.com/token',
    iat: ahora,
    exp: ahora + 3600,
  });
  const firma = createSign('RSA-SHA256')
    .update(`${head}.${payload}`)
    .sign(key, 'base64url');
  const jwt = `${head}.${payload}.${firma}`;

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await r.json();
  if (!data.access_token) throw new Error('FCM v1: no se pudo obtener token');
  return data.access_token;
}

async function enviarFCM(tokens, { titulo, cuerpo, imagen, link }) {
  const resultados = { ok: 0, fail: 0, invalidos: [] };
  if (!tokens.length) return resultados;

  const proyecto = process.env.FCM_PROJECT_ID || '';

  // ── API v1 (recomendada) ──
  if (proyecto && process.env.FCM_CLIENT_EMAIL && process.env.FCM_PRIVATE_KEY) {
    const access = await tokenV1();
    for (const token of tokens) {
      try {
        const r = await fetch(`https://fcm.googleapis.com/v1/projects/${proyecto}/messages:send`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: {
              token,
              notification: { title: titulo, body: cuerpo },
              android: {
                priority: 'HIGH',
                notification: {
                  channel_id: 'renueva',
                  image: imagen || undefined,
                  click_action: link || undefined,
                },
              },
              data: { link: link || '' },
            },
          }),
        });
        if (r.ok) resultados.ok += 1;
        else {
          resultados.fail += 1;
          if (r.status === 404 || r.status === 400) resultados.invalidos.push(token);
        }
      } catch (_) {
        resultados.fail += 1;
      }
    }
    return resultados;
  }

  // ── API legacy (server key) ──
  const key = process.env.FCM_SERVER_KEY || '';
  if (!key) throw new Error('Falta configurar FCM en Vercel (FCM_SERVER_KEY o FCM_PROJECT_ID)');
  for (const token of tokens) {
    try {
      const r = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: { Authorization: `key=${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: token,
          priority: 'high',
          notification: { title: titulo, body: cuerpo, image: imagen || undefined },
          data: { link: link || '' },
        }),
      });
      if (r.ok) resultados.ok += 1;
      else resultados.fail += 1;
    } catch (_) {
      resultados.fail += 1;
    }
  }
  return resultados;
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
  const pin = process.env.PANEL_PIN || '';
  const recibido = req.headers['x-panel-pin'] || leerBody(req).pin || '';

  try {
    // Cantidad de celulares registrados (público)
    if (req.method === 'GET') {
      const devices = await leerDevices();
      return responder(res, 200, { dispositivos: devices.length });
    }

    if (req.method !== 'POST') {
      return responder(res, 405, { error: 'Método no permitido' });
    }

    const body = leerBody(req);
    const accion = body.accion || '';

    // ── La app registra su token (sin PIN) ──
    if (accion === 'registrar') {
      const token = String(body.token || '').trim();
      if (!token) return responder(res, 400, { error: 'Falta el token' });
      const devices = await leerDevices();
      if (!devices.includes(token)) {
        devices.push(token);
        await escribirArchivo(
          DEVICES_PATH,
          JSON.stringify(devices, null, 2),
          'chore: registrar dispositivo para notificaciones'
        );
      }
      return responder(res, 200, { ok: true, dispositivos: devices.length });
    }

    // ── Enviar notificación (con PIN) ──
    if (!pin || recibido !== pin) {
      return responder(res, 401, { error: 'PIN incorrecto' });
    }

    if (accion === 'enviar') {
      const titulo = String(body.titulo || '').slice(0, 60);
      const cuerpo = String(body.cuerpo || '').slice(0, 160);
      if (!titulo || !cuerpo) {
        return responder(res, 400, { error: 'Faltan el título o el mensaje' });
      }
      let devices = await leerDevices();
      if (!devices.length) {
        return responder(res, 200, {
          ok: false,
          enviados: 0,
          mensaje: 'Todavía no hay celulares registrados.',
        });
      }
      let r = await enviarFCM(devices, {
        titulo,
        cuerpo,
        imagen: body.imagen ? String(body.imagen) : '',
        link: body.link ? String(body.link) : '',
      });
      // Limpia tokens que ya no sirven
      if (r.invalidos.length) {
        const limpio = devices.filter(t => !r.invalidos.includes(t));
        await escribirArchivo(
          DEVICES_PATH,
          JSON.stringify(limpio, null, 2),
          'chore: limpiar tokens invalidos'
        );
        devices = limpio;
      }
      return responder(res, 200, {
        ok: true,
        enviados: r.ok,
        fallidos: r.fail,
        dispositivos: devices.length,
      });
    }

    return responder(res, 400, { error: 'Acción desconocida' });
  } catch (error) {
    return responder(res, 500, { error: String((error && error.message) || error) });
  }
};
