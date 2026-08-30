(() => {
  'use strict';

  const NAMESPACE = 'urn:x-cast:com.deuced.score';
  const STAGE_W = 1920;
  const STAGE_H = 1080;

  let layout = null;
  let lastState = null;

  const stage = document.getElementById('stage');
  const playersRoot = document.getElementById('players');
  const scoreRoot = document.getElementById('score');
  const progressRoot = document.getElementById('progress');
  const serverBall = document.getElementById('serverBall');
  const audio = document.getElementById('castAudio');

  function fitStage() {
    const scale = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
    stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }

  window.addEventListener('resize', fitStage);
  fitStage();

  function setRect(el, r) {
    el.style.left = `${r.x}px`;
    el.style.top = `${r.y}px`;
    el.style.width = `${r.w}px`;
    el.style.height = `${r.h}px`;
  }

  function asset(name) {
    return `assets/${name}`;
  }

  function imageEl(className, src, r) {
    const img = document.createElement('img');
    img.className = className;
    img.src = src;
    img.alt = '';
    setRect(img, r);
    return img;
  }

  function cleanName(value, fallback) {
    const text = String(value ?? '').trim();
    return text || fallback;
  }

  function renderPlayers(state) {
    playersRoot.replaceChildren();

    const slots = [
      ['A1', state.teamA1, state.photoA1],
      ['A2', state.teamA2, state.photoA2],
      ['B1', state.teamB1, state.photoB1],
      ['B2', state.teamB2, state.photoB2],
    ];

    for (const [slot, name, photoUrl] of slots) {
      const cfg = layout.players[slot];
      const hasPhoto = typeof photoUrl === 'string' && photoUrl.trim().length > 0;

      const visual = imageEl(
        hasPhoto ? 'player-photo' : 'player-placeholder',
        hasPhoto ? photoUrl : asset(cfg.placeholder.asset),
        cfg.placeholder,
      );

      if (hasPhoto) {
        visual.onerror = () => {
          visual.onerror = null;
          visual.className = 'player-placeholder';
          visual.src = asset(cfg.placeholder.asset);
        };
      }

      playersRoot.appendChild(visual);

      // El marco del PSD siempre queda por encima de la foto/placeholder.
      const frame = imageEl(
        'player-frame',
        asset(cfg.frame.asset),
        cfg.frame,
      );
      playersRoot.appendChild(frame);

      const label = document.createElement('div');
      label.className = 'player-name';
      label.textContent = cleanName(name, slot.endsWith('1') ? 'J1' : 'J2');
      setRect(label, cfg.nameBand);
      playersRoot.appendChild(label);
    }
  }

  function pointAsset(color, rawValue) {
    const value = String(rawValue ?? '0').toUpperCase();
    const canonical = value === 'AD' ? 'ADV' : value;
    return layout.points[color]?.[canonical] ?? null;
  }

  function isGraphicPoint(value) {
    const canonical = String(value ?? '0').toUpperCase().replace('AD', 'ADV');
    return ['0', '15', '30', '40', 'ADV'].includes(canonical);
  }

  function renderScore(state) {
    scoreRoot.replaceChildren();

    const isTieBreak = Boolean(state.tiebreak) ||
      !isGraphicPoint(state.pointsA) || !isGraphicPoint(state.pointsB);

    if (!isTieBreak) {
      const red = pointAsset('red', state.pointsA);
      const blue = pointAsset('blue', state.pointsB);
      if (red) scoreRoot.appendChild(imageEl('score-image', asset(red.asset), red));
      if (blue) scoreRoot.appendChild(imageEl('score-image', asset(blue.asset), blue));
      return;
    }

    const makeTb = (team, value) => {
      const r = layout.tiebreak[team === 'A' ? 'red' : 'blue'];
      const el = document.createElement('div');
      el.className = `tiebreak-score ${team === 'A' ? 'red' : 'blue'}`;
      el.textContent = String(value ?? 0);
      setRect(el, r);
      el.style.fontSize = `${r.fontSize}px`;
      el.style.display = 'flex';
      return el;
    };

    scoreRoot.appendChild(makeTb('A', state.pointsA));
    scoreRoot.appendChild(makeTb('B', state.pointsB));
  }

  function renderProgress(state) {
    progressRoot.replaceChildren();

    const gamesA = Number(state.gamesA ?? 0);
    const gamesB = Number(state.gamesB ?? 0);
    const setsA = Number(state.setsWonA ?? 0);
    const setsB = Number(state.setsWonB ?? 0);

    for (const [team, count] of [['A', Math.min(6, gamesA)], ['B', Math.min(6, gamesB)]]) {
      for (let i = 0; i < count; i++) {
        const cfg = layout.games[team][i];
        progressRoot.appendChild(imageEl('progress-fill', asset(cfg.asset), cfg));
      }
    }

    const winners = Array.isArray(state.setWinners) ? state.setWinners.slice(0, 3) : [];

    if (winners.length > 0) {
      // Cada columna 1/2/3 representa el set cronológico. Sólo se
      // rellena la barra del equipo que ganó ese set.
      winners.forEach((winner, index) => {
        const team = String(winner).toUpperCase() === 'B' ? 'B' : 'A';
        const cfg = layout.sets[team][index];
        if (cfg) progressRoot.appendChild(imageEl('progress-fill', asset(cfg.asset), cfg));
      });
    } else {
      // Compatibilidad con receptores/sender anteriores.
      for (const [team, count] of [['A', Math.min(3, setsA)], ['B', Math.min(3, setsB)]]) {
        for (let i = 0; i < count; i++) {
          const cfg = layout.sets[team][i];
          progressRoot.appendChild(imageEl('progress-fill', asset(cfg.asset), cfg));
        }
      }
    }
  }

  function renderCounters(state) {
    const values = {
      gamesA: Number(state.gamesA ?? 0),
      gamesB: Number(state.gamesB ?? 0),
      setsA: Number(state.setsWonA ?? 0),
      setsB: Number(state.setsWonB ?? 0),
    };

    for (const [id, value] of Object.entries(values)) {
      const el = document.getElementById(id);
      const cfg = layout.counts[id];
      el.textContent = String(value);
      setRect(el, cfg);
      el.style.fontSize = `${cfg.fontSize}px`;
    }
  }

  function renderServer(state) {
    const server = String(state.server ?? '').toUpperCase();
    const cfg = layout.players[server]?.frame;
    if (!cfg) {
      serverBall.style.display = 'none';
      return;
    }

    serverBall.style.left = `${cfg.x + layout.ball.offsetX}px`;
    serverBall.style.top = `${cfg.y + layout.ball.offsetY}px`;
    serverBall.style.width = `${layout.ball.w}px`;
    serverBall.style.height = `${layout.ball.h}px`;
    serverBall.style.display = 'block';
  }

  function renderState(state) {
    if (!layout || !state || typeof state !== 'object') return;
    lastState = state;
    renderPlayers(state);
    renderScore(state);
    renderProgress(state);
    renderCounters(state);
    renderServer(state);
  }

  async function playAudioMessage(data) {
    const url = String(data.url ?? '').trim();
    if (!url) return;

    try {
      audio.pause();
      audio.currentTime = 0;
      audio.src = url;
      await audio.play();
    } catch (_) {
      // El receptor seguirá mostrando el marcador aunque un audio no pueda reproducirse.
    }
  }

  function handleMessage(raw) {
    let data = raw;
    if (typeof raw === 'string') {
      try { data = JSON.parse(raw); } catch (_) { return; }
    }

    if (!data || typeof data !== 'object') return;

    if (data.type === 'audioUrl') {
      void playAudioMessage(data);
      return;
    }

    if (data.type === 'audioStop') {
      audio.pause();
      audio.currentTime = 0;
      audio.removeAttribute('src');
      return;
    }

    renderState(data);
  }

  function updateClock() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('clock').textContent = `${hh}:${mm}`;
  }

  setInterval(updateClock, 1000);
  updateClock();

  async function boot() {
    layout = await fetch('assets/layout.json', { cache: 'no-store' }).then(r => r.json());

    if (window.cast?.framework?.CastReceiverContext) {
      const context = cast.framework.CastReceiverContext.getInstance();
      context.addCustomMessageListener(NAMESPACE, event => handleMessage(event.data));
      context.start({ disableIdleTimeout: true });
      return;
    }

    // Vista local de desarrollo cuando se abre fuera de Chromecast.
    try {
      const demo = await fetch('mock_state.json', { cache: 'no-store' }).then(r => r.json());
      renderState(demo);
    } catch (_) {}
  }

  void boot();
})();
