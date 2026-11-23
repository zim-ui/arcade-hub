(() => {
  'use strict';
  const UBG = (window.UBG = window.UBG || {});
  const { rand, clamp } = UBG;

  UBG.SHIP_SPECS = {
    viper: {
      name: 'VIPER', primary: '#22d3ee', hull: '#26384f', trim: '#9fb4ca',
      smoothRate: 0.78, hitboxR: 9.5, grazeR: 25, grazeScore: 3, boostGainMult: 1.25,
      baseDamage: 1, baseCool: 12, startShield: 0, pattern: 'twin'
    },
    titan: {
      name: 'TITAN', primary: '#fb923c', hull: '#3a241b', trim: '#fdba74',
      smoothRate: 0.83, hitboxR: 11, grazeR: 24, grazeScore: 3, boostGainMult: 1.0,
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
      id: 'missiles',
      title: 'TÊN LỬA TẦM NHIỆT (+2 QUẢ)',
      desc: 'Tự động phóng tên lửa uốn lượn truy đuổi mục tiêu gần nhất',
      color: '#fb7185',
      apply: s => { s.mods.missiles += 2; }
    },
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
      desc: 'Tăng sát thương cơ bản của mọi phát bắn & tên lửa',
      color: '#facc15',
      apply: s => { s.mods.damageMult += 0.35; }
    },
    {
      id: 'magnet',
      title: 'NAM CHÂM HÚT VẬT PHẨM',
      desc: 'Tự động hút các lõi năng lượng rơi gần tàu',
      color: '#4ade80',
      apply: s => { s.mods.magnetRange += 175; }
    },
    {
      id: 'boostcap',
      title: 'LÒ PHẢN ỨNG BOOST (+30%)',
      desc: 'Tăng tốc độ nạp tuyệt kỹ & hồi ngay +30% thanh năng lượng',
      color: '#c084fc',
      apply: s => { s.mods.boostChargeMult += 0.3; s.boostEnergy = Math.min(100, s.boostEnergy + 30); }
    },
    {
      id: 'aegis',
      title: 'TÁI TẠO KHIÊN NĂNG LƯỢNG',
      desc: 'Kích hoạt ngay 1 lớp Khiên bảo vệ & cộng +60 điểm',
      color: '#60a5fa',
      apply: s => { s.shield = 1; UBG.score += 60; }
    }
  ];

  function drawShipChassis(ctx, ship, cx, cy, tilt, alpha = 1, isClone = false) {
    const boosting = ship.boostTimer > 0;
    const primary = isClone ? '#e879f9' : ship.spec.primary;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.rotate(tilt);

    const flame = rand(boosting ? 22 : 13, boosting ? 34 : 22);
    ctx.fillStyle = isClone ? '#c084fc' : (boosting ? '#38bdf8' : (ship.speed > 0 ? '#facc15' : primary));
    ctx.shadowBlur = boosting ? 20 : 14;
    ctx.shadowColor = ctx.fillStyle;
    ctx.beginPath();
    ctx.moveTo(-10, 19); ctx.lineTo(-6, 19 + flame); ctx.lineTo(-2, 19);
    ctx.moveTo(2, 19); ctx.lineTo(6, 19 + flame); ctx.lineTo(10, 19);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = isClone ? '#3b0764' : ship.spec.hull;
    ctx.strokeStyle = isClone ? '#e879f9' : ship.spec.trim;
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

    ctx.fillStyle = isClone ? '#f5d0fe' : '#dbeafe';
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
  }

  UBG.drawShip = function () {
    const { ctx, ship, trail, pointer, time } = UBG;
    const x = ship.x, y = ship.y, w = ship.w, h = ship.h, cx = x + w / 2, cy = y + h / 2;
    const boosting = ship.boostTimer > 0;
    const primary = ship.spec.primary;
    const tilt = clamp((pointer.x - cx) * 0.005, -0.3, 0.3);

    trail.push({ x: cx, y: y + h - 5, boost: boosting });
    if (trail.length > 16) trail.shift();

    trail.forEach((p, i) => {
      ctx.globalAlpha = (i / trail.length) * (p.boost ? 0.45 : 0.22);
      ctx.fillStyle = p.boost ? primary : (ship.speed > 0 ? '#facc15' : primary);
      ctx.beginPath();
      ctx.arc(p.x, p.y, (p.boost ? 3.5 : 2) + i * 0.26, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // 2 Bóng ma phân thân khi Phantom kích hoạt Chrono Boost
    if (ship.type === 'phantom' && boosting) {
      [-58, 58].forEach(off => {
        drawShipChassis(ctx, ship, cx + off, cy + 8, tilt, 0.58, true);
      });
    }

    drawShipChassis(ctx, ship, cx, cy, tilt, 1, false);

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 8;
    ctx.shadowColor = primary;
    ctx.beginPath();
    ctx.arc(cx, cy + 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (ship.invuln > 0 && Math.floor(time / 5) % 2 === 0) {
      ctx.strokeStyle = boosting ? primary : '#67e8f9';
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
        const a = ship.droneAngle + k * Math.PI, dx = cx + Math.cos(a) * 49, dy = cy + Math.sin(a) * 34;
        ctx.fillStyle = '#4ade80';
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#4ade80';
        ctx.fillRect(dx - 5, dy - 5, 10, 10);
        ctx.shadowBlur = 0;
      }
    }
  };

  UBG.drawBoostLasers = function () {
    const { ctx, ship, time } = UBG;
    if (!ship || ship.boostTimer <= 0) return;
    const cx = ship.x + ship.w / 2;

    if (ship.type === 'viper') {
      const lw = 6.5 + Math.sin(time * 0.45) * 2;
      [-19, 19].forEach(off => {
        const lx = cx + off;
        ctx.save();
        const grad = ctx.createLinearGradient(lx - lw * 2, 0, lx + lw * 2, 0);
        grad.addColorStop(0, '#0ea5e900');
        grad.addColorStop(0.3, '#22d3eecc');
        grad.addColorStop(0.5, '#ffffff');
        grad.addColorStop(0.7, '#22d3eecc');
        grad.addColorStop(1, '#0ea5e900');
        ctx.fillStyle = grad;
        ctx.shadowBlur = 16;
        ctx.shadowColor = '#22d3ee';
        ctx.fillRect(lx - lw * 2, 0, lw * 4, ship.y + 6);
        ctx.restore();
      });
    } else if (ship.type === 'phantom') {
      const lw = 4.5 + Math.sin(time * 0.5) * 1.5;
      [-58, 0, 58].forEach(off => {
        const lx = cx + off;
        ctx.save();
        const grad = ctx.createLinearGradient(lx - lw * 2, 0, lx + lw * 2, 0);
        grad.addColorStop(0, '#a855f700');
        grad.addColorStop(0.35, '#c084fcaa');
        grad.addColorStop(0.5, '#fae8ff');
        grad.addColorStop(0.65, '#c084fcaa');
        grad.addColorStop(1, '#a855f700');
        ctx.fillStyle = grad;
        ctx.shadowBlur = 14;
        ctx.shadowColor = '#c084fc';
        ctx.fillRect(lx - lw * 2, 0, lw * 4, ship.y + 10);
        ctx.restore();
      });
    } else if (ship.type === 'titan') {
      ctx.save();
      ctx.strokeStyle = '#fb923c';
      ctx.lineWidth = 3;
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#fb923c';
      ctx.beginPath();
      ctx.arc(cx, ship.y + ship.h / 2, 46 + Math.sin(time * 0.6) * 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  };

  UBG.drawMegaBeam = function () {
    const { ctx, ship, time } = UBG;
    if (!ship || ship.beam <= 0) return;
    const cx = ship.x + ship.w / 2, bw = 24 + Math.sin(time * 0.12) * 5;
    ctx.save();
    const g = ctx.createLinearGradient(cx - bw, 0, cx + bw, 0);
    g.addColorStop(0, '#c084fc00');
    g.addColorStop(0.35, '#c084fcaa');
    g.addColorStop(0.5, '#fff');
    g.addColorStop(0.65, '#c084fcaa');
    g.addColorStop(1, '#c084fc00');
    ctx.fillStyle = g;
    ctx.fillRect(cx - bw, 0, bw * 2, ship.y);
    ctx.restore();
  };

  UBG.drawMissile = function (m) {
    const { ctx } = UBG;
    if (m.trail && m.trail.length > 1) {
      ctx.save();
      for (let i = 1; i < m.trail.length; i++) {
        const p0 = m.trail[i - 1], p1 = m.trail[i];
        ctx.globalAlpha = (i / m.trail.length) * 0.55;
        ctx.strokeStyle = '#fb7185';
        ctx.lineWidth = (i / m.trail.length) * 4;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(m.angle + Math.PI / 2);
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#fb7185';
    ctx.fillStyle = '#ffe4e6';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(3.5, 5);
    ctx.lineTo(0, 3);
    ctx.lineTo(-3.5, 5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(0, 6, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  UBG.drawEnemy = function (e) {
    const { ctx, time } = UBG;
    const flashed = (e.hitFlash || 0) > 0;
    const fillCol = flashed ? '#ffffff' : e.color;
    ctx.save();
    ctx.translate(e.x + e.w / 2, e.y + e.h / 2);

    // Hào quang vàng cho quái Tinh Nhuệ (Elite)
    if (e.elite) {
      ctx.save();
      ctx.rotate(time * 0.04);
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1.8;
      ctx.shadowBlur = 14;
      ctx.shadowColor = '#facc15';
      const r = Math.max(e.w, e.h) * 0.54;
      ctx.strokeRect(-r, -r, r * 2, r * 2);
      ctx.restore();
    }

    if (e.type === 'SCOUT') {
      ctx.shadowBlur = flashed ? 18 : 11;
      ctx.shadowColor = flashed ? '#ffffff' : e.color;
      ctx.fillStyle = flashed ? '#ffffff' : '#0b2922';
      ctx.strokeStyle = fillCol;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, e.h / 2);
      ctx.lineTo(e.w * 0.48, -e.h * 0.25);
      ctx.lineTo(e.w * 0.2, -e.h * 0.5);
      ctx.lineTo(0, -e.h * 0.22);
      ctx.lineTo(-e.w * 0.2, -e.h * 0.5);
      ctx.lineTo(-e.w * 0.48, -e.h * 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = flashed ? '#0f172a' : (e.elite ? '#facc15' : '#a7f3d0');
      ctx.beginPath();
      ctx.moveTo(0, 5); ctx.lineTo(5, -6); ctx.lineTo(0, -10); ctx.lineTo(-5, -6);
      ctx.closePath();
      ctx.fill();
    } else if (e.type === 'STRIKER') {
      ctx.shadowBlur = flashed ? 20 : 13;
      ctx.shadowColor = flashed ? '#ffffff' : e.color;
      ctx.fillStyle = flashed ? '#ffffff' : '#291036';
      ctx.strokeStyle = fillCol;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(0, e.h * 0.52);
      ctx.lineTo(e.w * 0.22, e.h * 0.12);
      ctx.lineTo(e.w * 0.5, -e.h * 0.28);
      ctx.lineTo(e.w * 0.22, -e.h * 0.5);
      ctx.lineTo(0, -e.h * 0.18);
      ctx.lineTo(-e.w * 0.22, -e.h * 0.5);
      ctx.lineTo(-e.w * 0.5, -e.h * 0.28);
      ctx.lineTo(-e.w * 0.22, e.h * 0.12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = flashed ? '#0f172a' : (e.elite ? '#facc15' : '#f5d0fe');
      ctx.beginPath();
      ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.shadowBlur = flashed ? 22 : 14;
      ctx.shadowColor = flashed ? '#ffffff' : e.color;
      ctx.fillStyle = flashed ? '#ffffff' : '#2d160b';
      ctx.strokeStyle = fillCol;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-e.w * 0.34, -e.h * 0.48);
      ctx.lineTo(e.w * 0.34, -e.h * 0.48);
      ctx.lineTo(e.w * 0.5, -e.h * 0.12);
      ctx.lineTo(e.w * 0.36, e.h * 0.46);
      ctx.lineTo(-e.w * 0.36, e.h * 0.46);
      ctx.lineTo(-e.w * 0.5, -e.h * 0.12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = flashed ? '#e2e8f0' : '#9a3412';
      ctx.fillRect(-e.w * 0.46, 2, 7, e.h * 0.44);
      ctx.fillRect(e.w * 0.46 - 7, 2, 7, e.h * 0.44);

      ctx.strokeStyle = flashed ? '#0f172a' : (e.elite ? '#facc15' : '#fdba74');
      ctx.lineWidth = 1.8;
      ctx.strokeRect(-11, -11, 22, 22);
      ctx.fillStyle = flashed ? '#0f172a' : '#ffedd5';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(e.x, e.y - 7, e.w, 3);
    ctx.fillStyle = flashed ? '#ffffff' : (e.elite ? '#facc15' : e.color);
    ctx.fillRect(e.x, e.y - 7, e.w * Math.max(0, e.hp) / e.maxHp, 3);
  };

  UBG.drawBoss = function () {
    const { ctx, boss, W, H, time, bossEnragedBanner } = UBG;
    if (!boss) return;
    const b = boss, cx = b.x + b.w / 2, cy = b.y + b.h / 2, enraged = b.hp < b.maxHp * 0.48;

    if (b.kind === 'VORTEX' && b.telegraphTimer > 0) {
      ctx.save();
      ctx.strokeStyle = enraged ? '#fb7185aa' : '#c084fcaa';
      ctx.setLineDash([7, 6]);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(b.sweepX, b.y + b.h - 8);
      ctx.lineTo(b.sweepX, H - 10);
      ctx.stroke();
      ctx.restore();
    }

    if (b.kind === 'VORTEX') {
      const glow = enraged ? '#fb376b' : '#c084fc';
      ctx.save();
      ctx.translate(cx, cy);

      ctx.strokeStyle = glow;
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 18;
      ctx.shadowColor = glow;
      ctx.rotate(b.angle * 0.7);
      ctx.strokeRect(-68, -54, 136, 108);
      ctx.rotate(-b.angle * 1.4);
      ctx.strokeRect(-50, -40, 100, 80);
      ctx.rotate(b.angle * 0.7);
      ctx.shadowBlur = 0;

      ctx.fillStyle = b.flash > 0 ? '#fff' : (enraged ? '#450a1e' : '#24143a');
      ctx.strokeStyle = b.flash > 0 ? '#ffffff' : glow;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -62); ctx.lineTo(96, -8); ctx.lineTo(54, 58);
      ctx.lineTo(0, 38); ctx.lineTo(-54, 58); ctx.lineTo(-96, -8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = glow;
      ctx.shadowBlur = 22;
      ctx.shadowColor = glow;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = b.spiralAngle + (i * Math.PI) / 3;
        const rad = i % 2 === 0 ? 25 : 13;
        const px = Math.cos(a) * rad, py = Math.sin(a) * rad + 4;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 4, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();

      const ratio = Math.max(0, b.hp / b.maxHp);
      ctx.fillStyle = '#0f172a'; ctx.fillRect(28, 68, W - 56, 11);
      ctx.fillStyle = b.flash > 0 ? '#ffffff' : glow; ctx.fillRect(28, 68, (W - 56) * ratio, 11);
      ctx.strokeStyle = '#cbd5e1'; ctx.strokeRect(28, 68, W - 56, 11);
      ctx.fillStyle = glow; ctx.font = 'bold 11px Segoe UI'; ctx.textAlign = 'left';
      ctx.fillText('VORTEX CORE LV.' + b.level + (enraged ? ' [ENRAGED]' : ''), 28, 61);
      ctx.textAlign = 'right'; ctx.fillText(Math.ceil(b.hp) + ' / ' + b.maxHp, W - 28, 61);
    } else {
      const glow = enraged ? '#fb376b' : '#38bdf8';
      ctx.save();
      ctx.translate(cx, cy);
      ctx.strokeStyle = glow; ctx.lineWidth = 3; ctx.shadowBlur = 18; ctx.shadowColor = glow;
      ctx.beginPath(); ctx.ellipse(0, 0, 125, 79, b.angle * 0.15, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 0, 105, 64, -b.angle * 0.2, 0, Math.PI * 2); ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = b.flash > 0 ? '#fff' : (enraged ? '#4c1028' : '#14243a');
      ctx.strokeStyle = b.flash > 0 ? '#ffffff' : glow; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 67); ctx.lineTo(-48, 38); ctx.lineTo(-105, 12); ctx.lineTo(-82, -49); ctx.lineTo(-36, -59);
      ctx.lineTo(0, -42); ctx.lineTo(36, -59); ctx.lineTo(82, -49); ctx.lineTo(105, 12); ctx.lineTo(48, 38);
      ctx.closePath(); ctx.fill(); ctx.stroke();

      ctx.fillStyle = '#64748b'; ctx.fillRect(-78, -14, 36, 26); ctx.fillRect(42, -14, 36, 26);
      ctx.fillStyle = glow; ctx.shadowBlur = 20; ctx.shadowColor = glow;
      ctx.beginPath(); ctx.arc(0, 7, 24 + Math.sin(time * 0.1) * 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 7, 9, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();

      const ratio = Math.max(0, b.hp / b.maxHp);
      ctx.fillStyle = '#0f172a'; ctx.fillRect(28, 68, W - 56, 11);
      ctx.fillStyle = b.flash > 0 ? '#ffffff' : glow; ctx.fillRect(28, 68, (W - 56) * ratio, 11);
      ctx.strokeStyle = '#cbd5e1'; ctx.strokeRect(28, 68, W - 56, 11);
      ctx.fillStyle = glow; ctx.font = 'bold 11px Segoe UI'; ctx.textAlign = 'left';
      ctx.fillText('FLAGSHIP LV.' + b.level + (enraged ? ' [ENRAGED]' : ''), 28, 61);
      ctx.textAlign = 'right'; ctx.fillText(Math.ceil(b.hp) + ' / ' + b.maxHp, W - 28, 61);
    }

    if (bossEnragedBanner > 0) {
      ctx.save();
      ctx.globalAlpha = clamp(bossEnragedBanner / 35, 0, 1);
      ctx.font = '900 13px Segoe UI';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fb7185';
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#fb376b';
      ctx.fillText('⚡ BOSS ENRAGED — TĂNG TỐC ĐẠN ⚡', W / 2, 104);
      ctx.restore();
    }
  };

  UBG.drawPlayerShot = function (s) {
    const { ctx } = UBG;
    ctx.save();
    const tailX = s.x - s.vx * 2.1;
    const tailY = s.y - s.vy * 1.45;
    const isOver = s.damage > 1.4;
    const outerW = isOver ? 7.5 : 5;

    const grad = ctx.createLinearGradient(s.x, s.y, tailX, tailY);
    grad.addColorStop(0, s.core || '#ffffff');
    grad.addColorStop(0.35, s.color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.strokeStyle = grad;
    ctx.lineWidth = outerW;
    ctx.lineCap = 'round';
    ctx.shadowBlur = isOver ? 16 : 11;
    ctx.shadowColor = s.color;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(tailX, tailY);
    ctx.stroke();

    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, isOver ? 4.2 : 2.8, isOver ? 8.5 : 6.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = s.core || '#ffffff';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 1, isOver ? 2.1 : 1.3, isOver ? 4.5 : 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  UBG.drawEnemyBullet = function (b) {
    const { ctx } = UBG;
    ctx.save();
    const mag = Math.hypot(b.vx, b.vy) || 1;
    const nx = b.vx / mag, ny = b.vy / mag;

    const tailGrad = ctx.createLinearGradient(b.x, b.y, b.x - nx * (b.r * 3.2), b.y - ny * (b.r * 3.2));
    tailGrad.addColorStop(0, b.color);
    tailGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.strokeStyle = tailGrad;
    ctx.lineWidth = b.r * 1.15;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - nx * (b.r * 3.2), b.y - ny * (b.r * 3.2));
    ctx.stroke();

    ctx.globalAlpha = 0.35;
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 1.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = b.color;
    ctx.shadowBlur = 12;
    ctx.shadowColor = b.color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = b.core || '#ffffff';
    ctx.beginPath();
    ctx.arc(b.x, b.y, Math.max(1.6, b.r * 0.44), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
})();
