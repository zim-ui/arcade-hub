(() => {
  'use strict';
  const UBG = (window.UBG = window.UBG || {});
  const { rand, clamp } = UBG;

  UBG.SHIP_SPECS = {
    viper: {
      name: 'VIPER', primary: '#22d3ee', hull: '#26384f', trim: '#9fb4ca',
      smoothRate: 0.78, hitboxR: 9.5, grazeR: 25, grazeScore: 3, boostGainMult: 1.2,
      baseDamage: 1, baseCool: 12, startShield: 0, pattern: 'twin'
    },
    titan: {
      name: 'TITAN', primary: '#fb923c', hull: '#3a241b', trim: '#fdba74',
      smoothRate: 0.83, hitboxR: 11, grazeR: 24, grazeScore: 3, boostGainMult: 0.95,
      baseDamage: 1.35, baseCool: 14, startShield: 1, pattern: 'spread3'
    },
    phantom: {
      name: 'PHANTOM', primary: '#c084fc', hull: '#261a3b', trim: '#d8b4fe',
      smoothRate: 0.72, hitboxR: 7.5, grazeR: 36, grazeScore: 6, boostGainMult: 1.35,
      baseDamage: 0.95, baseCool: 10.5, startShield: 0, pattern: 'twin'
    }
  };

  UBG.UPGRADE_POOL = [
    {
      id: 'multishot',
      title: 'ĐA NÒNG PLASMA (+2 TIA)',
      desc: 'Bắn thêm 2 tia đạn chéo bên hông mỗi loạt',
      color: '#22d3ee',
      apply: s => { s.mods.extraGuns += 1; }
    },
    {
      id: 'firerate',
      title: 'ÉP XUNG TỐC ĐỘ BẮN (+22%)',
      desc: 'Giảm thời gian hồi giữa các loạt đạn',
      color: '#38bdf8',
      apply: s => { s.mods.fireRateMult *= 0.82; }
    },
    {
      id: 'damage',
      title: 'ĐẦU ĐẠN XUYÊN PHÁ (+35% DMG)',
      desc: 'Tăng sát thương cơ bản của mọi phát bắn',
      color: '#facc15',
      apply: s => { s.mods.damageMult += 0.35; }
    },
    {
      id: 'magnet',
      title: 'NAM CHÂM HÚT VẬT PHẨM',
      desc: 'Tự động hút các lõi năng lượng rơi gần tàu',
      color: '#4ade80',
      apply: s => { s.mods.magnetRange += 135; }
    },
    {
      id: 'boostcap',
      title: 'LÒ PHẢN ỨNG BOOST (+30%)',
      desc: 'Tăng tốc độ nạp năng lượng Laser Boost & +25% thanh hiện tại',
      color: '#c084fc',
      apply: s => { s.mods.boostChargeMult += 0.3; s.boostEnergy = Math.min(100, s.boostEnergy + 25); }
    },
    {
      id: 'aegis',
      title: 'TÁI TẠO KHIÊN NĂNG LƯỢNG',
      desc: 'Kích hoạt ngay 1 lớp Khiên bảo vệ & cộng +60 điểm',
      color: '#60a5fa',
      apply: s => { s.shield = 1; UBG.score += 60; }
    }
  ];

  UBG.drawShip = function () {
    const { ctx, ship, trail, pointer, time } = UBG;
    const x = ship.x, y = ship.y, w = ship.w, h = ship.h, cx = x + w / 2, cy = y + h / 2;
    const boosting = ship.boostTimer > 0;
    const primary = ship.spec.primary;
    trail.push({ x: cx, y: y + h - 5, boost: boosting });
    if (trail.length > 16) trail.shift();

    trail.forEach((p, i) => {
      ctx.globalAlpha = (i / trail.length) * (p.boost ? 0.45 : 0.22);
      ctx.fillStyle = p.boost ? '#38bdf8' : (ship.speed > 0 ? '#facc15' : primary);
      ctx.beginPath();
      ctx.arc(p.x, p.y, (p.boost ? 3.5 : 2) + i * 0.26, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(clamp((pointer.x - cx) * 0.006, -0.3, 0.3));

    const flame = rand(boosting ? 22 : 13, boosting ? 34 : 22);
    ctx.fillStyle = boosting ? '#38bdf8' : (ship.speed > 0 ? '#facc15' : primary);
    ctx.shadowBlur = boosting ? 20 : 14;
    ctx.shadowColor = ctx.fillStyle;
    ctx.beginPath();
    ctx.moveTo(-10, 19); ctx.lineTo(-6, 19 + flame); ctx.lineTo(-2, 19);
    ctx.moveTo(2, 19); ctx.lineTo(6, 19 + flame); ctx.lineTo(10, 19);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = ship.spec.hull;
    ctx.strokeStyle = ship.spec.trim;
    ctx.lineWidth = 1.5;
    if (ship.type === 'titan') {
      ctx.beginPath();
      ctx.moveTo(0, -27); ctx.lineTo(-27, 18); ctx.lineTo(-14, 24); ctx.lineTo(0, 18); ctx.lineTo(14, 24); ctx.lineTo(27, 18);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (ship.type === 'phantom') {
      ctx.beginPath();
      ctx.moveTo(0, -32); ctx.lineTo(-20, 24); ctx.lineTo(-6, 15); ctx.lineTo(0, 21); ctx.lineTo(6, 15); ctx.lineTo(20, 24);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(0, -29); ctx.lineTo(-23, 23); ctx.lineTo(-8, 17); ctx.lineTo(0, 22); ctx.lineTo(8, 17); ctx.lineTo(23, 23);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }

    ctx.fillStyle = '#dbeafe';
    ctx.beginPath();
    ctx.moveTo(0, -25); ctx.lineTo(-7, 8); ctx.lineTo(0, 17); ctx.lineTo(7, 8);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = boosting ? '#e0f2fe' : primary;
    ctx.shadowBlur = 12;
    ctx.shadowColor = primary;
    ctx.beginPath();
    ctx.ellipse(0, -5, 4, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 8;
    ctx.shadowColor = primary;
    ctx.beginPath();
    ctx.arc(cx, cy + 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (ship.invuln > 0 && Math.floor(time / 5) % 2 === 0) {
      ctx.strokeStyle = boosting ? '#38bdf8' : '#67e8f9';
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 34, 39, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (ship.shield) {
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#22d3ee';
      ctx.beginPath();
      ctx.arc(cx, cy, 39, time * 0.025, time * 0.025 + Math.PI * 1.7);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    if (ship.drone > 0) {
      for (let k = 0; k < 2; k++) {
        const a = ship.droneAngle + k * Math.PI
