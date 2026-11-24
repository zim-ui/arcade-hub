(() => {
  'use strict';
  const UBG = (window.UBG = window.UBG || {});
  const SAVE_KEY = 'ubg_dsd_progression_v2';

  const UPGRADES = [
    { id: 'damage', name: 'Lõi Hỏa Lực', desc: '+10% Sát thương mọi vũ khí mỗi cấp', max: 5, baseCost: 120, mult: 1.75 },
    { id: 'firerate', name: 'Ép Xung Nòng Bắn', desc: '+8% Tốc độ xả đạn mỗi cấp', max: 5, baseCost: 140, mult: 1.75 },
    { id: 'boost', name: 'Lò Phản Ứng Overdrive', desc: '+15% Tốc độ nạp & +10% Năng lượng đầu trận', max: 5, baseCost: 130, mult: 1.7 },
    { id: 'magnet', name: 'Nam Châm Lượng Tử', desc: '+65px Tầm hút vật phẩm mỗi cấp', max: 4, baseCost: 110, mult: 1.65 },
    { id: 'missile', name: 'Khoang Tên Lửa', desc: 'Vào trận có sẵn +1 Tên lửa tầm nhiệt', max: 2, baseCost: 320, mult: 2.2 },
    { id: 'drone', name: 'Phi Đội Vệ Tinh', desc: '+15 giây Drone hỗ trợ ngay khi xuất phát', max: 3, baseCost: 260, mult: 1.9 },
    { id: 'shield', name: 'Khiên Aegis Khởi Đầu', desc: 'Vào trận có sẵn 1 lớp Khiên bảo vệ', max: 1, baseCost: 400, mult: 1 }
  ];

  const RANKS = [
    { name: 'TÂN BINH VŨ TRỤ', reqKills: 0, bonusCr: 1.0, color: '#94a3b8' },
    { name: 'PHI CÔNG CHIẾN ĐẤU', reqKills: 60, bonusCr: 1.1, color: '#38bdf8' },
    { name: 'ĐỘI TRƯỞNG HẠM ĐỘI', reqKills: 180, bonusCr: 1.2, color: '#a855f7' },
    { name: 'THỢ SĂN DREADNOUGHT', reqKills: 400, bonusCr: 1.35, color: '#f97316' },
    { name: 'HUYỀN THOẠI NGÂN HÀ', reqKills: 800, bonusCr: 1.5, color: '#facc15' }
  ];

  const MISSION_TEMPLATES = [
    { id: 'kills', title: 'Thợ Săn Vũ Trụ', desc: (t) => `Tiêu diệt ${t} tàu địch`, baseTarget: 35, step: 40, reward: 150 },
    { id: 'bosses', title: 'Sát Thủ Boss', desc: (t) => `Hạ gục ${t} Boss khổng lồ`, baseTarget: 1, step: 2, reward: 320 },
    { id: 'combo', title: 'Bậc Thầy Combo', desc: (t) => `Đạt chuỗi Combo x${t}`, baseTarget: 10, step: 6, reward: 220 },
    { id: 'grazes', title: 'Nghệ Sĩ Lướt Đạn', desc: (t) => `Tích lũy ${t} lần lướt sát đạn (Graze)`, baseTarget: 40, step: 50, reward: 180 }
  ];

  function defaultData() {
    return {
      credits: 0,
      upgrades: { damage: 0, firerate: 0, boost: 0, magnet: 0, missile: 0, drone: 0, shield: 0 },
      stats: { kills: 0, bosses: 0, maxCombo: 0, grazes: 0 },
      missionTier: { kills: 0, bosses: 0, combo: 0, grazes: 0 }
    };
  }

  let data = defaultData();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      data = Object.assign(defaultData(), parsed);
      data.upgrades = Object.assign(defaultData().upgrades, parsed.upgrades || {});
      data.stats = Object.assign(defaultData().stats, parsed.stats || {});
      data.missionTier = Object.assign(defaultData().missionTier, parsed.missionTier || {});
    }
  } catch (e) {}

  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) {}
  }

  function getCurrentRank() {
    let current = RANKS[0];
    for (const r of RANKS) {
      if (data.stats.kills >= r.reqKills) current = r;
    }
    return current;
  }

  function getUpgradeCost(u) {
    const lv = data.upgrades[u.id] || 0;
    return Math.round(u.baseCost * Math.pow(u.mult, lv));
  }

  function getMissionInfo(m) {
    const tier = data.missionTier[m.id] || 0;
    const target = m.baseTarget + tier * m.step;
    const reward = Math.round(m.reward * (1 + tier * 0.55));
    const current = m.id === 'combo' ? data.stats.maxCombo : (data.stats[m.id] || 0);
    return { target, reward, current, done: current >= target };
  }

  UBG.prog = {
    getData: () => data,
    getStats() {
      const rank = getCurrentRank();
      return {
        damageMult: 1 + (data.upgrades.damage || 0) * 0.1,
        fireRateMult: Math.pow(0.92, data.upgrades.firerate || 0),
        boostChargeMult: 1 + (data.upgrades.boost || 0) * 0.15,
        startBoost: (data.upgrades.boost || 0) * 10,
        magnetRange: (data.upgrades.magnet || 0) * 65,
        startMissiles: data.upgrades.missile || 0,
        startDrone: (data.upgrades.drone || 0) * 900,
        startShield: data.upgrades.shield || 0,
        creditMult: rank.bonusCr
      };
    },
    addCredits(amount) {
      const mult = this.getStats().creditMult;
      const gained = Math.max(1, Math.round(amount * mult));
      data.credits += gained;
      save();
      updateBadge();
      return gained;
    },
    onEnemyKill(isBoss = false, combo = 0, baseCr = 6) {
      data.stats.kills += 1;
      if (isBoss) data.stats.bosses += 1;
      if (combo > data.stats.maxCombo) data.stats.maxCombo = combo;
      this.addCredits(baseCr);
    },
    onGraze() {
      data.stats.grazes = (data.stats.grazes || 0) + 1;
      if (data.stats.grazes % 5 === 0) save();
    },
    onRunEnd(score = 0) {
      const bonus = Math.floor(score / 120);
      if (bonus > 0) this.addCredits(bonus);
      save();
      updateBadge();
    },
    open: () => toggleModal(true),
    close: () => toggleModal(false)
  };

  // --- GIAO DIỆN HANGAR ---
  const style = document.createElement('style');
  style.textContent = `
    #ubg-hangar-btn {
      position: fixed; bottom: 18px; right: 18px; z-index: 9998;
      background: linear-gradient(135deg, #0ea5e9, #6366f1);
      color: #fff; border: 1px solid rgba(255,255,255,0.35);
      padding: 10px 16px; border-radius: 999px; font: 700 13px/1 monospace;
      cursor: pointer; box-shadow: 0 0 18px rgba(56,189,248,0.45);
      display: flex; align-items: center; gap: 8px; transition: transform .15s;
    }
    #ubg-hangar-btn:hover { transform: scale(1.06); }
    #ubg-hangar-dot {
      width: 9px; height: 9px; border-radius: 50%; background: #facc15;
      display: none; box-shadow: 0 0 8px #facc15;
    }
    #ubg-hangar-modal {
      position: fixed; inset: 0; z-index: 9999; display: none;
      background: rgba(2, 6, 23, 0.88); backdrop-filter: blur(6px);
      align-items: center; justify-content: center; padding: 16px;
      font-family: system-ui, -apple-system, sans-serif; color: #e2e8f0;
    }
    .ubg-h-box {
      width: 100%; max-width: 660px; max-height: 88vh; overflow-y: auto;
      background: #0f172a; border: 1px solid #334155; border-radius: 16px;
      padding: 20px; box-shadow: 0 20px 50px rgba(0,0,0,0.75);
    }
    .ubg-h-head {
      display: flex; justify-content: space-between; align-items: center;
      border-bottom: 1px solid #1e293b; padding-bottom: 12px; margin-bottom: 14px;
    }
    .ubg-h-cr {
      background: rgba(250,204,21,0.12); color: #facc15;
      border: 1px solid rgba(250,204,21,0.35); padding: 6px 12px;
      border-radius: 999px; font: 700 14px monospace;
    }
    .ubg-h-tabs { display: flex; gap: 8px; margin-bottom: 14px; }
    .ubg-h-tab {
      flex: 1; padding: 9px; border-radius: 10px; border: 1px solid #334155;
      background: #1e293b; color: #94a3b8; font-weight: 700; cursor: pointer;
    }
    .ubg-h-tab.active { background: #0284c7; color: #fff; border-color: #38bdf8; }
    .ubg-h-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px; }
    .ubg-h-card {
      background: #1e293b; border: 1px solid #334155; border-radius: 12px;
      padding: 12px; display: flex; flex-direction: column; justify-content: space-between; gap: 10px;
    }
    .ubg-h-act {
      width: 100%; padding: 8px; border-radius: 8px; border: none; font-weight: 700;
      cursor: pointer; background: #0ea5e9; color: #020617;
    }
    .ubg-h-act:disabled { background: #334155; color: #64748b; cursor: not-allowed; }
    .ubg-h-act.claim { background: #facc15; color: #422006; }
    .ubg-h-close {
      background: #334155; color: #fff; border: none; border-radius: 8px;
      padding: 6px 12px; cursor: pointer; font-weight: 700;
    }
  `;
  document.head.appendChild(style);

  const btn = document.createElement('button');
  btn.id = 'ubg-hangar-btn';
  btn.innerHTML = `<span id="ubg-hangar-dot"></span>🚀 HANGAR <span id="ubg-cr-mini">0 CR</span>`;
  document.body.appendChild(btn);

  const modal = document.createElement('div');
  modal.id = 'ubg-hangar-modal';
  modal.innerHTML = `
    <div class="ubg-h-box">
      <div class="ubg-h-head">
        <div>
          <div style="font-size:18px;font-weight:800;color:#38bdf8;">🚀 XƯỞNG ĐỘ TÀU (HANGAR)</div>
          <div id="ubg-h-rank" style="font-size:12px;color:#94a3b8;margin-top:2px;"></div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="ubg-h-cr" id="ubg-h-cr">0 CR</div>
          <button class="ubg-h-close" id="ubg-h-close">✕</button>
        </div>
      </div>
      <div class="ubg-h-tabs">
        <button class="ubg-h-tab active" data-tab="upgrades">⚡ Nâng Cấp Tàu</button>
        <button class="ubg-h-tab" data-tab="missions">🎯 Nhiệm Vụ</button>
        <button class="ubg-h-tab" data-tab="ranks">🎖️ Quân Hàm</button>
      </div>
      <div id="ubg-h-body" class="ubg-h-grid"></div>
    </div>
  `;
  document.body.appendChild(modal);

  let activeTab = 'upgrades';

  function updateBadge() {
    const mini = document.getElementById('ubg-cr-mini');
    const crEl = document.getElementById('ubg-h-cr');
    const dot = document.getElementById('ubg-hangar-dot');
    const rankEl = document.getElementById('ubg-h-rank');
    const rank = getCurrentRank();
    if (mini) mini.textContent = `${data.credits} CR`;
    if (crEl) crEl.textContent = `${data.credits} CR`;
    if (rankEl) rankEl.innerHTML = `Cấp bậc: <b style="color:${rank.color}">${rank.name}</b> (Thưởng Tinh Thạch x${rank.bonusCr})`;
    const hasClaim = MISSION_TEMPLATES.some((m) => getMissionInfo(m).done);
    if (dot) dot.style.display = hasClaim ? 'inline-block' : 'none';
  }

  function render() {
    updateBadge();
    const body = document.getElementById('ubg-h-body');
    if (!body) return;
    body.innerHTML = '';

    if (activeTab === 'upgrades') {
      UPGRADES.forEach((u) => {
        const lv = data.upgrades[u.id] || 0;
        const isMax = lv >= u.max;
        const cost = getUpgradeCost(u);
        const card = document.createElement('div');
        card.className = 'ubg-h-card';
        card.innerHTML = `
          <div>
            <div style="display:flex;justify-content:space-between;font-weight:700;">
              <span>${u.name}</span>
              <span style="color:#38bdf8;">Lv.${lv}/${u.max}</span>
            </div>
            <div style="font-size:12px;color:#94a3b8;margin-top:4px;">${u.desc}</div>
          </div>
          <button class="ubg-h-act" ${isMax || data.credits < cost ? 'disabled' : ''}>
            ${isMax ? 'ĐÃ TỐI ĐA' : `NÂNG CẤP (${cost} CR)`}
          </button>
        `;
        card.querySelector('button').onclick = () => {
          if (isMax || data.credits < cost) return;
          data.credits -= cost;
          data.upgrades[u.id] = lv + 1;
          save();
          if (UBG.sound) UBG.sound('upgrade');
          render();
        };
        body.appendChild(card);
      });
    } else if (activeTab === 'missions') {
      MISSION_TEMPLATES.forEach((m) => {
        const info = getMissionInfo(m);
        const pct = Math.min(100, Math.round((info.current / info.target) * 100));
        const card = document.createElement('div');
        card.className = 'ubg-h-card';
        card.innerHTML = `
          <div>
            <div style="display:flex;justify-content:space-between;font-weight:700;">
              <span>${m.title}</span>
              <span style="color:#facc15;">+${info.reward} CR</span>
            </div>
            <div style="font-size:12px;color:#94a3b8;margin:4px 0 8px;">${m.desc(info.target)} (${Math.min(info.current, info.target)}/${info.target})</div>
            <div style="height:6px;background:#0f172a;border-radius:99px;overflow:hidden;">
              <div style="width:${pct}%;height:100%;background:${info.done ? '#facc15' : '#38bdf8'};"></div>
            </div>
          </div>
          <button class="ubg-h-act ${info.done ? 'claim' : ''}" ${info.done ? '' : 'disabled'}>
            ${info.done ? `NHẬN ${info.reward} CR` : 'ĐANG THỰC HIỆN'}
          </button>
        `;
        card.querySelector('button').onclick = () => {
          if (!info.done) return;
          data.credits += info.reward;
          data.missionTier[m.id] = (data.missionTier[m.id] || 0) + 1;
          save();
          if (UBG.sound) UBG.sound('upgrade');
          render();
        };
        body.appendChild(card);
      });
    } else {
      RANKS.forEach((r) => {
        const unlocked = data.stats.kills >= r.reqKills;
        const card = document.createElement('div');
        card.className = 'ubg-h-card';
        card.style.borderColor = unlocked ? r.color : '#334155';
        card.innerHTML = `
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-weight:800;color:${r.color};">${r.name}</span>
              <span style="font-size:11px;background:#0f172a;padding:2px 8px;border-radius:99px;">x${r.bonusCr} CR</span>
            </div>
            <div style="font-size:12px;color:#94a3b8;margin-top:6px;">
              Yêu cầu: Hạ ${r.reqKills} tàu địch (Hiện tại: ${data.stats.kills})
            </div>
          </div>
          <div style="font-size:12px;font-weight:700;color:${unlocked ? '#4ade80' : '#64748b'};">
            ${unlocked ? '✓ ĐÃ ĐẠT QUÂN HÀM' : '🔒 CHƯA MỞ KHÓA'}
          </div>
        `;
        body.appendChild(card);
      });
    }
  }

  function toggleModal(show) {
    modal.style.display = show ? 'flex' : 'none';
    if (show) render();
  }

  btn.onclick = () => toggleModal(true);
  document.getElementById('ubg-h-close').onclick = () => toggleModal(false);
  modal.onclick = (e) => { if (e.target === modal) toggleModal(false); };
  modal.querySelectorAll('.ubg-h-tab').forEach((t) => {
    t.onclick = () => {
      modal.querySelectorAll('.ubg-h-tab').forEach((x) => x.classList.remove('active'));
      t.classList.add('active');
      activeTab = t.dataset.tab;
      render();
    };
  });

  // Tự ẩn nút Hangar khi đang bay chiến đấu để tránh bấm nhầm
  setInterval(() => {
    btn.style.display = UBG.state === 'PLAYING' ? 'none' : 'flex';
  }, 250);

  updateBadge();
})();
