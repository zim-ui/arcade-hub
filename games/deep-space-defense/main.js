(() => {
  'use strict';
  const UBG = (window.UBG = window.UBG || {});
  const { rand, clamp, sound, updateBgmLoop, syncVolumeUI, SHIP_SPECS, UPGRADE_POOL } = UBG;

  const canvas = document.getElementById('ubg-canvas');
  if (!canvas || canvas.dataset.ready) return;
  canvas.dataset.ready = '1';

  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  UBG.canvas = canvas;
  UBG.ctx = ctx;
  UBG.W = W;
  UBG.H = H;

  const $ = id => document.getElementById(id);
  const menu = $('ubg-menu'), settings = $('ubg-settings'), pauseOverlay = $('ubg-pause'), over = $('ubg-over');
  const upgradeOverlay = $('ubg-upgrade'), upgradeCardsEl = $('ubg-upgrade-cards');
  const warningEl = $('ubg-warning'), pauseBtn = $('ubg-pause-btn'), boostBtn = $('ubg-boost-btn');
  const volSlider = $('ubg-volume');

  const BOOST_MIN_COST = 50;

  let selectedShip = 'viper';
  try {
    const savedShip = localStorage.getItem('ubg_ship');
    if (savedShip && ['viper', 'titan', 'phantom'].includes(savedShip)) selectedShip = savedShip;
  } catch (e) {}

  function renderShipSelection() {
    document.querySelectorAll('.ubg-ship-card').forEach(btn => {
      const id = btn.dataset.ship;
      const active = id === selectedShip;
      const col = SHIP_SPECS[id].primary;
      btn.style.background = active ? '#0e253d' : '#0b1526';
      btn.style.border = active ? `1.5px solid ${col}` : '1px solid #334155';
      btn.style.boxShadow = active ? `0 0 14px ${col}33` : 'none';
    });
  }
  renderShipSelection();

  document.querySelectorAll('.ubg-ship-card').forEach(btn => {
    btn.onclick = () => {
      selectedShip = btn.dataset.ship;
      try { localStorage.setItem('ubg_ship', selectedShip); } catch (e) {}
      renderShipSelection();
    };
  });

  UBG.state = 'MENU';
  UBG.pointer = { x: W / 2, y: H - 100 };
  UBG.time = 0;
  UBG.score = 0;
  UBG.best = 0;
  UBG.boss = null;
  UBG.bossEnragedBanner = 0;
  UBG.ship = null;
  UBG.trail = [];

  let last = 0;
  let grazeCount = 0, maxCombo = 1, bossesKilled = 0, shake = 0, combo = 0, comboLeft = 0, gridScroll = 0;
  let spawnClock = 40, asteroidClock = 55, orbClock = 380, grazeSoundCool = 0, eventClock = 640, missileClock = 0;
  let warning = 0, bossLevel = 1, bossAt = 240;
  let slowMoTimer = 0, cosmicEvent = null;
  let enemies, bullets, shots, missiles, asteroids, particles, sparks, shocks, floatTexts, pickups, stars, laserTick;

  try { UBG.best = Number(localStorage.getItem('ubg_best') || 0) || 0; } catch (e) {}
  $('ubg-best-menu').textContent = UBG.best;

  function setToggle(el, on) {
    el.textContent = on ? 'ON' : 'OFF';
    el.style.background = on ? '#064e3b' : '#450a0a';
    el.style.color = on ? '#6ee7b7' : '#fca5a5';
    el.style.border = '1px solid ' + (on ? '#10b981' : '#ef4444');
  }

  function updateToggles() {
    setToggle($('ubg-sound'), UBG.soundOn);
    setToggle($('ubg-shake'), UBG.shakeOn);
    syncVolumeUI();
    updateBgmLoop();
  }
  updateToggles();

  function setPause(paused) {
    if (paused && UBG.state === 'PLAYING') {
      UBG.state = 'PAUSED';
      canvas.style.cursor = 'default';
      pauseOverlay.style.display = 'flex';
      updateBgmLoop();
    } else if (!paused && UBG.state === 'PAUSED') {
      UBG.state = 'PLAYING';
      pauseOverlay.style.display = 'none';
      canvas.style.cursor = 'crosshair';
      last = performance.now();
      updateBgmLoop();
    }
  }

  $('ubg-pause-btn').onclick = () => {
    if (UBG.state === 'PLAYING') setPause(true);
    else if (UBG.state === 'PAUSED') setPause(false);
  };
  $('ubg-resume').onclick = () => setPause(false);
  $('ubg-pause-home').onclick = () => {
    pauseOverlay.style.display = 'none';
    upgradeOverlay.style.display = 'none';
    pauseBtn.style.display = 'none';
    boostBtn.style.display = 'none';
    menu.style.display = 'flex';
    UBG.state = 'MENU';
    canvas.style.cursor = 'default';
    updateBgmLoop();
  };

  $('ubg-settings-open').onclick = () => { menu.style.display = 'none'; settings.style.display = 'flex'; UBG.state = 'SETTINGS'; };
  $('ubg-back').onclick = () => { settings.style.display = 'none'; menu.style.display = 'flex'; UBG.state = 'MENU'; };
  $('ubg-sound').onclick = () => {
    UBG.soundOn = !UBG.soundOn;
    try { localStorage.setItem('ubg_sound', UBG.soundOn ? '1' : '0'); } catch (e) {}
    updateToggles();
  };
  volSlider.addEventListener('input', () => {
    UBG.volume = clamp(Number(volSlider.value) / 100, 0, 1);
    if (UBG.volume > 0 && !UBG.soundOn) {
      UBG.soundOn = true;
      try { localStorage.setItem('ubg_sound', '1'); } catch (e) {}
    }
    try { localStorage.setItem('ubg_volume', String(UBG.volume)); } catch (e) {}
    updateToggles();
  });
  $('ubg-shake').onclick = () => {
    UBG.shakeOn = !UBG.shakeOn;
    if (!UBG.shakeOn) shake = 0;
    try { localStorage.setItem('ubg_shake', UBG.shakeOn ? '1' : '0'); } catch (e) {}
    updateToggles();
  };
  $('ubg-play').onclick = () => startGame();
  $('ubg-retry').onclick = () => startGame();
  $('ubg-home').onclick = () => {
    over.style.display = 'none';
    upgradeOverlay.style.display = 'none';
    pauseBtn.style.display = 'none';
    boostBtn.style.display = 'none';
    menu.style.display = 'flex';
    UBG.state = 'MENU';
    updateBgmLoop();
  };

  function openUpgradeDraft() {
    UBG.state = 'UPGRADE';
    canvas.style.cursor = 'default';
    updateBgmLoop();
    const shuffled = [...UPGRADE_POOL].sort(() => Math.random() - 0.5).slice(0, 3);
    upgradeCardsEl.innerHTML = '';
    shuffled.forEach(item => {
      const btn = document.createElement('button');
      btn.style.cssText = `padding:13px 15px;background:#0b172a;border:1.5px solid ${item.color};border-radius:9px;color:#e2e8f0;text-align:left;cursor:pointer;box-shadow:0 0 18px ${item.color}22`;
      btn.innerHTML = `<div style="font-weight:900;font-size:13px;color:${item.color};letter-spacing:1px">${item.title}</div><div style="font-size:11px;color:#94a3b8;margin-top:4px">${item.desc}</div>`;
      btn.onclick = () => {
        item.apply(UBG.ship);
        sound('upgrade');
        addFloatText(UBG.ship.x + UBG.ship.w / 2, UBG.ship.y - 12, item.title.split(' (')[0], item.color, 1.15);
        upgradeOverlay.style.display = 'none';
        UBG.state = 'PLAYING';
        canvas.style.cursor = 'crosshair';
        last = performance.now();
        updateBgmLoop();
      };
      upgradeCardsEl.appendChild(btn);
    });
    upgradeOverlay.style.display = 'flex';
  }

  function addShock(x, y, color, maxR = 54) {
    shocks.push({ x, y, r: 8, maxR, color, alpha: 0.85 });
  }

  function addFloatText(x, y, text, color = '#facc15', scale = 1) {
    floatTexts.push({ x, y, vy: -1.15 * scale, text, color, life: 42, max: 42, scale });
  }

  function hitEffect(x, y, baseColor, isHeavy = false) {
    const n = isHeavy ? 10 : 6;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const spd = rand(1.4, isHeavy ? 4.4 : 3.2);
      sparks.push({
        x, y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        len: rand(7, isHeavy ? 16 : 12),
        life: rand(12, 22),
        max: 22,
        color: i % 2 === 0 ? '#ffffff' : baseColor
      });
    }
    for (let i = 0; i < 4; i++) {
      const a = rand(0, Math.PI * 2), v = rand(0.6, 2.2);
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(14, 24), max: 24, r: rand(1.2, 2.6), color: baseColor, kind: 'glow' });
    }
  }

  function spawnMissile(x, y, angleOffset = 0, dmgMult = 1) {
    const ship = UBG.ship;
    missiles.push({
      x,
      y,
      angle: -Math.PI / 2 + angleOffset,
      speed: 9.6,
      damage: 2.5 * ship.spec.baseDamage * ship.mods.damageMult * dmgMult,
      life: 160,
      trail: []
    });
  }

  function destroyTurret(b, t) {
    if (!b || !t || t.destroyed) return;
    t.hp = 0;
    t.destroyed = true;
    const tx = b.x + b.w / 2 + t.dx;
    const ty = b.y + b.h / 2 + t.dy;
    burst(tx, ty, '#f59e0b', 42, 4.8);
    burst(tx, ty, '#ef4444', 28, 3.8);
    hitEffect(tx, ty, '#facc15', true);
    addShock(tx, ty, '#f59e0b', 82);
    addShock(tx, ty, '#ffffff', 46);
    sound('turretBoom');
    shake = Math.max(shake, 12);
    UBG.score += 50;

    const remaining = (b.turrets || []).filter(item => item.hp > 0).length;
    if (remaining === 0) {
      addFloatText(tx, ty - 14, '+50 PHÁ HỦY! CORE EXPOSED!', '#facc15', 1.25);
      addPickup(tx, ty, 'boost');
    } else {
      addFloatText(tx, ty - 14, '+50 PHÁO ĐÀI CÁNH HẠ!', '#fb923c', 1.15);
      addPickup(tx, ty, ['rapid', 'shield', 'beam', 'drone'][Math.floor(Math.random() * 4)]);
    }
  }

  function getBossDamageMult(b) {
    if (b.kind === 'DREADNOUGHT' && (b.turrets || []).every(t => t.hp <= 0)) {
      return 1.25;
    }
    return 1;
  }

  function triggerBoost() {
    const ship = UBG.ship;
    if (UBG.state !== 'PLAYING' || !ship) return;
    if (ship.boostTimer > 0 || ship.boostEnergy < BOOST_MIN_COST) return;
    ship.boostEnergy = Math.max(0, ship.boostEnergy - BOOST_MIN_COST);
    laserTick = 0;
    const cx = ship.x + ship.w / 2, cy = ship.y + ship.h / 2;

    if (ship.type === 'titan') {
      ship.boostTimer = 26;
      ship.invuln = Math.max(ship.invuln, 50);
      shake = Math.max(shake, 14);
      sound('nova');
      addShock(cx, cy, '#fb923c', 260);
      addShock(cx, cy, '#facc15', 165);
      burst(cx, cy, '#fb923c', 38, 5.4);
      addFloatText(cx, cy - 22, 'OMEGA NOVA!', '#fb923c', 1.25);

      let cleared = 0;
      bullets = bullets.filter(b => {
        if (Math.hypot(b.x - cx, b.y - cy) < 360) {
          cleared++;
          hitEffect(b.x, b.y, '#facc15', false);
          return false;
        }
        return true;
      });
      if (cleared > 0) UBG.score += cleared * 2;

      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        if (Math.hypot(e.x + e.w / 2 - cx, e.y + e.h / 2 - cy) < 340) {
          e.hp -= 10 * ship.mods.damageMult;
          e.hitFlash = 6;
          if (e.hp <= 0) killEnemy(i);
        }
      }
      if (UBG.boss) {
        const b = UBG.boss;
        const bcx = b.x + b.w / 2, bcy = b.y + b.h / 2;
        if (b.turrets) {
          b.turrets.forEach(t => {
            if (t.hp > 0 && Math.hypot(bcx + t.dx - cx, bcy + t.dy - cy) < 400) {
              t.hp -= 18 * ship.mods.damageMult;
              t.flash = 6;
              if (t.hp <= 0) destroyTurret(b, t);
            }
          });
        }
        if (UBG.boss && Math.hypot(bcx - cx, bcy - cy) < 390) {
          b.hp -= 26 * ship.mods.damageMult * getBossDamageMult(b);
          b.flash = 6;
          if (b.hp <= 0) bossDeath();
        }
      }
      for (let m = 0; m < 8; m++) {
        spawnMissile(cx + (m % 2 === 0 ? -16 : 16), cy, -0.7 + (m / 7) * 1.4, 1.15);
      }
      sound('missile');
    } else if (ship.type === 'phantom') {
      ship.boostTimer = 105;
      ship.invuln = Math.max(ship.invuln, 110);
      shake = Math.max(shake, 6);
      sound('chrono');
      addShock(cx, cy, '#c084fc', 120);
      burst(cx, cy, '#c084fc', 28, 4.2);
      addFloatText(cx, cy - 22, 'CHRONO PHANTOM!', '#e879f9', 1.2);
    } else {
      ship.boostTimer = 42;
      ship.invuln = Math.max(ship.invuln, 46);
      shake = Math.max(shake, 8);
      sound('boost');
      addShock(cx, cy, '#22d3ee', 86);
      burst(cx, cy + 16, '#38bdf8', 26, 4.5);
      addFloatText(cx, cy - 22, 'TWIN RAILGUN!', '#22d3ee', 1.2);
    }
  }

  boostBtn.onclick = e => { e.stopPropagation(); triggerBoost(); };

  window.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (UBG.state === 'PLAYING') triggerBoost();
  });

  window.addEventListener('keydown', e => {
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
      if (UBG.state === 'PLAYING') { e.preventDefault(); setPause(true); }
      else if (UBG.state === 'PAUSED') { e.preventDefault(); setPause(false); }
    } else if (e.key === 'Shift') {
      if (UBG.state === 'PLAYING') { e.preventDefault(); triggerBoost(); }
    }
  });

  function inputPos(e) {
    const r = canvas.getBoundingClientRect();
    UBG.pointer.x = clamp((e.clientX - r.left) * W / r.width, 0, W);
    UBG.pointer.y = clamp((e.clientY - r.top) * H / r.height, 65, H);
  }

  window.addEventListener('pointermove', inputPos);
  window.addEventListener('pointerdown', e => {
    if (UBG.state !== 'PLAYING' || e.target.closest('button')) return;
    if (e.button === 2) { triggerBoost(); return; }
    inputPos(e);
  });

  function resetWorld() {
    const spec = SHIP_SPECS[selectedShip] || SHIP_SPECS.viper;
    UBG.score = 0; UBG.best = 0; grazeCount = 0; maxCombo = 1; bossesKilled = 0;
    shake = 0; combo = 0; comboLeft = 0; gridScroll = 0;
    spawnClock = 40; asteroidClock = 55; orbClock = 380; grazeSoundCool = 0; laserTick = 0; eventClock = 640; missileClock = 0;
    UBG.time = 0; warning = 0; UBG.boss = null; bossLevel = 1; bossAt = 240; UBG.bossEnragedBanner = 0; UBG.bgmStep = 0;
    slowMoTimer = 0; cosmicEvent = null;
    try { UBG.best = Number(localStorage.getItem('ubg_best') || 0) || 0; } catch (e) {}
    UBG.ship = {
      type: selectedShip,
      spec,
      x: W / 2 - 23, y: H - 110, w: 46, h: 55,
      shield: spec.startShield, rapid: 0, speed: 0, beam: 0, drone: 0, droneAngle: 0,
      invuln: 150, cool: 0, boostEnergy: 50, boostTimer: 0,
      mods: { extraGuns: 0, fireRateMult: 1, damageMult: 1, magnetRange: 0, boostChargeMult: 1, missiles: 0 }
    };
    enemies = []; bullets = []; shots = []; missiles = []; asteroids = [];
    particles = []; sparks = []; shocks = []; floatTexts = []; pickups = []; UBG.trail = [];
    stars = Array.from({ length: 220 }, () => ({
      x: rand(0, W), y: rand(0, H), r: rand(0.5, 2), v: rand(0.35, 2), a: rand(0.2, 0.95), tw: rand(0.003, 0.016)
    }));
  }

  function startGame() {
    resetWorld();
    UBG.state = 'PLAYING';
    menu.style.display = 'none';
    settings.style.display = 'none';
    pauseOverlay.style.display = 'none';
    upgradeOverlay.style.display = 'none';
    over.style.display = 'none';
    warningEl.style.display = 'none';
    pauseBtn.style.display = 'block';
    boostBtn.style.display = 'block';
    canvas.style.cursor = 'crosshair';
    last = performance.now();
    updateBgmLoop();
  }

  function gameOver() {
    if (UBG.state !== 'PLAYING') return;
    UBG.state = 'GAMEOVER';
    pauseBtn.style.display = 'none';
    boostBtn.style.display = 'none';
    upgradeOverlay.style.display = 'none';
    canvas.style.cursor = 'default';
    shake = 18;
    sound('boom');
    addShock(UBG.ship.x + UBG.ship.w / 2, UBG.ship.y + UBG.ship.h / 2, '#fb376b', 95);
    updateBgmLoop();
    if (UBG.score > UBG.best) {
      UBG.best = Math.floor(UBG.score);
      try { localStorage.setItem('ubg_best', String(UBG.best)); } catch (e) {}
    }
    $('ubg-final').textContent = Math.floor(UBG.score);
    $('ubg-stats-over').textContent = `GRAZE: ${grazeCount} · MAX COMBO: x${maxCombo} · BOSS HẠ: ${bossesKilled}`;
    $('ubg-best-over').textContent = UBG.best;
    $('ubg-best-menu').textContent = UBG.best;
    setTimeout(() => { if (UBG.state === 'GAMEOVER') over.style.display = 'flex'; }, 350);
  }

  function burst(x, y, color, n = 16, power = 3) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), v = rand(0.5, power);
      const isDebris = i % 3 === 0;
      particles.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: rand(22, 48),
        max: 48,
        r: rand(1.4, isDebris ? 4.8 : 3.6),
        color: i % 5 === 0 ? '#ffffff' : color,
        kind: isDebris ? 'shard' : 'glow',
        rot: rand(0, Math.PI * 2),
        vRot: rand(-0.18, 0.18)
      });
    }
  }

  function addPickup(x, y, type) {
    pickups.push({ x, y, type, vy: 1.5, phase: rand(0, 6), r: 11 });
  }

  function killEnemy(index) {
    const e = enemies[index];
    if (!e) return;
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    const heavy = e.type === 'HEAVY' || e.elite;
    burst(cx, cy, e.elite ? '#facc15' : e.color, heavy ? 36 : 22, heavy ? 4.5 : 3.8);
    hitEffect(cx, cy, e.elite ? '#facc15' : e.color, heavy);
    addShock(cx, cy, e.elite ? '#facc15' : e.color, heavy ? 68 : 42);
    if (heavy) addShock(cx, cy, '#ffffff', 42);
    sound('boom');
    enemies.splice(index, 1);
    combo++;
    if (combo > maxCombo) maxCombo = combo;
    comboLeft = 210;
    const eventMult = cosmicEvent?.type === 'METEOR' ? 1.5 : 1;
    const gained = Math.round(e.points * Math.min(combo, 8) * eventMult);
    UBG.score += gained;
    addFloatText(cx, cy - 8, (e.elite ? '★ +' : '+') + gained + (combo > 1 ? ' x' + combo : ''), e.elite ? '#facc15' : (combo > 1 ? '#facc15' : '#e2e8f0'), heavy ? 1.2 : 1);
    const ship = UBG.ship;
    if (ship) {
      ship.boostEnergy = Math.min(100, ship.boostEnergy + (e.elite ? 28 : (heavy ? 11 : 6)) * ship.spec.boostGainMult * ship.mods.boostChargeMult);
    }
    if (combo > 1) sound('combo');
    if (e.elite) {
      addPickup(cx - 14, cy, ['rapid', 'shield', 'speed', 'beam', 'drone'][Math.floor(Math.random() * 5)]);
      addPickup(cx + 14, cy, 'boost');
    } else if (Math.random() < e.drop) {
      addPickup(cx, cy, ['rapid', 'shield', 'speed', 'beam', 'drone'][Math.floor(Math.random() * 5)]);
    }
  }

  function spawnEnemy() {
    const roll = Math.random();
    const type = roll < 0.48 ? 'SCOUT' : roll < 0.82 ? 'STRIKER' : 'HEAVY';
    const isElite = UBG.score >= 100 && Math.random() < 0.2;
    const data = type === 'SCOUT'
      ? [40, 38, 2, 1.9, 5, 0.25, '#34d399']
      : type === 'STRIKER'
        ? [48, 48, 3, 1.35, 9, 0.38, '#e879f9']
        : [66, 56, 6, 0.9, 16, 0.55, '#fb923c'];
    let [w, h, hp, vy, points, drop, color] = data;
    if (isElite) {
      w = Math.round(w * 1.22);
      h = Math.round(h * 1.22);
      hp = Math.round(hp * 2.5);
      points *= 3;
      drop = 1;
    }
    enemies.push({
      type, elite: isElite,
      x: rand(45, W - w - 45), y: -h - 5, w, h,
      hp, maxHp: hp, vy: vy + Math.min(UBG.score / 1700, 0.8),
      phase: rand(0, 6), fire: rand(65, 120), points, drop, color, hitFlash: 0
    });
  }

  function spawnAsteroid() {
    const r = rand(12, 27);
    const craters = Array.from({ length: 4 }, () => ({
      dx: rand(-r * 0.38, r * 0.38),
      dy: rand(-r * 0.38, r * 0.38),
      cr: rand(r * 0.11, r * 0.22)
    }));
    const cracks = Array.from({ length: 2 }, () => ({
      a1: rand(0, Math.PI * 2),
      a2: rand(0, Math.PI * 2),
      len: rand(r * 0.45, r * 0.72)
    }));
    const meteorStorm = cosmicEvent?.type === 'METEOR';
    asteroids.push({
      x: rand(r, W - r),
      y: -r,
      r,
      vy: rand(1.5, 3.1) * (meteorStorm ? 1.55 : 1),
      vx: rand(-0.6, 0.6) * (meteorStorm ? 1.6 : 1),
      rot: rand(0, 6),
      spin: rand(-0.04, 0.04),
      hp: r > 21 ? 3 : 2,
      craters,
      cracks
    });
  }

  function triggerCosmicEvent() {
    if (UBG.boss || warning > 0 || cosmicEvent) return;
    if (Math.random() < 0.55) {
      cosmicEvent = { type: 'METEOR', timer: 420, label: '☄ BÃO THIÊN THẠCH — THƯỞNG ĐIỂM x2', color: '#fb923c' };
      sound('warning');
    } else {
      cosmicEvent = { type: 'ION', timer: 300, label: '⚡ BÃO NĂNG LƯỢNG ION — +30% OVERDRIVE', color: '#38bdf8' };
      UBG.ship.boostEnergy = Math.min(100, UBG.ship.boostEnergy + 30);
      addPickup(W * 0.35, -10, 'rapid');
      addPickup(W * 0.65, -10, 'shield');
      sound('pickup');
    }
  }

  function fire() {
    const ship = UBG.ship;
    if (ship.cool > 0) return;
    const rapid = ship.rapid > 0, hyper = ship.speed > 0;
    const viperOverdrive = ship.type === 'viper' && ship.boostTimer > 0;
    const speed = rapid || viperOverdrive ? 15.8 : 13.8;
    const damage = ship.spec.baseDamage * ship.mods.damageMult * (hyper ? 1.85 : 1);
    const cx = ship.x + ship.w / 2, sy = ship.y + 4;

    const baseSpread = ship.spec.pattern === 'spread3'
      ? (rapid ? [-20, -10, 0, 10, 20] : [-15, 0, 15])
      : (rapid ? [-17, -6, 6, 17] : [-13, 13]);

    const bulletCol = hyper ? '#facc15' : rapid ? '#22d3ee' : ship.spec.primary;
    const coreCol = hyper ? '#fef9c3' : '#ffffff';

    baseSpread.forEach(off => {
      shots.push({
        x: cx + off,
        y: sy,
        vx: off * (ship.spec.pattern === 'spread3' ? 0.045 : 0.012),
        vy: -speed,
        damage,
        color: bulletCol,
        core: coreCol
      });
    });

    if (ship.type === 'phantom' && ship.boostTimer > 0) {
      [-58, 58].forEach(cloneOff => {
        shots.push({
          x: cx + cloneOff,
          y: sy + 8,
          vx: 0,
          vy: -speed,
          damage: damage * 0.75,
          color: '#e879f9',
          core: '#fae8ff'
        });
      });
    }

    for (let g = 1; g <= ship.mods.extraGuns; g++) {
      const off = 18 + g * 7;
      [-off, off].forEach(dx => {
        shots.push({
          x: cx + dx,
          y: sy + 6,
          vx: dx * 0.055,
          vy: -speed * 0.96,
          damage: damage * 0.85,
          color: '#38bdf8',
          core: '#e0f2fe'
        });
      });
    }

    if (ship.drone > 0) {
      for (let i = 0; i < 2; i++) {
        const a = ship.droneAngle + i * Math.PI;
        shots.push({
          x: cx + Math.cos(a) * 48,
          y: ship.y + ship.h / 2 + Math.sin(a) * 25,
          vx: 0,
          vy: -14,
          damage: damage * 0.8,
          color: '#4ade80',
          core: '#dcfce7'
        });
      }
    }
    const baseCd = rapid ? ship.spec.baseCool * 0.62 : ship.spec.baseCool;
    ship.cool = Math.max(3.5, baseCd * ship.mods.fireRateMult * (viperOverdrive ? 0.52 : 1));
    sound('shot');
  }

  function enemyFire(e) {
    const ship = UBG.ship;
    const sx = e.x + e.w / 2, sy = e.y + e.h - 2, tx = ship.x + ship.w / 2, ty = ship.y + ship.h / 2;
    const a = Math.atan2(ty - sy, tx - sx), v = 3.5 + Math.min(UBG.score / 900, 1.8);
    if (e.elite) {
      [-0.22, 0, 0.22].forEach(d => bullets.push({ x: sx, y: sy, vx: Math.cos(a + d) * (v * 1.08), vy: Math.sin(a + d) * (v * 1.08), r: 5.5, color: '#facc15', core: '#fef9c3', grazed: false }));
      return;
    }
    if (e.type === 'SCOUT') bullets.push({ x: sx, y: sy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 4.5, color: '#34d399', core: '#d1fae5', grazed: false });
    else if (e.type === 'STRIKER') { [-0.16, 0.16].forEach(d => bullets.push({ x: sx, y: sy, vx: Math.cos(a + d) * v, vy: Math.sin(a + d) * v, r: 5, color: '#e879f9', core: '#fae8ff', grazed: false })); }
    else { [-0.25, 0, 0.25].forEach(d => bullets.push({ x: sx, y: sy, vx: Math.cos(a + d) * v, vy: Math.sin(a + d) * v, r: 5.5, color: '#fb923c', core: '#ffedd5', grazed: false })); }
  }

  function spawnBoss() {
    const hp = 220 + (bossLevel - 1) * 105;
    const mod = bossLevel % 3;
    const kind = mod === 0 ? 'DREADNOUGHT' : (mod === 2 ? 'VORTEX' : 'FLAGSHIP');
    const isDread = kind === 'DREADNOUGHT';
    const w = isDread ? 340 : 210;
    const h = isDread ? 155 : 145;
    const turretHp = Math.round(hp * 0.28);

    UBG.boss = {
      kind,
      x: W / 2 - w / 2,
      y: -h - 20,
      w,
      h,
      target: 85,
      vx: (isDread ? 1.65 : (kind === 'VORTEX' ? 2.6 : 2.2)) + bossLevel * 0.16,
      hp,
      maxHp: hp,
      fire: 68,
      volleyCount: 0,
      spiralAngle: 0,
      telegraphTimer: 0,
      sweepX: W / 2,
      angle: 0,
      flash: 0,
      level: bossLevel,
      wasEnraged: false,
      turrets: isDread ? [
        { dx: -125, dy: 12, w: 54, h: 48, hp: turretHp, maxHp: turretHp, flash: 0, fire: 48, destroyed: false },
        { dx: 125, dy: 12, w: 54, h: 48, hp: turretHp, maxHp: turretHp, flash: 0, fire: 76, destroyed: false }
      ] : null
    };
    sound('boss');
    updateBgmLoop();
  }

  function bossDeath() {
    const b = UBG.boss;
    if (!b) return;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const isDread = b.kind === 'DREADNOUGHT';
    const mainCol = isDread ? '#ef4444' : (b.kind === 'VORTEX' ? '#c084fc' : '#facc15');
    const bonusPts = isDread ? 220 : 140;

    if (b.turrets) {
      b.turrets.forEach(t => {
        if (t.hp > 0) {
          burst(cx + t.dx, cy + t.dy, '#f59e0b', 28, 4.5);
          addShock(cx + t.dx, cy + t.dy, '#f59e0b', 68);
        }
      });
    }

    burst(cx, cy, mainCol, isDread ? 130 : 95, isDread ? 7.2 : 6.2);
    burst(cx, cy, '#22d3ee', 75, 5.4);
    hitEffect(cx, cy, mainCol, true);
    addShock(cx, cy, mainCol, isDread ? 175 : 136);
    addShock(cx, cy, '#22d3ee', 110);
    addFloatText(cx, cy - 16, `+${bonusPts} ${b.kind} DOWN!`, '#facc15', 1.38);
    addPickup(cx - 38, cy, 'rapid');
    addPickup(cx + 38, cy, 'beam');
    if (isDread) addPickup(cx, cy + 12, 'boost');
    UBG.score += bonusPts;
    bossesKilled++;
    UBG.boss = null;
    bossLevel++;
    bossAt = UBG.score + 300;
    shake = isDread ? 30 : 25;
    sound('boom');
    openUpgradeDraft();
  }

  function hitPlayer(x, y) {
    const ship = UBG.ship;
    if (ship.invuln > 0) return;
    if (ship.shield > 0) {
      ship.shield = 0;
      ship.invuln = 85;
      slowMoTimer = 72;
      burst(x, y, '#22d3ee', 32, 4.4);
      addShock(x, y, '#22d3ee', 92);
      addFloatText(x, y - 14, 'SHIELD CLUTCH! SLOW-MO', '#67e8f9', 1.05);
      bullets = bullets.filter(b => Math.hypot(b.x - x, b.y - y) > 105);
      sound('clutch');
      return;
    }
    gameOver();
  }

  function update(rawDt) {
    if (UBG.state === 'PAUSED' || UBG.state === 'UPGRADE') return;
    const ship = UBG.ship;
    const chronoSlow = (ship?.type === 'phantom' && ship?.boostTimer > 0) ? 0.28 : 1;
    const timeScale = (slowMoTimer > 0 ? 0.38 : 1) * chronoSlow;
    const dt = rawDt * timeScale;
    const playerDt = rawDt * (slowMoTimer > 0 ? 0.55 : 1);
    if (slowMoTimer > 0) slowMoTimer = Math.max(0, slowMoTimer - rawDt);

    UBG.time += dt;
    const boosting = ship?.boostTimer > 0;
    const speedMult = (ship?.speed > 0 ? 1.8 : 1) * (boosting ? 2.2 : 1);
    gridScroll = (gridScroll + 0.8 * dt * speedMult) % 52;
    grazeSoundCool = Math.max(0, grazeSoundCool - dt);
    UBG.bossEnragedBanner = Math.max(0, UBG.bossEnragedBanner - dt);

    stars.forEach(s => {
      s.y += s.v * dt * speedMult;
      s.a += s.tw * dt;
      if (s.a > 0.95 || s.a < 0.15) s.tw *= -1;
      if (s.y > H) { s.y = 0; s.x = rand(0, W); }
    });

    particles.forEach(p => {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= Math.pow(0.985, dt); p.vy *= Math.pow(0.985, dt);
      if (p.rot !== undefined) p.rot += p.vRot * dt;
      p.life -= dt;
    });
    particles = particles.filter(p => p.life > 0);

    sparks.forEach(sp => {
      sp.x += sp.vx * dt; sp.y += sp.vy * dt;
      sp.vx *= Math.pow(0.92, dt); sp.vy *= Math.pow(0.92, dt);
      sp.life -= dt;
    });
    sparks = sparks.filter(sp => sp.life > 0);

    shocks.forEach(w => {
      w.r += (w.maxR - w.r) * (1 - Math.pow(0.84, dt));
      w.alpha -= 0.03 * dt;
    });
    shocks = shocks.filter(w => w.alpha > 0.02);

    floatTexts.forEach(ft => {
      ft.y += ft.vy * playerDt;
      ft.vy *= Math.pow(0.95, playerDt);
      ft.life -= playerDt;
    });
    floatTexts = floatTexts.filter(ft => ft.life > 0);

    if (UBG.state !== 'PLAYING') return;

    ship.invuln = Math.max(0, ship.invuln - playerDt);
    ship.rapid = Math.max(0, ship.rapid - playerDt);
    ship.speed = Math.max(0, ship.speed - playerDt);
    ship.beam = Math.max(0, ship.beam - playerDt);
    ship.drone = Math.max(0, ship.drone - playerDt);
    ship.boostTimer = Math.max(0, ship.boostTimer - playerDt);
    ship.boostEnergy = Math.min(100, ship.boostEnergy + 0.13 * playerDt * ship.spec.boostGainMult * ship.mods.boostChargeMult);
    if (ship.cool > 0) ship.cool -= playerDt;
    if (comboLeft > 0) { comboLeft -= dt; if (comboLeft <= 0) combo = 0; }

    const tx = clamp(UBG.pointer.x - ship.w / 2, 0, W - ship.w);
    const ty = clamp(UBG.pointer.y - ship.h / 2, 75, H - ship.h);
    const smooth = boosting ? (1 - Math.pow(0.52, rawDt)) : (1 - Math.pow(ship.spec.smoothRate, rawDt));
    ship.x += (tx - ship.x) * smooth;
    ship.y += (ty - ship.y) * smooth;

    fire();

    if (ship.mods.missiles > 0) {
      missileClock -= playerDt;
      if (missileClock <= 0 && (enemies.length > 0 || UBG.boss)) {
        const cx = ship.x + ship.w / 2, cy = ship.y + 12;
        for (let m = 0; m < ship.mods.missiles; m++) {
          const spread = (m - (ship.mods.missiles - 1) / 2) * 0.35;
          spawnMissile(cx + (m % 2 === 0 ? -18 : 18), cy, spread, 1);
        }
        sound('missile');
        missileClock = 52;
      }
    }

    if (cosmicEvent) {
      cosmicEvent.timer -= dt;
      if (cosmicEvent.timer <= 0) cosmicEvent = null;
    } else if (!UBG.boss && warning === 0) {
      eventClock -= dt;
      if (eventClock <= 0) {
        triggerCosmicEvent();
        eventClock = rand(760, 980);
      }
    }

    if (!UBG.boss && warning === 0 && UBG.score >= bossAt) { warning = 150; cosmicEvent = null; sound('warning'); }
    if (warning > 0) {
      warning -= dt;
      warningEl.style.display = warning < 100 && Math.floor(UBG.time / 7) % 2 === 0 ? 'block' : 'none';
      if (warning <= 0) { warning = 0; warningEl.style.display = 'none'; spawnBoss(); }
    } else {
      warningEl.style.display = 'none';
    }

    if (!UBG.boss && warning === 0) {
      const isMeteorStorm = cosmicEvent?.type === 'METEOR';
      if (!isMeteorStorm) {
        spawnClock -= dt;
        if (spawnClock <= 0 && enemies.length < 9) {
          spawnEnemy();
          spawnClock = Math.max(22, 62 - UBG.score * 0.035);
        }
      }
      asteroidClock -= dt;
      if (asteroidClock <= 0) {
        spawnAsteroid();
        asteroidClock = isMeteorStorm ? rand(8, 15) : rand(30, 54);
      }
    }

    orbClock -= dt;
    if (orbClock <= 0 && pickups.length < 4) {
      addPickup(rand(45, W - 45), -10, ['rapid', 'shield', 'speed', 'beam', 'drone'][Math.floor(Math.random() * 5)]);
      orbClock = rand(360, 500);
    }

    shots.forEach(s => { s.x += s.vx * playerDt; s.y += s.vy * playerDt; });
    shots = shots.filter(s => s.y > -30 && s.x > -30 && s.x < W + 30);

    // Cập nhật Tên lửa tầm nhiệt (tự khóa mục tiêu gần nhất kể cả pháo đài cánh Boss)
    for (let i = missiles.length - 1; i >= 0; i--) {
      const m = missiles[i];
      m.life -= playerDt;
      m.trail.push({ x: m.x, y: m.y });
      if (m.trail.length > 10) m.trail.shift();

      let targetX = null, targetY = null, bestDist = Infinity;
      enemies.forEach(e => {
        const d = Math.hypot(e.x + e.w / 2 - m.x, e.y + e.h / 2 - m.y);
        if (d < bestDist) { bestDist = d; targetX = e.x + e.w / 2; targetY = e.y + e.h / 2; }
      });
      if (UBG.boss) {
        const bcx = UBG.boss.x + UBG.boss.w / 2, bcy = UBG.boss.y + UBG.boss.h / 2;
        if (UBG.boss.turrets) {
          UBG.boss.turrets.forEach(t => {
            if (t.hp > 0) {
              const td = Math.hypot(bcx + t.dx - m.x, bcy + t.dy - m.y);
              if (td < bestDist) { bestDist = td; targetX = bcx + t.dx; targetY = bcy + t.dy; }
            }
          });
        }
        const bd = Math.hypot(bcx - m.x, bcy - m.y);
        if (bd < bestDist) { targetX = bcx; targetY = bcy; }
      }

      if (targetX !== null) {
        const desired = Math.atan2(targetY - m.y, targetX - m.x);
        let diff = desired - m.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        m.angle += clamp(diff, -0.11 * playerDt, 0.11 * playerDt);
      }

      m.x += Math.cos(m.angle) * m.speed * playerDt;
      m.y += Math.sin(m.angle) * m.speed * playerDt;

      let detonated = false;
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        if (Math.hypot(e.x + e.w / 2 - m.x, e.y + e.h / 2 - m.y) < Math.max(e.w, e.h) * 0.55 + 10) {
          detonated = true;
          break;
        }
      }
      if (!detonated && UBG.boss && m.x > UBG.boss.x && m.x < UBG.boss.x + UBG.boss.w && m.y > UBG.boss.y && m.y < UBG.boss.y + UBG.boss.h) {
        detonated = true;
      }

      if (detonated) {
        burst(m.x, m.y, '#fb7185', 16, 3.6);
        addShock(m.x, m.y, '#fb7185', 56);
        sound('hit');
        for (let j = enemies.length - 1; j >= 0; j--) {
          const e = enemies[j];
          const d = Math.hypot(e.x + e.w / 2 - m.x, e.y + e.h / 2 - m.y);
          if (d < 68) {
            e.hp -= d < 32 ? m.damage : m.damage * 0.55;
            e.hitFlash = 4;
            if (e.hp <= 0) killEnemy(j);
          }
        }
        if (UBG.boss) {
          const b = UBG.boss;
          const bcx = b.x + b.w / 2, bcy = b.y + b.h / 2;
          if (b.turrets) {
            b.turrets.forEach(t => {
              if (t.hp > 0 && Math.hypot(bcx + t.dx - m.x, bcy + t.dy - m.y) < 62) {
                t.hp -= m.damage;
                t.flash = 4;
                if (t.hp <= 0) destroyTurret(b, t);
              }
            });
          }
          if (UBG.boss && Math.hypot(bcx - m.x, bcy - m.y) < (b.kind === 'DREADNOUGHT' ? 145 : 120)) {
            b.hp -= m.damage * getBossDamageMult(b);
            b.flash = 4;
            if (b.hp <= 0) bossDeath();
          }
        }
        missiles.splice(i, 1);
        continue;
      }

      if (m.life <= 0 || m.y < -40 || m.y > H + 40 || m.x < -40 || m.x > W + 40) missiles.splice(i, 1);
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      e.y += e.vy * dt;
      e.phase += 0.045 * dt;
      e.x = clamp(e.x + Math.sin(e.phase) * 1.8 * dt, 10, W - e.w - 10);
      e.fire -= dt;
      e.hitFlash = Math.max(0, (e.hitFlash || 0) - dt);
      if (e.fire <= 0 && e.y > 30 && e.y < H - 150) {
        enemyFire(e);
        e.fire = e.type === 'SCOUT' ? 95 : e.type === 'STRIKER' ? 110 : 135;
      }
      let dead = false;
      for (let j = shots.length - 1; j >= 0; j--) {
        const s = shots[j];
        if (s.x > e.x - 5 && s.x < e.x + e.w + 5 && s.y > e.y - 5 && s.y < e.y + e.h + 5) {
          e.hp -= s.damage;
          e.hitFlash = 4;
          shots.splice(j, 1);
          hitEffect(s.x, s.y, e.color, e.type === 'HEAVY');
          if (e.hp <= 0) { killEnemy(i); dead = true; }
          else sound('hit');
          break;
        }
      }
      if (dead) continue;
      if (Math.hypot(e.x + e.w / 2 - (ship.x + ship.w / 2), e.y + e.h / 2 - (ship.y + ship.h / 2)) < Math.min(e.w, e.h) * 0.55 + 12) {
        if (boosting) {
          e.hp -= 4 * playerDt;
          e.hitFlash = 3;
          hitEffect(e.x + e.w / 2, e.y + e.h / 2, '#38bdf8', false);
          if (e.hp <= 0) killEnemy(i);
        } else {
          enemies.splice(i, 1);
          hitPlayer(e.x + e.w / 2, e.y + e.h / 2);
        }
        continue;
      }
      if (e.y > H + 30) enemies.splice(i, 1);
    }

    if (UBG.boss) {
      const b = UBG.boss;
      if (b.y < b.target) b.y += 1.6 * dt;
      else { b.x += b.vx * dt; if (b.x < 22 || b.x + b.w > W - 22) b.vx *= -1; }
      b.angle += 0.035 * dt;
      b.spiralAngle += (b.hp < b.maxHp * 0.48 ? 0.24 : 0.16) * dt;
      b.fire -= dt;
      b.flash = Math.max(0, b.flash - dt);

      const enragedNow = b.hp < b.maxHp * 0.48;
      if (enragedNow && !b.wasEnraged) {
        b.wasEnraged = true;
        UBG.bossEnragedBanner = 95;
        addShock(b.x + b.w / 2, b.y + b.h / 2, '#fb376b', 125);
        shake = Math.max(shake, 11);
      }

      // Cập nhật & khai hỏa 2 Pháo Đài Cánh của Dreadnought
      if (b.turrets) {
        const bcx = b.x + b.w / 2, bcy = b.y + b.h / 2;
        b.turrets.forEach(t => {
          t.flash = Math.max(0, t.flash - dt);
          if (t.hp > 0 && b.y >= b.target) {
            t.fire -= dt;
            if (t.fire <= 0) {
              const tx = bcx + t.dx, ty = bcy + t.dy + 12;
              const aim = Math.atan2((ship.y + ship.h / 2) - ty, (ship.x + ship.w / 2) - tx);
              const spd = enragedNow ? 4.6 : 4.1;
              if (!enragedNow) {
                [-0.1, 0.1].forEach(off => {
                  bullets.push({ x: tx, y: ty, vx: Math.cos(aim + off) * spd, vy: Math.sin(aim + off) * spd, r: 5, color: '#f59e0b', core: '#fef08a', grazed: false });
                });
                t.fire = 64;
              } else {
                [-0.2, 0, 0.2].forEach(off => {
                  bullets.push({ x: tx, y: ty, vx: Math.cos(aim + off) * spd, vy: Math.sin(aim + off) * spd, r: 5.5, color: '#fb923c', core: '#fef08a', grazed: false });
                });
                t.fire = 44;
              }
            }
          }
        });
      }

      if (b.kind === 'VORTEX' && b.telegraphTimer > 0) {
        b.telegraphTimer -= dt;
        if (b.telegraphTimer <= 0) {
          b.telegraphTimer = 0;
          const cx = b.x + b.w / 2, cy = b.y + b.h - 10;
          for (let py = cy + 12; py < H - 15; py += 26) {
            const ang = Math.atan2(py - cy, b.sweepX - cx);
            bullets.push({
              x: b.sweepX + rand(-8, 8),
              y: py,
              vx: Math.cos(ang) * 0.5,
              vy: 4.6,
              r: 5.5,
              color: enragedNow ? '#fb7185' : '#c084fc',
              core: '#fae8ff',
              grazed: false
            });
          }
          addShock(b.sweepX, cy + 40, enragedNow ? '#fb7185' : '#c084fc', 64);
          shake = Math.max(shake, 8);
        }
      }

      if (b.fire <= 0 && b.y >= b.target) {
        const cx = b.x + b.w / 2, cy = b.y + b.h - 8;
        if (b.kind === 'DREADNOUGHT') {
          b.volleyCount = (b.volleyCount || 0) + 1;
          if (b.volleyCount % 2 === 1) {
            // Quạt đạn pháo hạng nặng từ pháo đài trung tâm
            const spreadCount = enragedNow ? 5 : 4;
            for (let k = -spreadCount; k <= spreadCount; k++) {
              const a = Math.PI / 2 + k * 0.17;
              bullets.push({
                x: cx,
                y: cy - 12,
                vx: Math.cos(a) * 4.1,
                vy: Math.sin(a) * 4.1,
                r: 6.5,
                color: '#ef4444',
                core: '#fee2e2',
                grazed: false
              });
            }
          } else {
            // Loạt đạn đôi xuyên tâm ép góc
            [-36, 0, 36].forEach(off => {
              bullets.push({
                x: cx + off,
                y: cy - 10,
                vx: off * 0.015,
                vy: enragedNow ? 5.2 : 4.5,
                r: 6,
                color: '#fb7185',
                core: '#ffe4e6',
                grazed: false
              });
            });
          }
          b.fire = enragedNow ? 36 : 56;
        } else if (b.kind === 'VORTEX') {
          const arms = enragedNow ? 8 : 6;
          for (let k = 0; k < arms; k++) {
            const a = b.spiralAngle + (k * Math.PI * 2) / arms;
            bullets.push({
              x: cx,
              y: cy - 20,
              vx: Math.cos(a) * 3.9,
              vy: Math.sin(a) * 3.9 + 0.7,
              r: 5.5,
              color: enragedNow ? '#f43f5e' : '#c084fc',
              core: '#fae8ff',
              grazed: false
            });
          }
          if (b.telegraphTimer <= 0) {
            b.telegraphTimer = 38;
            b.sweepX = clamp(ship.x + ship.w / 2, 45, W - 45);
            sound('telegraph');
          }
          b.fire = enragedNow ? 22 : 34;
        } else {
          if (!enragedNow) {
            for (let k = -4; k <= 4; k++) {
              const a = Math.PI / 2 + k * 0.19;
              bullets.push({ x: cx, y: cy, vx: Math.cos(a) * 4.2, vy: Math.sin(a) * 4.2, r: 6.5, color: '#fb7185', core: '#ffe4e6', grazed: false });
            }
            [-72, 72].forEach(off => {
              const a = Math.atan2(ship.y + ship.h / 2 - (cy - 35), ship.x + ship.w / 2 - (cx + off));
              bullets.push({ x: cx + off, y: cy - 35, vx: Math.cos(a) * 4.5, vy: Math.sin(a) * 4.5, r: 5.5, color: '#facc15', core: '#fef9c3', grazed: false });
            });
            b.fire = Math.max(42, 78 - b.level * 4);
          } else {
            for (let k = 0; k < 10; k++) {
              const a = b.angle + (k * Math.PI * 2) / 10;
              bullets.push({ x: cx, y: cy - 25, vx: Math.cos(a) * 4.3, vy: Math.sin(a) * 4.3, r: 6, color: '#f43f5e', core: '#ffe4e6', grazed: false });
            }
            b.fire = 18;
          }
        }
      }

      // Kiểm tra va chạm đạn người chơi với 2 Pháo Đài Cánh trước, sau đó mới đến thân chính
      for (let j = shots.length - 1; j >= 0; j--) {
        const s = shots[j];
        let hitTurret = false;
        if (b.turrets) {
          const bcx = b.x + b.w / 2, bcy = b.y + b.h / 2;
          for (const t of b.turrets) {
            if (t.hp > 0) {
              const tx = bcx + t.dx, ty = bcy + t.dy;
              if (Math.abs(s.x - tx) < t.w / 2 + 5 && Math.abs(s.y - ty) < t.h / 2 + 5) {
                t.hp -= s.damage;
                t.flash = 4;
                shots.splice(j, 1);
                hitEffect(s.x, s.y, '#f59e0b', false);
                if (t.hp <= 0) destroyTurret(b, t);
                else sound('hit');
                hitTurret = true;
                break;
              }
            }
          }
        }
        if (hitTurret) continue;

        const padX = b.kind === 'DREADNOUGHT' ? 76 : 8;
        if (s.x > b.x + padX && s.x < b.x + b.w - padX && s.y > b.y + 5 && s.y < b.y + b.h - 5) {
          b.hp -= s.damage * getBossDamageMult(b);
          b.flash = 4;
          shots.splice(j, 1);
          const col = b.kind === 'DREADNOUGHT' ? '#ef4444' : (b.kind === 'VORTEX' ? '#c084fc' : '#38bdf8');
          hitEffect(s.x, s.y, col, true);
          if (b.hp <= 0) { bossDeath(); break; }
        }
      }

      if (UBG.boss && !boosting) {
        const hitHalfW = b.kind === 'DREADNOUGHT' ? 148 : 85;
        if (Math.abs((b.x + b.w / 2) - (ship.x + ship.w / 2)) < hitHalfW && Math.abs((b.y + b.h / 2) - (ship.y + ship.h / 2)) < 75) {
          hitPlayer(ship.x + ship.w / 2, ship.y + ship.h / 2);
        }
      }
    }

    const scx = ship.x + ship.w / 2, scy = ship.y + ship.h / 2;
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt;
      const dist = Math.hypot(b.x - scx, b.y - scy);
      if (dist < b.r + ship.spec.hitboxR) {
        bullets.splice(i, 1);
        if (!boosting) hitPlayer(b.x, b.y);
        else hitEffect(b.x, b.y, '#38bdf8', false);
        continue;
      }
      if (!b.grazed && dist < b.r + ship.spec.grazeR && ship.invuln <= 0) {
        b.grazed = true;
        grazeCount++;
        UBG.score += ship.spec.grazeScore;
        ship.boostEnergy = Math.min(100, ship.boostEnergy + 1.6 * ship.spec.boostGainMult * ship.mods.boostChargeMult);
        if (grazeSoundCool <= 0) { sound('graze'); grazeSoundCool = 5; }
        sparks.push({
          x: (b.x + scx) / 2,
          y: (b.y + scy) / 2,
          vx: rand(-2.2, 2.2),
          vy: rand(-2.2, 2.2),
          len: 8,
          life: 12,
          max: 12,
          color: ship.spec.primary
        });
      }
      if (b.y > H + 25 || b.y < -25 || b.x < -25 || b.x > W + 25) bullets.splice(i, 1);
    }

    for (let i = asteroids.length - 1; i >= 0; i--) {
      const a = asteroids[i];
      a.x += a.vx * dt; a.y += a.vy * dt; a.rot += a.spin * dt;
      let destroyed = false;
      for (let j = shots.length - 1; j >= 0; j--) {
        const s = shots[j];
        if (Math.hypot(a.x - s.x, a.y - s.y) < a.r + 4) {
          a.hp -= s.damage;
          shots.splice(j, 1);
          hitEffect(s.x, s.y, '#cbd5e1', false);
          if (a.hp <= 0) {
            const pts = cosmicEvent?.type === 'METEOR' ? 6 : 2;
            burst(a.x, a.y, '#94a3b8', 22, 3.4);
            addShock(a.x, a.y, '#94a3b8', a.r * 2.2);
            addFloatText(a.x, a.y, '+' + pts, cosmicEvent?.type === 'METEOR' ? '#fb923c' : '#cbd5e1', 0.95);
            UBG.score += pts;
            asteroids.splice(i, 1);
            destroyed = true;
          }
          break;
        }
      }
      if (destroyed) continue;
      if (Math.hypot(a.x - scx, a.y - scy) < a.r + 12) {
        asteroids.splice(i, 1);
        if (boosting) {
          burst(a.x, a.y, '#38bdf8', 20, 3.4);
          addShock(a.x, a.y, '#38bdf8', a.r * 2.3);
          UBG.score += 4;
        } else {
          hitPlayer(a.x, a.y);
        }
        continue;
      }
      if (a.y > H + a.r) { asteroids.splice(i, 1); UBG.score++; }
    }

    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      p.y += p.vy * dt; p.phase += 0.07 * dt;
      if (ship.mods.magnetRange > 0) {
        const d = Math.hypot(scx - p.x, scy - p.y);
        if (d < ship.mods.magnetRange && d > 1) {
          p.x += ((scx - p.x) / d) * 4.2 * playerDt;
          p.y += ((scy - p.y) / d) * 4.2 * playerDt;
        }
      }
      if (Math.hypot(p.x - scx, p.y - scy) < p.r + 22) {
        if (p.type === 'rapid') ship.rapid = 600;
        if (p.type === 'shield') ship.shield = 1;
        if (p.type === 'speed') ship.speed = 600;
        if (p.type === 'beam') ship.beam = 330;
        if (p.type === 'drone') ship.drone = 600;
        if (p.type === 'boost') {
          ship.boostEnergy = Math.min(100, ship.boostEnergy + 35);
          UBG.score += 20;
        }
        ship.boostEnergy = Math.min(100, ship.boostEnergy + 10 * ship.mods.boostChargeMult);
        burst(p.x, p.y, p.type === 'boost' ? '#facc15' : (p.type === 'shield' ? '#22d3ee' : '#facc15'), 22, 3);
        addShock(p.x, p.y, p.type === 'boost' ? '#facc15' : '#22d3ee', 36);
        addFloatText(p.x, p.y - 6, p.type === 'boost' ? '+35% BOOST' : ('+5 ' + p.type.toUpperCase()), p.type === 'boost' ? '#facc15' : '#67e8f9', 0.95);
        sound('pickup');
        UBG.score += 5;
        pickups.splice(i, 1);
        continue;
      }
      if (p.y > H + 20) pickups.splice(i, 1);
    }

    if (boosting && (ship.type === 'viper' || ship.type === 'phantom')) {
      laserTick += playerDt;
      if (laserTick >= 7) { laserTick = 0; sound('laser'); }
      const cx = ship.x + ship.w / 2;
      const beamOffsets = ship.type === 'phantom' ? [-58, 0, 58] : [-19, 19];
      const halfW = ship.type === 'phantom' ? 5.5 : (7.5 + Math.sin(UBG.time * 0.35) * 2);
      const beamDmg = ship.type === 'phantom' ? 0.55 : 0.82;

      beamOffsets.forEach(off => {
        const lx = cx + off;
        for (let i = enemies.length - 1; i >= 0; i--) {
          const e = enemies[i];
          if (Math.abs(e.x + e.w / 2 - lx) < halfW + e.w * 0.42 && e.y < ship.y) {
            e.hp -= beamDmg * playerDt;
            e.hitFlash = 2;
            if (Math.random() < 0.35 * playerDt) hitEffect(lx, e.y + e.h / 2, ship.spec.primary, false);
            if (e.hp <= 0) killEnemy(i);
          }
        }
        if (UBG.boss && UBG.boss.y < ship.y) {
          const b = UBG.boss;
          const bcx = b.x + b.w / 2, bcy = b.y + b.h / 2;
          if (b.turrets) {
            b.turrets.forEach(t => {
              if (t.hp > 0 && Math.abs((bcx + t.dx) - lx) < halfW + t.w * 0.5) {
                t.hp -= beamDmg * 1.2 * playerDt;
                t.flash = 2;
                if (Math.random() < 0.45 * playerDt) hitEffect(lx, bcy + t.dy, '#f59e0b', false);
                if (t.hp <= 0) destroyTurret(b, t);
              }
            });
          }
          const coreHalfW = b.kind === 'DREADNOUGHT' ? 76 : b.w * 0.42;
          if (UBG.boss && Math.abs(bcx - lx) < halfW + coreHalfW) {
            b.hp -= beamDmg * 1.15 * getBossDamageMult(b) * playerDt;
            b.flash = 2;
            if (Math.random() < 0.45 * playerDt) hitEffect(lx, b.y + b.h, ship.spec.primary, false);
            if (b.hp <= 0) bossDeath();
          }
        }
        for (let i = asteroids.length - 1; i >= 0; i--) {
          const a = asteroids[i];
          if (Math.abs(a.x - lx) < halfW + a.r * 0.85 && a.y < ship.y) {
            a.hp -= 0.75 * playerDt;
            if (a.hp <= 0) {
              burst(a.x, a.y, ship.spec.primary, 18, 3.2);
              addShock(a.x, a.y, ship.spec.primary, a.r * 2);
              UBG.score += 2;
              asteroids.splice(i, 1);
            }
          }
        }
        bullets = bullets.filter(b => !(Math.abs(b.x - lx) < halfW + b.r && b.y < ship.y));
      });
    }

    if (ship.beam > 0) {
      const cx = ship.x + ship.w / 2, bw = 24 + Math.sin(UBG.time * 0.12) * 5;
      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        if (Math.abs(e.x + e.w / 2 - cx) < bw + e.w * 0.35) { e.hp -= 0.45 * playerDt; e.hitFlash = 2; if (e.hp <= 0) killEnemy(i); }
      }
      if (UBG.boss) {
        const b = UBG.boss;
        const bcx = b.x + b.w / 2;
        if (b.turrets) {
          b.turrets.forEach(t => {
            if (t.hp > 0 && Math.abs((bcx + t.dx) - cx) < bw + t.w * 0.45) {
              t.hp -= 0.55 * playerDt;
              t.flash = 2;
              if (t.hp <= 0) destroyTurret(b, t);
            }
          });
        }
        const coreHalfW = b.kind === 'DREADNOUGHT' ? 76 : b.w * 0.35;
        if (UBG.boss && Math.abs(bcx - cx) < bw + coreHalfW) {
          b.hp -= 0.5 * getBossDamageMult(b) * playerDt;
          b.flash = 2;
          if (b.hp <= 0) bossDeath();
        }
      }
      bullets = bullets.filter(b => Math.abs(b.x - cx) > bw);
    }

    if (ship.drone > 0) ship.droneAngle += 0.06 * playerDt;
  }

  function draw() {
    ctx.save();
    if (UBG.shakeOn && shake > 0.3) ctx.translate(rand(-shake, shake), rand(-shake, shake));
    ctx.fillStyle = '#030712';
    ctx.fillRect(-30, -30, W + 60, H + 60);

    const isChrono = UBG.ship?.type === 'phantom' && UBG.ship?.boostTimer > 0;
    ctx.strokeStyle = isChrono ? '#c084fc33' : (slowMoTimer > 0 ? '#22d3ee33' : '#0f294226');
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= W; gx += 56) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
    }
    for (let gy = gridScroll; gy <= H; gy += 52) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
    }

    let g = ctx.createRadialGradient(W * 0.22, H * 0.3, 5, W * 0.22, H * 0.3, 340);
    g.addColorStop(0, isChrono ? '#581c8755' : '#312e8150'); g.addColorStop(1, '#03071200');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    g = ctx.createRadialGradient(W * 0.8, H * 0.68, 5, W * 0.8, H * 0.68, 360);
    g.addColorStop(0, '#07598535'); g.addColorStop(1, '#03071200');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    stars.forEach(s => { ctx.globalAlpha = s.a; ctx.fillStyle = '#dbeafe'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill(); });
    ctx.globalAlpha = 1;

    shocks.forEach(w => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, w.alpha);
      ctx.strokeStyle = w.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    });

    particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);
      if (p.kind === 'shard') {
        ctx.rotate(p.rot || 0);
        ctx.beginPath();
        ctx.moveTo(0, -p.r * 1.3);
        ctx.lineTo(p.r, p.r * 0.8);
        ctx.lineTo(-p.r, p.r * 0.6);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    });

    sparks.forEach(sp => {
      ctx.save();
      ctx.globalAlpha = clamp(sp.life / sp.max, 0, 1);
      ctx.strokeStyle = sp.color;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y);
      ctx.lineTo(sp.x - sp.vx * 1.9, sp.y - sp.vy * 1.9);
      ctx.stroke();
      ctx.restore();
    });

    if (UBG.state === 'PLAYING' || UBG.state === 'PAUSED' || UBG.state === 'UPGRADE' || UBG.state === 'GAMEOVER') {
      asteroids.forEach(a => {
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(a.rot);
        const isStorm = cosmicEvent?.type === 'METEOR';
        ctx.fillStyle = isStorm ? '#431e14' : '#334155';
        ctx.strokeStyle = isStorm ? '#fb923c' : '#cbd5e1';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        for (let k = 0; k < 10; k++) {
          const an = k / 10 * Math.PI * 2;
          const rad = a.r * (0.76 + (k % 3) * 0.12);
          const px = Math.cos(an) * rad, py = Math.sin(an) * rad;
          k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isStorm ? '#7c2d12' : '#475569';
        ctx.beginPath();
        ctx.arc(-a.r * 0.15, -a.r * 0.15, a.r * 0.58, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = isStorm ? '#fdba7488' : '#1e293b';
        ctx.lineWidth = 1.4;
        a.cracks?.forEach(rk => {
          ctx.beginPath();
          ctx.moveTo(Math.cos(rk.a1) * a.r * 0.2, Math.sin(rk.a1) * a.r * 0.2);
          ctx.lineTo(Math.cos(rk.a2) * rk.len, Math.sin(rk.a2) * rk.len);
          ctx.stroke();
        });

        ctx.fillStyle = isStorm ? '#291009' : '#1e293b';
        a.craters?.forEach(c => {
          ctx.beginPath();
          ctx.arc(c.dx, c.dy, c.cr, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.restore();
      });

      pickups.forEach(p => {
        const colors = { rapid: '#22d3ee', shield: '#60a5fa', speed: '#facc15', beam: '#c084fc', drone: '#4ade80', boost: '#facc15' };
        ctx.save(); ctx.translate(p.x, p.y + Math.sin(p.phase) * 3); ctx.rotate(Math.PI / 4);
        ctx.fillStyle = colors[p.type]; ctx.shadowBlur = 16; ctx.shadowColor = colors[p.type];
        ctx.fillRect(-8, -8, 16, 16); ctx.restore();
        ctx.fillStyle = p.type === 'boost' ? '#fde047' : '#fff'; ctx.font = 'bold 9px Segoe UI'; ctx.textAlign = 'center';
        ctx.fillText(p.type === 'boost' ? 'CORE +35%' : p.type.toUpperCase(), p.x, p.y + 23);
      });

      enemies.forEach(UBG.drawEnemy);
      bullets.forEach(UBG.drawEnemyBullet);
      missiles.forEach(UBG.drawMissile);
      shots.forEach(UBG.drawPlayerShot);

      UBG.drawBoostLasers();
      UBG.drawMegaBeam();
      if (UBG.ship) UBG.drawShip();
      UBG.drawBoss();

      floatTexts.forEach(ft => {
        ctx.save();
        ctx.globalAlpha = clamp(ft.life / ft.max, 0, 1);
        ctx.font = `900 ${Math.round(11 * ft.scale)}px Segoe UI`;
        ctx.textAlign = 'center';
        ctx.fillStyle = ft.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#020617';
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      });

      if (UBG.state === 'PLAYING' || UBG.state === 'PAUSED' || UBG.state === 'UPGRADE') drawHud();
    }

    ctx.restore();
    if (UBG.state !== 'PAUSED' && UBG.state !== 'UPGRADE' && shake > 0) shake *= 0.86;
    if (shake < 0.3) shake = 0;
  }

  function drawHud() {
    const ship = UBG.ship;
    ctx.fillStyle = '#071426d9'; ctx.strokeStyle = '#1e4960'; ctx.lineWidth = 1;
    ctx.fillRect(12, 10, W - 24, 44); ctx.strokeRect(12, 10, W - 24, 44);
    ctx.textAlign = 'left'; ctx.font = 'bold 10px Segoe UI'; ctx.fillStyle = '#94a3b8'; ctx.fillText('ĐIỂM · ' + ship.spec.name, 25, 25);
    ctx.font = 'bold 18px Segoe UI'; ctx.fillStyle = '#67e8f9'; ctx.fillText(Math.floor(UBG.score), 25, 45);
    ctx.font = 'bold 11px Segoe UI'; ctx.fillStyle = '#facc15'; if (combo > 1) ctx.fillText('COMBO x' + combo, 145, 39);
    ctx.font = 'bold 10px Segoe UI'; ctx.fillStyle = '#38bdf8'; ctx.fillText('GRAZE ' + grazeCount, 240, 39);
    ctx.textAlign = 'right'; ctx.fillStyle = '#94a3b8'; ctx.font = 'bold 10px Segoe UI'; ctx.fillText('KỶ LỤC', W - 25, 25);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 18px Segoe UI'; ctx.fillText(UBG.best, W - 25, 45);

    if (cosmicEvent) {
      ctx.save();
      ctx.font = '900 11px Segoe UI';
      ctx.textAlign = 'center';
      ctx.fillStyle = cosmicEvent.color;
      ctx.fillText(cosmicEvent.label, W / 2, 68);
      ctx.restore();
    }

    const ready = ship.boostEnergy >= BOOST_MIN_COST || ship.boostTimer > 0;
    const ultLabel = ship.type === 'titan' ? 'OMEGA NOVA ' : (ship.type === 'phantom' ? 'CHRONO ' : 'RAILGUN ');
    ctx.fillStyle = '#071426cc'; ctx.fillRect(14, H - 30, 175, 16);
    ctx.strokeStyle = ready ? ship.spec.primary : '#334155'; ctx.strokeRect(14, H - 30, 175, 16);
    ctx.fillStyle = ship.boostTimer > 0 ? ship.spec.primary : (ready ? '#0891b2' : '#334155');
    ctx.fillRect(16, H - 28, 171 * (ship.boostEnergy / 100), 12);
    ctx.fillStyle = '#e0f2fe'; ctx.font = 'bold 9px Segoe UI'; ctx.textAlign = 'center';
    ctx.fillText((ready && ship.boostTimer <= 0 ? '⚡ ' : '') + ultLabel + Math.floor(ship.boostEnergy) + '%', 101, H - 19);

    const active = [];
    if (ship.boostTimer > 0) active.push(ultLabel.trim() + ' ACTIVE');
    if (ship.shield) active.push('SHIELD');
    if (ship.mods.missiles > 0) active.push('MISSILES x' + ship.mods.missiles);
    if (ship.rapid > 0) active.push('RAPID ' + Math.ceil(ship.rapid / 60) + 's');
    if (ship.speed > 0) active.push('OVERDRIVE ' + Math.ceil(ship.speed / 60) + 's');
    if (ship.beam > 0) active.push('BEAM ' + Math.ceil(ship.beam / 60) + 's');
    if (ship.drone > 0) active.push('DRONES ' + Math.ceil(ship.drone / 60) + 's');
    if (active.length) {
      ctx.textAlign = 'center'; ctx.font = 'bold 10px Segoe UI'; ctx.fillStyle = '#c4b5fd';
      ctx.fillText(active.join(' · '), W / 2, cosmicEvent ? 84 : 80);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = last ? Math.min((now - last) / (1000 / 60), 2.5) : 1;
    last = now;
    update(dt);
    draw();
  }

  resetWorld();
  last = performance.now();
  requestAnimationFrame(frame);
})();
