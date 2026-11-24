(() => {
  'use strict';
  const UBG = (window.UBG = window.UBG || {});
  const SAVE_KEY = 'ubg_dsd_progression_v1';

  const SHIPS = [
    {
      id: 'interceptor',
      name: 'INTERCEPTOR',
      tag: 'Cân bằng',
      cost: 0,
      color: '#22d3ee',
      desc: 'Phi thuyền tiêu chuẩn, dễ điều khiển.',
      bonus: { hp: 0, dmg: 1.0, spd: 1.0, rate: 1.0, shield: 0, cr: 1.0 }
    },
    {
      id: 'juggernaut',
      name: 'JUGGERNAUT',
      tag: 'Hạng nặng',
      cost: 600,
      color: '#f97316',
      desc: '+3 Máu tối đa, +25% Sát thương, chậm hơn 10%.',
      bonus: { hp: 3, dmg: 1.25, spd: 0.9, rate: 1.0, shield: 0, cr: 1.0 }
    },
    {
      id: 'phantom',
      name: 'PHANTOM',
      tag: 'Tốc độ',
      cost: 1200,
      color: '#c084fc',
      desc: '+22% Tốc độ bay, +20% Tốc độ bắn, -1 Máu.',
      bonus: { hp: -1, dmg: 1.0, spd: 1.22, rate: 1.2, shield: 0, cr: 1.1 }
    },
    {
      id: 'valkyrie',
      name: 'VALKYRIE',
      tag: 'Huyền thoại',
      cost: 2200,
      color: '#facc15',
      desc: '+20% Sát thương, +1 Khiên khởi đầu, +30% Tinh Thạch.',
      bonus: { hp: 1, dmg: 1.2, spd: 1.08, rate: 1.1, shield: 1, cr: 1.3 }
    }
  ];

  const UPGRADES = [
    { id: 'hull', name: 'Giáp Gia Cố', desc: '+1 Máu tối đa mỗi cấp', max: 5, baseCost: 120, mult: 1.7 },
    { id: 'core', name: 'Lõi Hỏa Lực', desc: '+12% Sát thương mỗi cấp', max: 5, baseCost: 150, mult: 1.75 },
    { id: 'engine', name: 'Động Cơ Ion', desc: '+8% Tốc độ bắn & bay', max: 5, baseCost: 140, mult: 1.7 },
    { id: 'shield', name: 'Khiên Khởi Đầu', desc: '+1 Lớp khiên khi vào trận', max: 3, baseCost: 250, mult: 2.0 }
  ];

  const MISSION_TEMPLATES = [
    { id: 'kills', title: 'Thợ Săn Vũ Trụ', desc: (t) => `Tiêu diệt ${t} tàu địch`, baseTarget: 30, step: 35, reward: 150 },
    { id: 'bosses', title: 'Sát Thủ Boss', desc: (t) => `Hạ gục ${t} Boss`, baseTarget: 1, step: 2, reward: 300 },
    { id: 'combo', title: 'Bậc Thầy Combo', desc: (t) => `Đạt chuỗi Combo x${t}`, baseTarget: 8, step: 6, reward: 200 }
  ];

  function defaultData() {
    return {
      credits: 0,
      selectedShip: 'interceptor',
      ownedShips: ['interceptor'],
      upgrades: { hull: 0, core: 0, engine: 0, shield: 0 },
      stats: { kills: 0, bosses: 0, maxCombo: 0 },
      missionTier: { kills: 0, bosses: 0, combo: 0 }
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

  function getUpgradeCost(u) {
    const lv = data.upgrades[u.id] || 0;
    return Math.round(u.baseCost * Math.pow(u.mult, lv));
  }

  function getMissionInfo(m) {
    const tier = data.missionTier[m.id] || 0;
    const target = m.baseTarget + tier * m.step;
    const reward = Math.round(m.reward * (1 + tier * 0.6));
    const current = m.id === 'combo' ? data.stats.maxCombo : data.stats[m.id];
    return { target, reward, current, done: current >= target };
  }

  // API để main.js gọi
  UBG.prog = {
    getData: () => data,
    getStats() {
      const ship = SHIPS.find((s) => s.id === data.selectedShip) || SHIPS[0];
      return {
        shipId: ship.id,
        shipColor: ship.color,
        bonusHp: ship.bonus.hp + (data.upgrades.hull || 0),
        dmgMult: ship.bonus.dmg * (1 + (data.upgrades.core || 0) * 0.12),
        speedMult: ship.bonus.spd * (1 + (data.upgrades.engine || 0) * 0.08),
        fireRateMult: ship.bonus.rate * (1 + (data.upgrades.engine || 0) * 0.08),
        startShield: ship.bonus.shield + (data.upgrades.shield || 0),
        creditMult: ship.bonus.cr
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
    onEnemyKill(isBoss = false, combo = 0) {
      data.stats.kills += 1;
      if (isBoss) data.stats.bosses += 1;
      if (combo > data.stats.maxCombo) data.stats.maxCombo = combo;
      this.addCredits(isBoss ? 120 : 6);
    },
    onRunEnd(score = 0) {
      const bonus = Math.floor(score / 150);
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
      background: rgba(2, 6, 23, 0.86); backdrop-filter: blur(6px);
      align-items: center; justify-content: center; padding: 16px;
      font-family: system-ui, -apple-system, sans-serif; color: #e2e8f0;
    }
    .ubg-h-box {
      width: 100%; max-width: 640px; max-height: 88vh; overflow-y: auto;
      background: #0f172a; border: 1px solid #334155; border-radius: 16px;
      padding: 20px; box-shadow: 0 20px 50px rgba(0,0,0,0.7);
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
    .ubg-h-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 10px; }
    .ubg-h-card {
      background: #1e293b; border: 1px solid #334155; border-radius: 12px;
      padding: 12px; display: flex; flex-direction: column; justify-content: space-between; gap: 10px;
    }
    .ubg-h-act {
      width: 100%; padding: 8px; border-radius: 8px; border: none; font-weight: 700;
      cursor: pointer; background: #0ea5e9; color: #020617;
    }
    .ubg-h-act:disabled { background: #334155; color: #64748b; cursor: not-allowed; }
    .ubg-h-act.equipped { background: #10b981; color: #022c22; }
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
          <div style="font-size:12px;color:#94a3b8;">Nâng cấp vĩnh viễn • Áp dụng ngay ván sau</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="ubg-h-cr" id="ubg-h-cr">0 CR</div>
          <button class="ubg-h-close" id="ubg-h-close">✕</button>
        </div>
      </div>
      <div class="ubg-h-tabs">
        <button class="ubg-h-tab active" data-tab="upgrades">⚡ Nâng Cấp</button>
        <button class="ubg-h-tab" data-tab="ships">🛸 Phi Thuyền</button>
        <button class="ubg-h-tab" data-tab="missions">🎯 Nhiệm Vụ</button>
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
    if (mini) mini.textContent = `${data.credits} CR`;
    if (crEl) crEl.textContent = `${data.credits} CR`;
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
    } else if (activeTab === 'ships') {
      SHIPS.forEach((s) => {
        const owned = data.ownedShips.includes(s.id);
        const equipped = data.selectedShip === s.id;
        const card = document.createElement('div');
        card.className = 'ubg-h-card';
        card.style.borderColor = equipped ? s.color : '#334155';
        card.innerHTML = `
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-weight:800;color:${s.color};">${s.name}</span>
              <span style="font-size:11px;background:#0f172a;padding:2px 8px;border-radius:99px;">${s.tag}</span>
            </div>
            <div style="font-size:12px;color:#cbd5e1;margin-top:6px;">${s.desc}</div>
          </div>
          <button class="ubg-h-act ${equipped ? 'equipped' : ''}" ${!owned && data.credits < s.cost ? 'disabled' : ''}>
            ${equipped ? '✓ ĐANG TRANG BỊ' : owned ? 'CHỌN TÀU NÀY' : `MỞ KHÓA (${s.cost} CR)`}
          </button>
        `;
        card.querySelector('button').onclick = () => {
          if (owned) {
            data.selectedShip = s.id;
            if (UBG.sound) UBG.sound('pickup');
          } else if (data.credits >= s.cost) {
            data.credits -= s.cost;
            data.ownedShips.push(s.id);
            data.selectedShip = s.id;
            if (UBG.sound) UBG.sound('upgrade');
          }
          save();
          render();
        };
        body.appendChild(card);
      });
    } else {
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

  updateBadge();
})();
