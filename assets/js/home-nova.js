/**
 * NOVA HOME — comportamento de tudo que vem depois do banner.
 * Fonte oficial: referencia/nova-home/index.html (prévia pública em
 * https://verite-nova-home.vercel.app). Estilos em assets/css/home-nova.css.
 *
 *  1. Coleção em salas: rolagem vertical → trilho horizontal, fundos que se
 *     misturam, partículas por sala (canvas), borrifada ao clicar no frasco.
 *  2. Letreiro de valores que acelera com a rolagem.
 *  3. Manifesto: palavras acendem, facho de luz e fumaça.
 *  4. Quiz: só veste os botões que assets/js/quiz.js cria (ícone + aura).
 *  5. Cartão do Clube entra girando e segue o mouse.
 *  6. Acesso antecipado: acende os frascos quando main.js marca .is-sent.
 * Um único requestAnimationFrame, que só trabalha com a seção na tela.
 * Tudo desliga em prefers-reduced-motion.
 */
(() => {
  if (!document.getElementById('colecao') || !document.getElementById('roomsStage')) return;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t;
  const ss = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const R = (() => { let a = 11; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();

  /* brilho que passa pelo frasco: recortado no formato da própria foto */
  $$('i[data-mask]').forEach(i => { const img = i.previousElementSibling; if (!img) return; const u = `url("${img.getAttribute('src')}")`; i.style.webkitMaskImage = u; i.style.maskImage = u; });

  const sprite = (inner, outer = 'rgba(0,0,0,0)') => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, inner); gr.addColorStop(1, outer); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c; };
  const secProg = (sec, stg, top) => { const r = sec.getBoundingClientRect(), total = sec.offsetHeight - stg.offsetHeight; return total > 0 ? clamp((top - r.top) / total) : 0; };
  let HH = 0, VW = innerWidth, VH = innerHeight;

  /* ================= 1. A COLEÇÃO EM SALAS ================= */
  const rooms = $('#colecao'), rStage = $('#roomsStage'), track = $('#track');
  const roomEls = $$('.h-room'), bgl = $$('.h-bgl'), words = $$('.h-word'), bottles = $$('.h-bottle'), infos = $$('.h-info'), navB = $$('.h-nav button'), rNum = $('#rNum');
  const N = roomEls.length;
  const LIGHT = [[244, 206, 196], [226, 150, 62], [240, 206, 120], [214, 176, 100]];
  const cv = $('#roomsFx'), cx = cv.getContext('2d');
  let CW = 1, CH = 1, DPR = 1, wordW = [], P = 0, pos = 0, curRoom = -1;
  const spRose = sprite('rgba(250,214,204,.9)'), spPetal = sprite('rgba(240,176,170,.9)'), spAmber = sprite('rgba(214,136,52,.5)'), spEmber = sprite('rgba(255,178,90,1)'), spGold = sprite('rgba(255,228,160,1)'), spWhite = sprite('rgba(255,250,235,1)');
  const bokeh = Array.from({ length: 34 }, () => ({ x: R(), y: R(), r: 8 + R() * 30, s: .3 + R() * .7, ph: R() * 6.28, a: .08 + R() * .2 }));
  const petals = Array.from({ length: 14 }, () => ({ x: R(), y: R(), s: .4 + R() * .6, ph: R() * 6.28, rot: R() * 6.28 }));
  const smoke = Array.from({ length: 16 }, () => ({ x: R(), y: .35 + R() * .6, r: 140 + R() * 220, s: .2 + R() * .5, ph: R() * 6.28 }));
  const embers = Array.from({ length: 46 }, () => ({ x: R(), y: R(), s: .5 + R(), ph: R() * 6.28 }));
  const dust = Array.from({ length: 90 }, () => ({ x: R(), y: R(), s: .2 + R() * .6, ph: R() * 6.28, z: .4 + R() * .9 }));
  const ribbons = Array.from({ length: 4 }, (_, k) => ({ y: .2 + k * .19 + R() * .06, amp: .05 + R() * .07, f: 1 + R() * 1.4, sp: .15 + R() * .2, ph: R() * 6.28, w: .6 + R() * 1.2 }));
  const burst = [];
  const ptr = { x: .5, y: .5, tx: .5, ty: .5, on: false };

  function sizeRooms() {
    const r = rStage.getBoundingClientRect(); DPR = Math.min(devicePixelRatio || 1, 1.5); CW = Math.max(1, r.width); CH = Math.max(1, r.height);
    cv.width = Math.round(CW * DPR); cv.height = Math.round(CH * DPR);
    wordW = words.map(w => w.scrollWidth);
  }

  function drawRoomsFx(t, dt) {
    const c = cx; c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, CW, CH); c.globalCompositeOperation = 'lighter';
    const W = CW, H = CH, w = [0, 1, 2, 3].map(i => clamp(1 - Math.abs(pos - i)));
    const off = i => -(pos - i) * W * .55;

    /* luz que segue o mouse, na cor da sala */
    ptr.x += (ptr.tx - ptr.x) * (1 - Math.exp(-dt * 4)); ptr.y += (ptr.ty - ptr.y) * (1 - Math.exp(-dt * 4));
    const k = clamp(Math.round(pos), 0, N - 1), L = LIGHT[k];
    const lx = ptr.on ? ptr.x * W : W * (.34 + Math.sin(t * .25) * .05), ly = ptr.on ? ptr.y * H : H * (.5 + Math.cos(t * .2) * .05);
    const g = c.createRadialGradient(lx, ly, 0, lx, ly, Math.max(W, H) * .42);
    g.addColorStop(0, `rgba(${L[0]},${L[1]},${L[2]},${ptr.on ? .16 : .08})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);

    /* 0 · Feminino: bokeh rosado e pétalas de luz */
    if (w[0] > .01) {
      const o = off(0);
      for (const b of bokeh) { const y = H * (1.1 - ((b.y + t * .012 * b.s) % 1.2)), x = W * b.x + o + Math.sin(t * .5 + b.ph) * 18; c.globalAlpha = w[0] * b.a * (.6 + .4 * Math.sin(t + b.ph)); c.drawImage(spRose, x - b.r, y - b.r, b.r * 2, b.r * 2); }
      for (const p of petals) {
        const y = H * (((p.y + t * .02 * p.s) % 1.2) - .1), x = W * p.x + o + Math.sin(t * .7 + p.ph) * 40, rot = p.rot + t * .6 * p.s;
        c.save(); c.translate(x, y); c.rotate(rot); c.scale(1, .45 + .35 * Math.sin(t * 1.3 + p.ph)); c.globalAlpha = w[0] * .5; c.drawImage(spPetal, -9, -9, 18, 18); c.restore();
      }
    }
    /* 1 · Masculino: fumaça âmbar e brasas subindo */
    if (w[1] > .01) {
      const o = off(1);
      for (const s of smoke) { const x = W * (((s.x + t * .008 * s.s) % 1.3) - .15) + o, y = H * s.y + Math.sin(t * .3 + s.ph) * 24; c.globalAlpha = w[1] * .55; c.drawImage(spAmber, x - s.r, y - s.r * .55, s.r * 2, s.r * 1.1); }
      for (const e of embers) { const y = H * (1.05 - ((e.y + t * .03 * e.s) % 1.1)), x = W * e.x + o + Math.sin(t * 1.4 + e.ph) * 12, r = 1.4 + e.s * 1.8; c.globalAlpha = w[1] * (.35 + .65 * Math.abs(Math.sin(t * 3 + e.ph))); c.drawImage(spEmber, x - r * 2, y - r * 2, r * 4, r * 4); }
    }
    /* 2 · Doréa: poeira de ouro num facho de luz */
    if (w[2] > .01) {
      const o = off(2);
      c.globalAlpha = w[2] * .5; const sx = W * .72 + o * .6; const lg = c.createLinearGradient(sx, 0, sx - W * .35, H); lg.addColorStop(0, 'rgba(255,226,150,.16)'); lg.addColorStop(1, 'rgba(255,226,150,0)');
      c.fillStyle = lg; c.beginPath(); c.moveTo(sx - W * .05, 0); c.lineTo(sx + W * .07, 0); c.lineTo(sx - W * .12, H); c.lineTo(sx - W * .52, H); c.closePath(); c.fill();
      for (const d of dust) {
        const y = H * ((d.y + t * .006 * d.s) % 1), x = W * d.x + o * d.z + Math.sin(t * .4 + d.ph) * 10, tw = Math.pow(Math.abs(Math.sin(t * 1.6 * d.s + d.ph)), 6), r = 1 + d.z * 1.6;
        c.globalAlpha = w[2] * (.25 + .75 * tw); c.drawImage(spGold, x - r * 2, y - r * 2, r * 4, r * 4);
        if (tw > .6) { c.globalAlpha = w[2] * (tw - .6) * 1.6; c.drawImage(spWhite, x - r * 7, y - .6, r * 14, 1.2); c.drawImage(spWhite, x - .6, y - r * 7, 1.2, r * 14); }
      }
    }
    /* 3 · Kit: fitas de luz dourada, como um presente */
    if (w[3] > .01) {
      const o = off(3);
      c.lineCap = 'round';
      for (const rb of ribbons) {
        for (let pass = 0; pass < 2; pass++) {
          c.beginPath();
          for (let i = 0; i <= 48; i++) { const u = i / 48, x = -W * .1 + u * W * 1.2 + o, y = H * (rb.y + Math.sin(u * 6.28 * rb.f + t * rb.sp + rb.ph) * rb.amp + Math.sin(u * 3 + t * .2) * .02); i ? c.lineTo(x, y) : c.moveTo(x, y); }
          c.strokeStyle = pass ? 'rgba(255,236,190,.55)' : 'rgba(214,170,80,.10)'; c.lineWidth = pass ? rb.w : rb.w * 14; c.globalAlpha = w[3] * (pass ? .6 : 1); c.stroke();
        }
      }
      for (let i = 0; i < 40; i++) { const d = dust[i], y = H * ((d.y + t * .01 * d.s) % 1), x = W * d.x + o, tw = Math.pow(Math.abs(Math.sin(t * 1.2 * d.s + d.ph)), 8); c.globalAlpha = w[3] * tw; c.drawImage(spGold, x - 4, y - 4, 8, 8); }
    }
    /* borrifada ao clicar no frasco */
    for (let i = burst.length - 1; i >= 0; i--) {
      const s = burst[i]; s.life += dt; if (s.life > s.max) { burst.splice(i, 1); continue; }
      const drag = Math.pow(.08, dt); s.vx *= drag; s.vy = s.vy * drag + 14 * dt; s.x += s.vx * dt; s.y += s.vy * dt;
      const a = 1 - s.life / s.max, r = s.r * (1 + s.life * 1.6); c.globalAlpha = a * .8; c.drawImage(s.sp, s.x - r * 2, s.y - r * 2, r * 4, r * 4);
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  }

  function roomsFrame(t, dt) {
    const raw = secProg(rooms, rStage, HH);
    P += (raw - P) * (1 - Math.exp(-dt * 7)); if (Math.abs(raw - P) < 1e-4) P = raw;
    const f = clamp((P - .03) / .94) * (N - 1), k = Math.min(N - 2, Math.floor(f)), tt = f - k;
    pos = k + ss(.2, .8, tt);
    const W = CW;
    track.style.transform = `translate3d(${(-pos * W).toFixed(1)}px,0,0)`;
    for (let i = 0; i < N; i++) {
      const o = pos - i, ao = Math.abs(o);
      bgl[i].style.opacity = clamp(1 - ao).toFixed(3);
      if (ao > 1.2) continue;
      words[i].style.setProperty('--wx', ((W - wordW[i]) / 2 + o * W * .5).toFixed(1) + 'px');
      const b = bottles[i];
      b.style.setProperty('--bx', (-o * W * .22).toFixed(1) + 'px');
      b.style.setProperty('--br', (-o * 5).toFixed(2) + 'deg');
      b.style.setProperty('--fy', (Math.sin(t * .9 + i) * 7).toFixed(1) + 'px');
      b.firstElementChild.lastElementChild.style.setProperty('--sw', (140 - 200 * Math.min(1, (t * .13 + i * .3 + (1 - Math.min(1, ao)) * .9) % 1.6)).toFixed(1) + '%');
      infos[i].style.setProperty('--ix', (o * W * .12).toFixed(1) + 'px');
      infos[i].style.setProperty('--io', clamp(1 - ao * 1.7).toFixed(3));
    }
    navB.forEach((b, i) => { b.firstElementChild.firstElementChild.style.setProperty('--f', clamp(pos - i + 1).toFixed(3)); });
    const cur = clamp(Math.round(pos), 0, N - 1);
    if (cur !== curRoom) { curRoom = cur; rNum.textContent = '0' + (cur + 1); navB.forEach((b, i) => { b.classList.toggle('on', i === cur); i === cur ? b.setAttribute('aria-current', 'true') : b.removeAttribute('aria-current'); }); }
    drawRoomsFx(t, dt);
  }

  const roomScrollTop = i => { const total = rooms.offsetHeight - rStage.offsetHeight, top = rooms.getBoundingClientRect().top + scrollY - HH; const f = i / (N - 1), p = .03 + f * .94; return top + p * total; };
  navB.forEach((b, i) => b.addEventListener('click', () => scrollTo({ top: roomScrollTop(i) + 2, behavior: reduce ? 'auto' : 'smooth' })));
  rStage.addEventListener('pointermove', e => { const r = rStage.getBoundingClientRect(); ptr.tx = (e.clientX - r.left) / r.width; ptr.ty = (e.clientY - r.top) / r.height; ptr.on = e.pointerType === 'mouse'; });
  rStage.addEventListener('pointerleave', () => { ptr.on = false; });
  const BURST_SP = [spRose, spEmber, spGold, spGold];
  rStage.addEventListener('pointerdown', e => {
    const b = e.target.closest('.h-bottle'); if (!b || reduce) return;
    const i = +b.dataset.room, br = b.firstElementChild.getBoundingClientRect(), sr = rStage.getBoundingClientRect();
    const x = br.left - sr.left + br.width * (i === 3 ? .5 : .5), y = br.top - sr.top + br.height * (i === 3 ? .1 : .04);
    for (let n = 0; n < 70; n++) { const a = -Math.PI / 2 + .9 + (R() - .5) * 1.5, v = 90 + R() * 360; burst.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 1.1 + R() * 1.1, r: .9 + R() * 1.8, sp: BURST_SP[i] }); }
    if (burst.length > 500) burst.splice(0, burst.length - 500);
  });

  /* ================= 2. VALORES EM LETREIRO ================= */
  const VALUES = ['Autenticidade', 'Elegância', 'Qualidade', 'Presença', 'Exclusividade'];
  const marqs = $$('.h-marq');
  marqs.forEach((m, r) => {
    const seq = VALUES.map((v, k) => `<span${(k + r) % 2 ? ' class="o"' : ''}>${v}</span><i>✦</i>`).join('');
    m.innerHTML = seq + seq + seq;
  });
  const mq = marqs.map((m, r) => ({ el: m, x: r ? -200 : 0, dir: +m.dataset.dir, half: 1 }));
  const sizeMarq = () => mq.forEach(q => { q.half = q.el.scrollWidth / 3; });
  let lastY = scrollY, vel = 0;
  function marqFrame(dt) {
    const y = scrollY, v = (y - lastY) / Math.max(dt, .001); lastY = y; vel += (v - vel) * (1 - Math.exp(-dt * 5));
    const boost = clamp(Math.abs(vel) / 900, 0, 4);
    mq.forEach(q => { q.x += q.dir * (40 + boost * 180) * dt * (vel < 0 ? -1 : 1); if (q.x <= -q.half) q.x += q.half; if (q.x > 0) q.x -= q.half; q.el.style.transform = `translate3d(${q.x.toFixed(1)}px,0,0)`; });
  }

  /* ================= 3. MANIFESTO ================= */
  const mf = $('#manifesto'), mfStage = $('#mfStage'), mfT = $('#mfText'), mfSign = $('#mfSign'), beam = $('#mfBeam');
  mfT.innerHTML = mfT.textContent.trim().split(/\s+/).map(w => w.startsWith('*') ? `<span class="g">${w.slice(1)}</span>` : `<span>${w}</span>`).join(' ');
  const mWords = [...mfT.querySelectorAll('span')];
  const mcv = $('#mfFx'), mc = mcv.getContext('2d'); let MW = 1, MH = 1, MD = 1;
  const spSmoke = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(230,196,130,.20)'); gr.addColorStop(.45, 'rgba(230,196,130,.08)'); gr.addColorStop(1, 'rgba(230,196,130,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return c; })(), mSmoke = Array.from({ length: 18 }, () => ({ x: R(), y: R(), r: 120 + R() * 200, s: .3 + R() * .6, ph: R() * 6.28 })), mMotes = Array.from({ length: 60 }, () => ({ x: R(), y: R(), s: .3 + R(), ph: R() * 6.28 }));
  function sizeMf() { const r = mfStage.getBoundingClientRect(); MD = Math.min(devicePixelRatio || 1, 1.5); MW = Math.max(1, r.width); MH = Math.max(1, r.height); mcv.width = Math.round(MW * MD); mcv.height = Math.round(MH * MD); }
  let mP = 0;
  function mfFrame(t, dt) {
    const raw = secProg(mf, mfStage, HH); mP += (raw - mP) * (1 - Math.exp(-dt * 6));
    const n = Math.round(ss(.06, .78, mP) * mWords.length);
    mWords.forEach((w, k) => { const on = k < n; if (w.classList.contains('on') !== on) w.classList.toggle('on', on); });
    const bm = ss(0, .5, mP) * (1 - ss(.97, 1, mP) * .3); beam.style.setProperty('--beam', bm.toFixed(3));
    mfSign.classList.toggle('on', mP > .8);
    const c = mc; c.setTransform(MD, 0, 0, MD, 0, 0); c.clearRect(0, 0, MW, MH); c.globalCompositeOperation = 'lighter';
    for (const s of mSmoke) { const y = MH * (1.15 - ((s.y + t * .01 * s.s) % 1.3)), x = MW * (.5 + (s.x - .5) * (.25 + (1.15 - y / MH) * .35)) + Math.sin(t * .3 + s.ph) * 30; c.globalAlpha = bm * .6; c.drawImage(spSmoke, x - s.r * 1.3, y - s.r * .6, s.r * 2.6, s.r * 1.2); }
    for (const m of mMotes) { const y = MH * ((m.y + t * .008 * m.s) % 1), spread = .1 + (y / MH) * .3, x = MW * (.5 + (m.x - .5) * spread * 2) + Math.sin(t * .5 + m.ph) * 8; c.globalAlpha = bm * (.3 + .7 * Math.abs(Math.sin(t * 2 * m.s + m.ph))); c.drawImage(spGold, x - 2.5, y - 2.5, 5, 5); }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  }
  if (reduce) { mWords.forEach(w => w.classList.add('on')); mfSign.classList.add('on'); }

  /* ================= 4. QUIZ: veste os botões do quiz.js ================= */
  const ICON = {
    'Floral': '<g transform="translate(32 32)"><ellipse rx="7" ry="16" transform="translate(0 -12)"/><ellipse rx="7" ry="16" transform="rotate(60) translate(0 -12)"/><ellipse rx="7" ry="16" transform="rotate(120) translate(0 -12)"/><ellipse rx="7" ry="16" transform="rotate(180) translate(0 -12)"/><ellipse rx="7" ry="16" transform="rotate(240) translate(0 -12)"/><ellipse rx="7" ry="16" transform="rotate(300) translate(0 -12)"/><circle r="4"/></g>',
    'Amadeirada': '<circle cx="32" cy="32" r="26"/><circle cx="33" cy="31" r="19"/><circle cx="31" cy="33" r="13"/><circle cx="32" cy="32" r="7"/><path d="M32 6 L34 20"/>',
    'Cítrica': '<circle cx="32" cy="32" r="26"/><circle cx="32" cy="32" r="21"/><path d="M32 11V53M11 32H53M17 17L47 47M47 17L17 47"/>',
    'Oriental': '<path d="M32 4 L37 24 L56 18 L42 32 L56 46 L37 40 L32 60 L27 40 L8 46 L22 32 L8 18 L27 24 Z"/><circle cx="32" cy="32" r="4"/>',
    'Doce': '<path d="M32 32m0 0a3 3 0 1 1 3 3a8 8 0 1 1 -9 -9a14 14 0 1 1 15 15a20 20 0 1 1 -21 -21"/>',
    'Aromática': '<path d="M14 52 C 14 26, 30 12, 52 10 C 50 34, 38 50, 14 52 Z"/><path d="M14 52 L 44 20M24 42 L24 33M31 35 L31 26M38 28 L39 20M24 42 L33 42M31 35 L40 35"/>',
    'Leve': '<path d="M32 18 C 40 30, 42 36, 42 40 A10 10 0 0 1 22 40 C 22 36, 24 30, 32 18 Z"/>',
    'Moderada': '<path d="M24 22 C 30 32, 32 37, 32 40 A8 8 0 0 1 16 40 C 16 37, 18 32, 24 22 Z"/><path d="M42 16 C 50 28, 52 34, 52 38 A10 10 0 0 1 32 38"/>',
    'Intensa': '<path d="M18 26 C 23 34, 25 38, 25 41 A7 7 0 0 1 11 41 C 11 38, 13 34, 18 26 Z"/><path d="M32 14 C 38 24, 40 30, 40 34 A8 8 0 0 1 24 34"/><path d="M46 26 C 51 34, 53 38, 53 41 A7 7 0 0 1 39 41"/>',
    'Dia a dia': '<circle cx="32" cy="32" r="10"/><path d="M32 8V16M32 48V56M8 32H16M48 32H56M15 15L20 20M44 44L49 49M49 15L44 20M20 44L15 49"/>',
    'Trabalho': '<rect x="10" y="22" width="44" height="30" rx="3"/><path d="M24 22V16H40V22M10 34H54"/>',
    'Noite': '<path d="M44 44 A20 20 0 1 1 26 12 A16 16 0 0 0 44 44 Z"/><path d="M46 14l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5z"/>',
    'Ocasiões especiais': '<path d="M20 10H44L52 24L32 54L12 24Z"/><path d="M12 24H52M26 10L22 24L32 54L42 24L38 10"/>'
  };
  const AURA = { 'Floral': 'rgba(236,158,170,.6)', 'Amadeirada': 'rgba(168,104,48,.65)', 'Cítrica': 'rgba(222,210,88,.5)', 'Oriental': 'rgba(176,52,40,.6)', 'Doce': 'rgba(216,150,78,.58)', 'Aromática': 'rgba(118,162,108,.52)', 'Leve': 'rgba(196,210,232,.45)', 'Moderada': 'rgba(214,178,108,.5)', 'Intensa': 'rgba(204,116,44,.6)', 'Dia a dia': 'rgba(240,218,146,.5)', 'Trabalho': 'rgba(168,180,204,.45)', 'Noite': 'rgba(84,92,176,.55)', 'Ocasiões especiais': 'rgba(241,217,160,.6)' };
  const CAPTION = { 'Floral': 'Delicado e marcante', 'Amadeirada': 'Quente e profunda', 'Cítrica': 'Fresca e luminosa', 'Oriental': 'Intensa e envolvente', 'Doce': 'Macia e acolhedora', 'Aromática': 'Verde e elegante', 'Leve': 'Discreta e próxima', 'Moderada': 'Presente sem exagero', 'Intensa': 'Rastro que fica' };
  const SHELF = [['assets/img/frasco-feminino.webp', ''], ['assets/img/frasco-verite-hero.webp', ''], ['assets/img/frasco-dorea.webp', ''], ['assets/img/frasco-kits.webp', 'kit']];
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function dressQuiz() {
    $$('#quiz .quiz-options:not(.h-opts)').forEach(box => { const n = box.children.length; box.classList.add('h-opts'); if (n === 6) box.classList.add('six'); else if (n === 4) box.classList.add('four'); });
    $$('#quiz .quiz-option:not(.h-opt)').forEach(btn => {
      const label = btn.textContent.trim(); btn.classList.add('h-opt');
      if (AURA[label]) btn.style.setProperty('--aura', AURA[label]);
      btn.innerHTML = (ICON[label] ? `<svg viewBox="0 0 64 64" aria-hidden="true">${ICON[label]}</svg>` : '') + `<b>${esc(label)}</b>` + (CAPTION[label] ? `<small>${CAPTION[label]}</small>` : '');
    });
    /* sem produto compatível ainda: o cartão de perfil ganha os frascos da coleção subindo */
    const prof = $('#quiz .quiz-profile');
    if (prof && !prof.querySelector('.h-shelf')) {
      const shelf = document.createElement('div'); shelf.className = 'h-shelf'; shelf.setAttribute('aria-hidden', 'true');
      shelf.innerHTML = SHELF.map(([src, cls]) => `<img src="${src}" alt=""${cls ? ` class="${cls}"` : ''}>`).join('');
      const tags = prof.querySelector('.quiz-profile-tags'); tags ? tags.after(shelf) : prof.prepend(shelf);
      [...shelf.children].forEach((img, k) => setTimeout(() => img.classList.add('on'), reduce ? 0 : 140 + k * 150));
    }
  }
  const quizApp = $('#quiz-app');
  if (quizApp) { dressQuiz(); new MutationObserver(dressQuiz).observe(quizApp, { childList: true, subtree: true }); }

  /* ================= 5. CLUBE: cartão que entra girando e segue o mouse ================= */
  const card = $('#card'), wrap = $('#cardWrap'), club = $('#clube-home');
  function clubFrame() { const r = card.getBoundingClientRect(); card.style.setProperty('--ent', ss(0, 1, (VH - r.top) / (VH * .75)).toFixed(3)); }
  wrap.addEventListener('pointermove', e => { if (reduce || e.pointerType !== 'mouse') return; const r = card.getBoundingClientRect(), x = clamp((e.clientX - r.left) / r.width), y = clamp((e.clientY - r.top) / r.height); card.style.setProperty('--ry', ((x - .5) * 24).toFixed(2) + 'deg'); card.style.setProperty('--rx', ((.5 - y) * 16).toFixed(2) + 'deg'); card.style.setProperty('--sx', (x * 100).toFixed(1) + '%'); card.style.setProperty('--sy', (y * 100).toFixed(1) + '%'); });
  wrap.addEventListener('pointerleave', () => { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); });

  /* ================= 6. ACESSO ANTECIPADO: frascos acendem quando o envio dá certo ================= */
  const acSec = $('#lancamento'), acBox = acSec && acSec.querySelector('[data-form-container]');
  if (acBox) { const sync = () => acSec.classList.toggle('is-done', acBox.classList.contains('is-sent')); sync(); new MutationObserver(sync).observe(acBox, { attributes: true, attributeFilter: ['class'] }); }

  /* ================= revelações ================= */
  const rio = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); rio.unobserve(en.target); } }), { threshold: .15, rootMargin: '0px 0px -8% 0px' });
  $$('.rv').forEach(el => rio.observe(el));

  /* ================= laço único, só com as seções na tela ================= */
  /* o palco gruda em top:var(--header-h-compact), que main.js publica e atualiza */
  function measure() { HH = parseFloat(getComputedStyle(rStage).top) || 0; VW = innerWidth; VH = innerHeight; sizeRooms(); sizeMf(); sizeMarq(); }
  measure();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  let rt; const later = () => { clearTimeout(rt); rt = setTimeout(measure, 150); }; addEventListener('resize', later); addEventListener('load', later);
  const hdr = document.querySelector('header'); if (hdr && window.ResizeObserver) new ResizeObserver(later).observe(hdr);
  if (reduce) { words.forEach((w, i) => w.style.setProperty('--wx', ((CW - wordW[i]) / 2).toFixed(1) + 'px')); card.style.setProperty('--ent', '1'); return; }

  const vis = new Set();
  const io = new IntersectionObserver(es => es.forEach(en => en.isIntersecting ? vis.add(en.target) : vis.delete(en.target)), { threshold: 0, rootMargin: '100px 0px' });
  [rooms, $('.h-values'), mf, club].forEach(el => io.observe(el));
  let last = performance.now(); const T0 = last;
  function loop(now) {
    const dt = Math.min(.05, (now - last) / 1000 || .016), t = (now - T0) / 1000; last = now;
    if (!document.hidden) {
      if (vis.has(rooms)) roomsFrame(t, dt);
      if (vis.has(marqs[0].parentElement)) marqFrame(dt); else { lastY = scrollY; }
      if (vis.has(mf)) mfFrame(t, dt);
      if (vis.has(club)) clubFrame();
    }
    requestAnimationFrame(loop);
  }
  roomsFrame(0, 1); requestAnimationFrame(loop);
})();
