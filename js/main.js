/* =========================================================
   Radio Renueva FM — lógica
   ========================================================= */
(function () {
  'use strict';

  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  /* ---------- Año ---------- */
  $('#year').textContent = new Date().getFullYear();

  /* =======================================================
     MODO CLARO / OSCURO
     ======================================================= */
  const modeBtn = $('#modeBtn');
  const modeIcon = $('#modeIcon');

  const oscuroGuardado = localStorage.getItem('rr-modo') === 'dark';
  if (oscuroGuardado) aplicarOscuro();

  function aplicarOscuro() {
    document.body.classList.add('dark');
    modeIcon.className = 'fas fa-sun';
  }
  function aplicarClaro() {
    document.body.classList.remove('dark');
    modeIcon.className = 'fas fa-moon';
  }

  modeBtn.addEventListener('click', () => {
    const oscuro = document.body.classList.toggle('dark');
    modoIcon.className = oscuro ? 'fas fa-sun' : 'fas fa-moon';
    localStorage.setItem('rr-modo', oscuro ? 'dark' : 'light');
  });

  /* =======================================================
     REPRODUCTOR
     ======================================================= */

  /* =======================================================
     1) URL DEL STREAM  (ZosHosting · puerto 8046)
        Formato: AAC+  ·  112 kbps
     ======================================================= */
  const STREAM_URL = 'https://radio.zoshosting.com/8046/stream';

  /* =======================================================
     2) API DE METADATOS —Confirmeda y funcionando.
        Devuelve JSON con la canción que suena ahora.
     ======================================================= */
  const metaApi = 'https://radio.zoshosting.com/cp/get_info.php?p-8046';

  const audio    = $('#audio');
  const playbar  = $('#playbar');
  const playBtn  = $('#playBtn');
  const playIcon = $('#playIcon');
  const muteBtn  = $('#muteBtn');
  const volume   = $('#volume');
  const progress = $('#playerProgress');
  const statusEl = $('#playerStatus');
  const npTitle  = $('#npTitle');
  const npArtist = $('#npArtist');

  audio.src = STREAM_URL;
  audio.volume = volume.value / 100;

  function setPlaying(on) {
    playbar.classList.toggle('is-playing', on);
    playIcon.className = on ? 'fas fa-pause' : 'fas fa-play';
    statusEl.textContent = on ? 'Reproduciendo' : 'En directo';
  }

  /* ---- Metadatos: qué está sonando ---- */
  function setNowPlaying(titulo, artista) {
    if (titulo)  npTitle.textContent  = titulo;
    if (artista) npArtist.textContent = artista;
  }

  function detectarMetaAPI(url) {
    if (metaApi) return metaApi;
    if (url.includes('zeno.fm')) {
      const mp = url.match(/zeno\.fm\/([^/?]+)/);
      if (mp) return `https://zeno.fm/api/streammetadata/${mp[1]}`;
    }
    if (url.includes('radiogarden.com')) {
      const ch = url.match(/radio\/([a-z0-9]+)/i);
      if (ch) return `https://radiogarden.com/api/streamTitle/${ch[1]}`;
    }
    try {
      const u = new URL(url);
      return `${u.protocol}//${u.host}/status-json.xsl`;
    } catch (_) { return null; }
  }

  const API = detectarMetaAPI(STREAM_URL);

  /* Divide "ARTISTA - TITULO" en dos partes */
  function separar(crudo) {
    const s = String(crudo).replace(/\s+/g, ' ').trim();
    const m = s.match(/^(.{2,60}?)\s+-\s+(.+)$/);
    if (m) return { artista: m[1].trim(), titulo: m[2].trim() };
    return { artista: null, titulo: s };
  }

  /* Limpia "1.) 01 - " y sufijos tipo -convert / (Video Oficial) */
  function limpiar(t) {
    return String(t)
      .replace(/^\s*\d+\s*\)?[.)]\s*/, '')   // "1.) "
      .replace(/^\s*\d{1,2}\s+-\s+/, '')      // "01 - "
      .replace(/\s*-\s*convert$/i, '')
      .replace(/\s*[\(\[][^)\]]*[\)\]]\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async function leerMetadatos() {
    if (!API) return;
    const sep = API.includes('?') ? '&' : '?';

    // El API de ZosHosting a veces responde vacio: reintenta
    for (let intento = 0; intento < 3; intento++) {
      try {
        const r = await fetch(API + sep + '_=' + Date.now() + '&t=' + intento, { cache: 'no-store' });
        if (!r.ok) continue;
        const txt = (await r.text()).trim();
        if (!txt) continue;                 // vacio = sigue sin datos

        let artista = null, titulo = null;

        if (txt.startsWith('{') || txt.startsWith('[')) {
          const d = JSON.parse(txt);
          if (typeof d === 'string') {
            ({ artista, titulo } = separar(d));
          } else {
            const o = Array.isArray(d) ? d[0] : d;
            const crudo = o.title || o.song || o.track || o.trackname ||
                          o.now_playing || o.streamtitle || o.name ||
                          (o.icymetadata && o.icymetadata.streamtitle) || null;
            if (crudo) ({ artista, titulo } = separar(crudo));
            // Si no hay title, usa la primera cancion del historial
            if (!crudo && Array.isArray(o.history) && o.history.length) {
              ({ artista, titulo } = separar(o.history[0]));
            }
            artista = o.artist || o.artistname || o.performer ||
                      (o.icymetadata && o.icymetadata.artist) || artista;
          }
        } else {
          const m = txt.match(/StreamTitle='(.*?)'/) ||
                    txt.match(/"(?:title|streamtitle)"\s*:\s*"(.*?)"/);
          if (m) ({ artista, titulo } = separar(m[1]));
        }

        if (titulo) {
          setNowPlaying(limpiar(titulo), artista ? limpiar(artista) : null);
          return;
        }
      } catch (_) { /* CORS o API caida: reintenta */ }
      await new Promise(r => setTimeout(r, 700));
    }
    // Si no hay datos, mantiene la ultima cancion en pantalla
  }

  setInterval(() => { if (!audio.paused) leerMetadatos(); }, 5000);

  /* ---- Reproducción ---- */
  playBtn.addEventListener('click', () => {
    if (audio.paused) {
      // El ?t= evita que el navegador use caché
      audio.src = STREAM_URL + (STREAM_URL.includes('?') ? '&' : '?') + 't=' + Date.now();
      audio.play()
        .then(() => { setPlaying(true); leerMetadatos(); })
        .catch(() => {
          npTitle.textContent = 'No se pudo conectar al stream.';
          setTimeout(() => setNowPlaying('Radio Renueva FM', 'San Antonio · Paraguay'), 5000);
        });
    } else {
      audio.pause();
    }
  });

  audio.addEventListener('play',    () => setPlaying(true));
  audio.addEventListener('pause',   () => setPlaying(false));
  audio.addEventListener('waiting', () => { statusEl.textContent = 'Conectando…'; });
  audio.addEventListener('error',   () => { npTitle.textContent = 'Stream no disponible.'; });

  /* ---- Volumen ---- */
  volume.addEventListener('input', () => { audio.volume = volume.value / 100; });

  let ultimoVolumen = volume.value;
  muteBtn.addEventListener('click', () => {
    if (audio.volume > 0) {
      ultimoVolumen = volume.value;
      audio.volume = 0;
      muteBtn.innerHTML = '<i class="fas fa-volume-xmark"></i>';
    } else {
      audio.volume = ultimoVolumen / 100;
      muteBtn.innerHTML = '<i class="fas fa-volume-high"></i>';
    }
    volume.value = Math.round(audio.volume * 100);
  });

  /* ---- Barra de progreso (en vivo = loop) ---- */
  setInterval(() => {
    if (audio.paused) { progress.style.width = '0%'; return; }
    if (isFinite(audio.duration) && audio.duration > 0) {
      progress.style.width = (audio.currentTime / audio.duration) * 100 + '%';
    } else {
      const w = (parseFloat(progress.style.width) || 0) + 0.5;
      progress.style.width = (w > 100 ? 0 : w) + '%';
    }
  }, 200);

  /* ---- Atajo: barra espaciadora ---- */
  document.addEventListener('keydown', e => {
    if (e.code === 'Space' && !/INPUT|TEXTAREA|SELECT|BUTTON|A/.test(e.target.tagName)) {
      e.preventDefault();
      playBtn.click();
    }
  });

  /* =======================================================
     FORMULARIO
     ======================================================= */
  const form = $('#contactForm');
  const note = $('#formNote');

  form.addEventListener('submit', e => {
    e.preventDefault();
    const nombre  = form.nombre.value.trim();
    const email   = form.email.value.trim();
    const mensaje = form.mensaje.value.trim();

    if (!nombre || !email || !mensaje) {
      note.textContent = 'Completá todos los campos.';
      note.className = 'form__note is-err';
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      note.textContent = 'Revisá el correo: no parece válido.';
      note.className = 'form__note is-err';
      return;
    }

    // Conectá tu backend acá:
    // fetch('/api/peticion', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ nombre, email, mensaje, asunto: form.asunto.value })
    // })

    note.textContent = `Recibimos tu petición, ${nombre}. Vamos a orar por ti.`;
    note.className = 'form__note is-ok';
    form.reset();
  });

})();
