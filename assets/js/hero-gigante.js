/**
 * Banner "Impossível de ignorar" — o frasco gigante que toma a cidade.
 *
 * Cópia fiel do protótipo aprovado (referencia/banner-gigante-referencia.html,
 * que segue no repositório como fonte oficial e fora do deploy). A lógica de
 * desenho — paisagem noturna, câmera, névoa, partículas, borrifo, estúdio
 * final — está IGUAL à do original. Só duas coisas mudaram, as duas por
 * causa do encaixe no site, e as duas marcadas com "AJUSTE DO SITE":
 *
 *   1. O palco gruda ABAIXO do cabeçalho do site (que é sticky e existe em
 *      todas as páginas), não no topo da janela. Sem isso a primeira cena
 *      ficava parcialmente escondida atrás do cabeçalho.
 *   2. O progresso da rolagem desconta esse mesmo offset, senão a cena
 *      terminaria antes de o palco se soltar.
 *
 * Tudo mais — nomes, constantes, ordem das funções — é o arquivo original.
 */
(() => {
  const $ = s => document.querySelector(s);
  /* AJUSTE DO SITE: no protótipo a seção alta tinha id="film". Aqui ela é a
     seção #inicio da home (o id é âncora do menu e não pode mudar), então o
     seletor aceita os dois. Nada mais muda. */
  const film = $('#film') || $('#inicio.hero-gigante'), stage = $('#stage');
  if (!film || !stage) return;
  const back = $('#back'), front = $('#front'), fx = $('#fx');
  const bx = back.getContext('2d'), fr = front.getContext('2d'), xx = fx.getContext('2d');
  const hero = $('#hero'), refl = $('#refl'), heroGlow = $('#heroGlow');
  document.querySelectorAll('[data-bottle]').forEach(i => { i.src = $('#heroImg').src; });
  const flash = $('#flash'), studio = $('#studio'), hint = $('#hint');
  const copies = ['#c1', '#c2', '#c3', '#c4'].map($);
  const railBtns = [...document.querySelectorAll('#rail button')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) document.documentElement.classList.add('static');

  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const ss = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const eio = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const eo = t => 1 - Math.pow(1 - t, 3);
  const band = (p, a, b, f = .03) => ss(a - f, a, p) * (1 - ss(b, b + f, p));
  function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  /* frasco real: proporção medida da foto (263 x 481) */
  const BH = 600, BW = BH * 263 / 481;
  const BOT = { x: 800 - BW / 2, y: 797 - BH, w: BW, h: BH };
  const CAP_TOP = BOT.y + .03 * BH, SHOULDER = BOT.y + .30 * BH, HALF = .475 * BW, CAPHALF = .37 * BW;

  /* ---------- paisagem noturna: morros, cidade, igrejas, orla com palmeiras, na frente do frasco ---------- */
  const R = mulberry(20260925);
  const X0 = -700, X1 = 2300;
  const NT = []; for (let i = 0; i < 1024; i++) NT.push(R());
  const n1 = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(NT[i & 1023], NT[(i + 1) & 1023], u); };
  const fbm = x => n1(x) * .55 + n1(x * 2.1 + 7) * .28 + n1(x * 4.3 + 13) * .17;
  const LIGHTS = [[255, 164, 80], [255, 184, 108], [255, 212, 158], [248, 234, 208], [214, 228, 246], [176, 204, 244]];
  const pickCol = r => r < .36 ? LIGHTS[0] : r < .52 ? LIGHTS[1] : r < .72 ? LIGHTS[2] : r < .87 ? LIGHTS[3] : r < .95 ? LIGHTS[4] : LIGHTS[5];
  const winCol = () => { const r = R(); return r < .5 ? [255, 206, 142] : r < .74 ? [250, 226, 186] : r < .86 ? [255, 180, 110] : r < .95 ? [206, 222, 244] : [150, 180, 255]; };
  const BX0 = 800 - 190, BX1 = 800 + 190; // faixa na frente do frasco: prédios baixos para não cobrir o rótulo

  /* morros ao fundo */
  const ridge = x => 700 + fbm(x / 230 + 3) * 52 - Math.max(0, 1 - Math.abs(x - 1650) / 520) * 40 - Math.max(0, 1 - Math.abs(x + 150) / 420) * 26;
  const hillPts = []; for (let i = 0; i < 1600; i++) { const x = X0 + R() * (X1 - X0), top = ridge(x), k = Math.pow(R(), .6), y = top + 3 + k * (762 - top); if (R() < .25 + k * .7) hillPts.push([x, y, .6 + R() * .6, pickCol(R() * .75), .25 + R() * .6]); }

  /* cidade distante: campo de luzes + torres altas */
  const farPts = []; for (let i = 0; i < 15000; i++) { const x = X0 + R() * (X1 - X0); const d = fbm(x / 120 + 50); if (R() > d * 1.25 - .05) continue; const t = Math.pow(R(), .5); farPts.push([x, 734 + t * 36 + (R() - .5) * 3, .6 + R() * .8, pickCol(R()), .2 + Math.pow(R(), 2.2) * .95]); }
  const towers = []; const farRects = [];
  for (let i = 0; i < 20; i++) {
    const x = X0 + 150 + R() * (X1 - X0 - 300), w = 9 + R() * 16, h = 60 + Math.pow(R(), 1.4) * 140; towers.push([x, w, h]);
    const occ = .15 + R() * .4; for (let fy = 773 - h + 4; fy < 768; fy += 3.6) for (let fx = x + 1.4; fx < x + w - 1.6; fx += 2.6) if (R() < occ) farRects.push([fx, fy, 1.4, 1.8, winCol(), .35 + R() * .55]);
  }
  const beacons = towers.filter(t => t[2] > 110).map(t => [t[0] + t[1] / 2, 773 - t[2] - 3, R() * 6]);

  /* casario do meio: prédios com andares, igrejas barrocas iluminadas, guindaste */
  const midB = [], midRects = [], midPts = [];
  for (let x = X0; x < X1;) {
    const w = 12 + R() * 38, h = 22 + Math.pow(R(), 1.5) * 78; const b = { x, w, h, tone: R(), roof: R() };
    midB.push(b);
    const occ = R() < .15 ? .02 : .12 + R() * .4; const fh = 4.4, ww = 1.9, wh = 2.4, sp = 3.2;
    for (let fy = 787 - h + 3.5; fy < 783; fy += fh) { const floorOcc = occ * (R() < .3 ? 2 : R() < .4 ? .2 : 1); let run = 0; for (let fx = x + 1.6; fx < x + w - 2; fx += sp) { if (run > 0 || R() < floorOcc) { if (run <= 0) run = 1 + Math.floor(R() * 3); run--; midRects.push([fx, fy, ww, wh, winCol(), .35 + R() * .6]); } } }
    x += w + R() * 3;
  }
  const churches = [[140 + R() * 80, 1], [1380 + R() * 120, .85]];
  const crane = { x: 1050 + R() * 200, h: 150 };
  for (let x = X0; x < X1; x += 3.5 + R() * 5) if (R() < .8) midPts.push([x, 783 + R() * 4, 1.3, LIGHTS[0], .55 + R() * .4]);

  /* orla em primeiro plano: prédios maiores, fachadas iluminadas de baixo, palmeiras, postes */
  const frontB = [], frontRects = [];
  for (let x = X0; x < X1;) {
    const inFront = x + 60 > BX0 && x < BX1;
    const w = 18 + R() * 46, h = inFront ? 18 + R() * 30 : 34 + Math.pow(R(), 1.3) * 95;
    const b = { x, w, h, tone: R(), balc: R() < .45, roof: R() };
    frontB.push(b);
    const occ = R() < .12 ? .03 : .1 + R() * .35; const fh = 6, ww = 2.8, wh = 3.4, sp = 4.6;
    for (let fy = 800 - h + 4.5; fy < 792; fy += fh) { const floorOcc = occ * (R() < .3 ? 2.2 : R() < .45 ? .25 : 1); let run = 0; for (let fx = x + 2; fx < x + w - 3; fx += sp) { if (run > 0 || R() < floorOcc) { if (run <= 0) run = 1 + Math.floor(R() * 3); run--; const c = winCol(); frontRects.push([fx, fy, ww, wh, c, .3 + R() * .55]); } } }
    x += w + 1 + R() * 3;
  }
  const palms = []; for (let x = X0 + 10; x < X1; x += 26 + R() * 40) palms.push([x, 26 + R() * 22, (R() - .5) * 10, R()]);
  const lamps = []; for (let x = X0; x < X1; x += 30) lamps.push(x + (R() - .5) * 4);
  const qcars = []; for (let i = 0; i < 46; i++) qcars.push([X0 + R() * (X1 - X0), (R() < .5 ? -1 : 1) * (18 + R() * 26)]);
  const boats = []; for (let i = 0; i < 9; i++) boats.push([X0 + 200 + R() * (X1 - X0 - 400), 830 + R() * 90, 8 + R() * 16, R() < .5, R() * 6]);
  const stars = []; for (let i = 0; i < 45; i++) stars.push([-1600 + R() * 5000, -1400 + R() * 1500, R() * 6.28]);

  const canFilter = 'filter' in document.createElement('canvas').getContext('2d');
  function bakeLayer(o) {
    /* cada camada é "fotografada" uma vez: silhueta desfocada + luzes + brilho (bloom) */
    const Wc = Math.ceil((X1 - X0) * o.ppu), Hc = Math.ceil((o.bottom - o.top) * o.ppu);
    const mk = () => { const c = document.createElement('canvas'); c.width = Wc; c.height = Hc; const g = c.getContext('2d'); g.setTransform(o.ppu, 0, 0, o.ppu, -X0 * o.ppu, -o.top * o.ppu); return [c, g]; };
    const [sil, gs] = mk(), [lit, gl] = mk();
    if (o.sil) o.sil(gs, gl);
    for (const p of (o.pts || [])) { gl.fillStyle = `rgba(${p[3][0]},${p[3][1]},${p[3][2]},${Math.min(1, p[4] * o.lit)})`; const r = p[2]; gl.fillRect(p[0] - r / 2, p[1] - r / 2, r, r); }
    for (const q of (o.rects || [])) { gl.fillStyle = `rgba(${q[4][0]},${q[4][1]},${q[4][2]},${Math.min(1, q[5] * o.lit)})`; gl.fillRect(q[0], q[1], q[2], q[3]); }
    if (o.litFx) o.litFx(gl);
    const [out, go] = mk(); go.setTransform(1, 0, 0, 1, 0, 0);
    if (canFilter) go.filter = `blur(${o.blur * o.ppu}px)`; go.drawImage(sil, 0, 0);
    if (canFilter) go.filter = `blur(${Math.max(.2, o.blur * .4) * o.ppu}px)`; go.drawImage(lit, 0, 0);
    go.globalCompositeOperation = 'lighter';
    if (canFilter) { go.filter = `blur(${o.bloom * o.ppu}px)`; go.globalAlpha = .7; go.drawImage(lit, 0, 0); go.filter = `blur(${o.bloom * 4 * o.ppu}px)`; go.globalAlpha = .45; go.drawImage(lit, 0, 0); }
    let gold = null;
    if (o.gold) {
      const [gc, gg] = mk();
      for (const p of (o.pts || [])) { gg.fillStyle = `rgba(255,${196 + Math.floor(p[4] * 30)},118,${.45 + p[4] * .55})`; const r = p[2] * 1.25; gg.fillRect(p[0] - r / 2, p[1] - r / 2, r, r); }
      for (const q of (o.rects || [])) { gg.fillStyle = `rgba(255,205,122,${.5 + q[5] * .5})`; gg.fillRect(q[0], q[1], q[2], q[3]); }
      const [g2, g2c] = mk(); g2c.setTransform(1, 0, 0, 1, 0, 0); if (canFilter) g2c.filter = `blur(${o.bloom * 2 * o.ppu}px)`; g2c.drawImage(gc, 0, 0); g2c.filter = 'none'; g2c.globalCompositeOperation = 'lighter'; g2c.drawImage(gc, 0, 0); gold = g2; gc.width = 0;
    }
    sil.width = lit.width = 0;
    return { img: out, gold, x0: X0, top: o.top, w: X1 - X0, h: o.bottom - o.top };
  }
  const hazeOver = (g, top, bottom, a) => { const hz = g.createLinearGradient(0, top, 0, bottom); hz.addColorStop(0, 'rgba(92,84,78,0)'); hz.addColorStop(1, `rgba(92,84,78,${a})`); g.globalCompositeOperation = 'source-atop'; g.fillStyle = hz; g.fillRect(X0, top, X1 - X0, bottom - top + 40); g.globalCompositeOperation = 'source-over'; };
  const shade = (base, t, lift) => { const k = Math.round((t - .5) * 10); return `rgb(${base[0] + k + lift},${base[1] + k + lift},${base[2] + k + lift})`; };
  function facade(g, b, baseY, dark, warm) {
    /* fachada: escura em cima, levemente iluminada pela rua embaixo */
    const top = baseY - b.h, gr = g.createLinearGradient(0, top, 0, baseY);
    gr.addColorStop(0, shade(dark, b.tone, 0)); gr.addColorStop(.7, shade(dark, b.tone, 3)); gr.addColorStop(1, shade(warm, b.tone, 0));
    g.fillStyle = gr; g.fillRect(b.x, top, b.w, b.h + 30);
    if (b.roof < .35) g.fillRect(b.x + b.w * .2, top - 3, b.w * .25, 3);            // caixa d'água
    else if (b.roof < .55) g.fillRect(b.x + b.w * (.3 + b.tone * .4), top - 9, .6, 9); // antena
    else if (b.roof < .7) g.fillRect(b.x + 1, top - 1.4, b.w - 2, 1.4);               // platibanda
  }
  function church(g, gl, x, s) {
    /* igreja barroca com duas torres, fachada iluminada por refletores */
    const base = 787, w = 46 * s, h = 34 * s, tw = 11 * s, th = 62 * s;
    const path = c => { c.beginPath(); c.rect(x, base - h, w, h + 20); c.moveTo(x + tw, base - h); c.lineTo(x + w / 2, base - h - 12 * s); c.lineTo(x + w - tw, base - h); c.closePath();
      for (const tx of [x, x + w - tw]) { c.rect(tx, base - th, tw, th); c.moveTo(tx - 1, base - th); c.lineTo(tx + tw / 2, base - th - 13 * s); c.lineTo(tx + tw + 1, base - th); c.closePath(); } };
    g.fillStyle = '#16131a'; path(g); g.fill();
    const up = gl.createLinearGradient(0, base - th - 13 * s, 0, base); up.addColorStop(0, 'rgba(255,200,130,.05)'); up.addColorStop(.6, 'rgba(255,196,120,.22)'); up.addColorStop(1, 'rgba(255,190,110,.42)');
    gl.fillStyle = up; path(gl); gl.fill();
    gl.fillStyle = 'rgba(255,214,150,.55)'; for (const tx of [x, x + w - tw]) gl.fillRect(tx + tw / 2 - 1.2 * s, base - th + 10 * s, 2.4 * s, 5 * s);
    gl.fillRect(x + w / 2 - 3 * s, base - 14 * s, 6 * s, 10 * s);
  }
  function palm(g, p) {
    const [x, h, lean, t] = p, base = 800, tx = x + lean, ty = base - h;
    g.strokeStyle = '#040507'; g.lineCap = 'round';
    g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, base); g.quadraticCurveTo(x + lean * .2, base - h * .55, tx, ty); g.stroke();
    g.lineWidth = 1.1; const n = 9;
    for (let i = 0; i < n; i++) { const a = -Math.PI + (i / (n - 1)) * Math.PI + (t - .5) * .3, L = 11 + ((i * 7 + Math.floor(t * 10)) % 5); const ex = tx + Math.cos(a) * L, ey = ty + Math.sin(a) * L * .45 + L * .55; g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(tx + Math.cos(a) * L * .55, ty + Math.sin(a) * L * .6 - 2, ex, ey); g.stroke(); }
  }
  const SIL = {
    hills: g => { g.fillStyle = '#0b1019'; g.beginPath(); g.moveTo(X0, 820); for (let x = X0; x <= X1; x += 5) g.lineTo(x, ridge(x)); g.lineTo(X1, 820); g.closePath(); g.fill(); hazeOver(g, 680, 770, .5); },
    far: g => { for (const t of towers) { g.fillStyle = shade([15, 20, 30], t[0] % 1, 0); g.fillRect(t[0], 773 - t[2], t[1], t[2] + 30); if (t[2] > 90) g.fillRect(t[0] + t[1] / 2 - .4, 773 - t[2] - 12, .8, 12); } g.fillStyle = '#10151f'; g.fillRect(X0, 768, X1 - X0, 40); hazeOver(g, 690, 780, .42); },
    front: g => {
      for (const b of frontB) facade(g, b, 800, [7, 9, 13], [30, 24, 20]);
      g.fillStyle = '#06080c'; g.fillRect(X0, 796, X1 - X0, 20);
      for (const b of frontB) if (b.balc) { g.fillStyle = 'rgba(255,230,200,.045)'; for (let fy = 800 - b.h + 6; fy < 794; fy += 6) g.fillRect(b.x, fy, b.w, .6); }
      g.strokeStyle = '#0a0c10'; g.lineWidth = .7; for (const x of lamps) { g.beginPath(); g.moveTo(x, 800); g.lineTo(x, 782); g.lineTo(x + 3, 781); g.stroke(); }
      for (const p of palms) palm(g, p);
      hazeOver(g, 730, 800, .1);
    }
  };
  function midSil(g, gl) {
    for (const b of midB) facade(g, b, 787, [10, 14, 21], [26, 23, 25]);
    g.fillStyle = '#0a0e15'; g.fillRect(X0, 784, X1 - X0, 30);
    /* guindaste de obra */
    g.fillStyle = '#0c1018'; g.fillRect(crane.x, 787 - crane.h, 2.2, crane.h); g.fillRect(crane.x - 20, 787 - crane.h, 90, 1.6); g.fillRect(crane.x - 20, 787 - crane.h - 1, 12, 4);
    g.strokeStyle = '#0c1018'; g.lineWidth = .4; g.beginPath(); g.moveTo(crane.x + 1, 787 - crane.h - 12); g.lineTo(crane.x + 68, 787 - crane.h); g.moveTo(crane.x + 1, 787 - crane.h - 12); g.lineTo(crane.x - 18, 787 - crane.h); g.stroke(); g.fillRect(crane.x + .2, 787 - crane.h - 12, 1.6, 12);
    for (const c of churches) church(g, gl, c[0], c[1]);
    hazeOver(g, 700, 790, .26);
  }
  function frontLit(gl) {
    /* rastros de luz dos carros na avenida (longa exposição) */
    for (let x = X0; x < X1; x += 1.5) {
      const a = clamp(fbm(x / 40 + 9) * 1.6 - .45); if (a > .02) { gl.fillStyle = `rgba(255,236,210,${a * .8})`; gl.fillRect(x, 797.4, 1.6, .7); }
      const b = clamp(fbm(x / 36 + 31) * 1.6 - .45); if (b > .02) { gl.fillStyle = `rgba(230,50,40,${b * .75})`; gl.fillRect(x, 798.8, 1.6, .7); }
    }
  }
  function cloudTex() {
    const w = 512, h = 256, c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); const d = g.createImageData(w, h);
    const Rn = mulberry(11), G = []; for (let i = 0; i < 64 * 64; i++) G.push(Rn());
    const n = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const at = (a, b) => G[((a & 63) * 64 + (b & 63))]; const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return lerp(lerp(at(xi, yi), at(xi + 1, yi), u), lerp(at(xi, yi + 1), at(xi + 1, yi + 1), u), v); };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let v = 0, a = .5, f = 1 / 64; for (let o = 0; o < 5; o++) { v += a * n(x * f * (w / 512) * 8 / 8 * 1, y * f * 2); a *= .5; f *= 2; }
      v = clamp((v - .45) * 2.2); const fall = y / h; const i = (y * w + x) * 4;
      d.data[i] = 46 + 120 * fall; d.data[i + 1] = 50 + 82 * fall; d.data[i + 2] = 64 + 40 * fall; d.data[i + 3] = v * 170 * (.3 + .7 * fall);
    }
    g.putImageData(d, 0, 0); return c;
  }
  function sprite(size, stops) { const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2); stops.forEach(s => gr.addColorStop(s[0], s[1])); g.fillStyle = gr; g.fillRect(0, 0, size, size); return c; }
  const spGold = sprite(64, [[0, 'rgba(255,240,200,1)'], [.22, 'rgba(244,214,146,.6)'], [1, 'rgba(201,164,92,0)']]);
  const spFog = sprite(128, [[0, 'rgba(222,184,110,.5)'], [.5, 'rgba(201,164,92,.18)'], [1, 'rgba(201,164,92,0)']]);
  const spLamp = sprite(32, [[0, 'rgba(255,226,180,.95)'], [.25, 'rgba(255,214,150,.35)'], [1, 'rgba(255,214,150,0)']]);
  const spSodium = sprite(32, [[0, 'rgba(255,214,160,1)'], [.2, 'rgba(255,170,90,.55)'], [1, 'rgba(255,150,70,0)']]);
  const spGreen = sprite(16, [[0, 'rgba(150,255,170,1)'], [.3, 'rgba(40,200,90,.6)'], [1, 'rgba(40,200,90,0)']]);
  const spRed = sprite(16, [[0, 'rgba(255,120,110,1)'], [.3, 'rgba(230,40,30,.6)'], [1, 'rgba(230,40,30,0)']]);
  const clouds = cloudTex();
  { /* granulação de filme */
    const c = document.createElement('canvas'); c.width = c.height = 160; const g = c.getContext('2d'); const d = g.createImageData(160, 160); const Rg = mulberry(8);
    for (let i = 0; i < d.data.length; i += 4) { const v = Rg() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0); $('#grain').style.backgroundImage = `url(${c.toDataURL()})`;
  }

  let W = 0, H = 0, DPR = 1, asp = 1, KF = [], sRef = 1, cam = { cx: 800, cy: 400, vh: 400, s: 1 };
  let P = 0, mx = 0, my = 0, tmx = 0, tmy = 0; const pointer = { x: -999, y: -999, on: false };
  let N = 0, s1, s2, s3, s4, s5, s6, tx, ty, L_H, L_F, L_M, L_FR; const tmp = document.createElement('canvas'), tctx = tmp.getContext('2d'); const heroImg = $('#heroImg');
  const fog = []; { const Rf = mulberry(77); for (let i = 0; i < 46; i++) fog.push([Rf() < .5 ? -1 : 1, Rf(), Rf(), Rf(), Rf()]); }
  const dust = []; { const Rd = mulberry(5); for (let i = 0; i < 90; i++) dust.push([Rd(), Rd(), Rd(), Rd()]); }
  const sprays = [];

  function buildKF() {
    const wideVH = asp >= 1 ? Math.max(1070, 1450 / asp) : Math.max(1150, 780 / asp);
    const cyW = asp >= 1 ? 548 : 490;
    const closeVH = Math.max(.62 * BH, CAPHALF * 2 * 1.35 / asp);
    const closeY = BOT.y + (asp >= 1 ? .3 : .27) * BH;
    const wordY = asp >= 1 ? 240 : 290;
    sRef = H / wideVH;
    KF = [
      [0, asp >= 1 ? 690 : 800, closeY, closeVH],
      [.12, asp >= 1 ? 700 : 800, closeY + 6, closeVH * 1.08],
      [.40, 800, cyW, wideVH], [.46, 800, cyW, wideVH],
      [.60, 800, 610, wideVH * .88], [.66, 800, 600, wideVH * .9],
      [.79, 800, wordY, wideVH * 1.02], [.85, 800, wordY, wideVH * 1.02],
      [.95, 800, BOT.y + .62 * BH, 120], [1, 800, BOT.y + .62 * BH, 120]
    ];
  }
  function camAt(p) {
    let i = 0; while (i < KF.length - 2 && p > KF[i + 1][0]) i++;
    const a = KF[i], b = KF[i + 1]; const t = eio(clamp((p - a[0]) / (b[0] - a[0])));
    return { cx: lerp(a[1], b[1], t), cy: lerp(a[2], b[2], t), vh: Math.exp(lerp(Math.log(a[3]), Math.log(b[3]), t)), get s() { return H / this.vh; } };
  }
  let Lr = {};
  function layer(ctx, d) {
    const s = sRef * Math.pow(cam.s / sRef, d), ox = W / 2 - mx * d * 18, oy = H / 2 - my * d * 10;
    ctx.setTransform(DPR * s, 0, 0, DPR * s, DPR * (ox - cam.cx * s), DPR * (oy - cam.cy * s));
    Lr = { s, ox, oy, x0: cam.cx - ox / s, x1: cam.cx + (W - ox) / s, y0: cam.cy - oy / s, y1: cam.cy + (H - oy) / s };
    return Lr;
  }
  function initParticles() {
    const n = W < 700 ? 1300 : 2400; if (n === N) return; N = n; const Rp = mulberry(99);
    s1 = new Float32Array(N); s2 = new Float32Array(N); s3 = new Float32Array(N); s4 = new Float32Array(N); s5 = new Float32Array(N); s6 = new Float32Array(N); tx = new Float32Array(N); ty = new Float32Array(N);
    for (let i = 0; i < N; i++) { s1[i] = Rp(); s2[i] = Rp(); s3[i] = Rp(); s4[i] = Rp(); s5[i] = Rp(); s6[i] = Rp(); }
  }
  function buildWord() {
    const c = document.createElement('canvas'); c.width = 1200; c.height = 300; const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.font = '600 220px "Cormorant Garamond", Georgia, serif';
    const word = 'VERITÉ', sp = 26; let total = 0; const ws = [...word].map(ch => { const w = g.measureText(ch).width; total += w; return w; }); total += sp * (word.length - 1);
    let x = (1200 - total) / 2; [...word].forEach((ch, i) => { g.fillText(ch, x, 165); x += ws[i] + sp; });
    const data = g.getImageData(0, 0, 1200, 300).data, pts = [];
    for (let y = 0; y < 300; y += 3) for (let x2 = 0; x2 < 1200; x2 += 3) if (data[(y * 1200 + x2) * 4 + 3] > 140) pts.push(x2, y);
    const cnt = pts.length / 2; if (!cnt) return; const worldW = asp >= 1 ? 780 : 640, sc = worldW / total, Rw = mulberry(3);
    for (let i = 0; i < N; i++) { const k = Math.floor(Rw() * cnt); tx[i] = 800 + (pts[k * 2] - 600) * sc; ty[i] = -150 + (pts[k * 2 + 1] - 165) * sc; }
  }
  function resize() {
    const r = stage.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height); asp = W / H;
    DPR = Math.min(window.devicePixelRatio || 1, W < 700 ? 1.6 : 2);
    [back, front, fx].forEach(c => { c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); });
    buildKF(); initParticles(); buildWord();
    const ppu = clamp(sRef * DPR * 1.15, .6, 1.5);
    tmp.width = back.width; tmp.height = back.height;
    L_H = bakeLayer({ top: 640, bottom: 800, ppu, sil: SIL.hills, pts: hillPts, lit: .8, blur: 2.4, bloom: 1.4 });
    L_F = bakeLayer({ top: 560, bottom: 800, ppu, sil: SIL.far, pts: farPts, rects: farRects, lit: 1, blur: 1.1, bloom: 1.3, gold: true });
    L_M = bakeLayer({ top: 600, bottom: 812, ppu, sil: midSil, pts: midPts, rects: midRects, lit: .95, blur: .6, bloom: 1.5, gold: true });
    L_FR = bakeLayer({ top: 650, bottom: 816, ppu, sil: SIL.front, rects: frontRects, litFx: frontLit, lit: .9, blur: .3, bloom: 1.7 });
    { /* reflexo da orla: invertido, esticado e borrado como na água de verdade */
      const src = L_FR.img, c = document.createElement('canvas'); c.width = src.width; c.height = Math.round(src.height * 1.4); const g = c.getContext('2d');
      if (canFilter) g.filter = `blur(${1.8 * ppu}px)`; g.translate(0, c.height); g.scale(1, -1.4); g.drawImage(src, 0, 0); L_FR.refl = c; }
  }

  let pourR = 0;
  function drawBaked(c, Lb) { c.drawImage(Lb.img, Lb.x0, Lb.top, Lb.w, Lb.h); }
  function goldOverlay(Lb, d, amt) {
    /* luzes da cidade esquentam para dourado conforme a névoa passa */
    if (!Lb.gold || amt <= 0) return;
    const t = tctx; t.setTransform(1, 0, 0, 1, 0, 0); t.globalCompositeOperation = 'source-over'; t.clearRect(0, 0, tmp.width, tmp.height);
    layer(t, d); t.save(); t.translate(800, 772); t.scale(1, .32); const r = 60 + pourR;
    const g = t.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(.72, 'rgba(0,0,0,.75)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    t.fillStyle = g; t.fillRect(-r, -r, r * 2, r * 2); t.restore();
    t.globalCompositeOperation = 'source-in'; t.drawImage(Lb.gold, Lb.x0, Lb.top, Lb.w, Lb.h); t.globalCompositeOperation = 'source-over';
    bx.setTransform(1, 0, 0, 1, 0, 0); bx.globalCompositeOperation = 'lighter'; bx.globalAlpha = amt; bx.drawImage(tmp, 0, 0); bx.globalAlpha = 1; bx.globalCompositeOperation = 'source-over';
  }

  function drawBack(time, p, essence, spray, pour) {
    const c = bx; c.setTransform(1, 0, 0, 1, 0, 0);
    /* céu: azul-noite em cima, brilho quente de cidade no horizonte */
    let L = layer(c, .45);
    let g = c.createLinearGradient(0, -700, 0, 775); g.addColorStop(0, '#020307'); g.addColorStop(.5, '#060b15'); g.addColorStop(.8, '#121724'); g.addColorStop(.93, '#2a2326'); g.addColorStop(1, '#4a3526');
    c.fillStyle = g; c.fillRect(L.x0, L.y0, L.x1 - L.x0, L.y1 - L.y0);
    L = layer(c, .1);
    for (const s of stars) { if (s[0] < L.x0 || s[0] > L.x1 || s[1] < L.y0 || s[1] > L.y1) continue; c.globalAlpha = .18 + .12 * Math.sin(time * .8 + s[2]); c.fillStyle = '#e8ecf4'; const r = 1 / L.s; c.fillRect(s[0], s[1], r, r); }
    c.globalAlpha = 1;
    { /* avião cruzando o céu bem alto */
      const ax = ((time * 22) % 5200) - 1700, ay = -380 + Math.sin(time * .05) * 20;
      if (ax > L.x0 && ax < L.x1) { const on = (time * 1.1) % 1 < .12; c.globalAlpha = on ? 1 : .35; c.fillStyle = on ? '#ffffff' : '#ff6655'; const r = (on ? 2.2 : 1.6) / L.s; c.fillRect(ax, ay, r, r); c.globalAlpha = 1; }
    }
    /* nuvens baixas, acesas por baixo pela cidade */
    L = layer(c, .2);
    c.globalAlpha = .5; const cw = 2600, chh = 520, off = (time * 3) % (cw * 2);
    for (let k = -1; k < 3; k++) { const x = -1000 + k * cw - off; if (k & 1) { c.save(); c.translate(x + cw, 250); c.scale(-1, 1); c.drawImage(clouds, 0, 0, cw, chh); c.restore(); } else c.drawImage(clouds, x, 250, cw, chh); }
    c.globalAlpha = 1;
    /* halo do frasco */
    L = layer(c, 1);
    const halo = .06 + .15 * essence + .012 * Math.sin(time * 1.3);
    g = c.createRadialGradient(800, 470, 0, 800, 470, 780); g.addColorStop(0, `rgba(214,172,96,${halo})`); g.addColorStop(.45, `rgba(160,118,48,${halo * .4})`); g.addColorStop(1, 'rgba(120,90,40,0)');
    c.fillStyle = g; c.fillRect(L.x0, L.y0, L.x1 - L.x0, L.y1 - L.y0);
    if (spray > 0) {
      const bw = 70 + 70 * spray; g = c.createLinearGradient(0, CAP_TOP, 0, CAP_TOP - 1400); g.addColorStop(0, `rgba(241,217,160,${.2 * spray})`); g.addColorStop(1, 'rgba(241,217,160,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(800 - 30, CAP_TOP); c.lineTo(800 + 30, CAP_TOP); c.lineTo(800 + bw, CAP_TOP - 1400); c.lineTo(800 - bw, CAP_TOP - 1400); c.closePath(); c.fill();
      g = c.createRadialGradient(800, CAP_TOP, 0, 800, CAP_TOP, 200); g.addColorStop(0, `rgba(255,236,190,${.4 * spray})`); g.addColorStop(1, 'rgba(255,236,190,0)'); c.fillStyle = g; c.fillRect(600, CAP_TOP - 200, 400, 400);
    }
    /* morros, cidade distante e casario */
    L = layer(c, .3); drawBaked(c, L_H);
    L = layer(c, .45); drawBaked(c, L_F);
    for (const b of beacons) { const a = Math.max(0, Math.sin(time * 2.4 + b[2])); if (a < .05) continue; c.globalAlpha = a; c.drawImage(spRed, b[0] - 4, b[1] - 4, 8, 8); }
    c.globalAlpha = 1;
    goldOverlay(L_F, .45, Math.min(1, pour * 1.6));
    L = layer(c, .7); drawBaked(c, L_M);
    { const a = Math.max(0, Math.sin(time * 2 + 1.3)); if (a > .05) { c.globalAlpha = a; c.drawImage(spRed, crane.x - 2.5, 787 - crane.h - 16, 7, 7); c.globalAlpha = 1; } }
    goldOverlay(L_M, .7, Math.min(1, pour * 1.6));
  }

  let px = 0, py = 0;
  function pourPos(i, t, time) {
    /* a névoa sai do topo, contorna a tampa, desce pelo vidro e se espalha sobre a cidade */
    const side = s1[i] < .5 ? -1 : 1, ta = clamp(t / .3), edge = HALF - 8 + s2[i] * 30 + Math.sin(time * 1.1 + s4[i] * 20) * 6; let x, y;
    if (ta < .12) { const u = ta / .12; x = 800 + side * lerp(4, CAPHALF, eo(u)); y = lerp(CAP_TOP, CAP_TOP + 24, u); }
    else if (ta < .3) { const u = (ta - .12) / .18; x = 800 + side * lerp(CAPHALF, edge, u); y = lerp(CAP_TOP + 24, SHOULDER + 8, u); }
    else { const u = (ta - .3) / .7; x = 800 + side * (edge + u * u * 12); y = lerp(SHOULDER + 8, 770, u * u); }
    if (t > .3) { const tb = (t - .3) / .7, e = eo(tb); x += side * e * (60 + s3[i] * 1500); y -= e * (14 + Math.pow(s4[i], 1.4) * 220); y += Math.sin(time * .8 + s6[i] * 6.283) * 9 * tb; }
    x += Math.sin(time * .5 + s5[i] * 9) * 5; px = x; py = y;
  }

  function drawFront(time, pour, wf, fade, showBottle) {
    const c = fr; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, front.width, front.height);
    /* água */
    let L = layer(c, 1.1);
    let g = c.createLinearGradient(0, 800, 0, 1350); g.addColorStop(0, '#0d1017'); g.addColorStop(.2, '#070a10'); g.addColorStop(1, '#020304');
    c.fillStyle = g; c.fillRect(L.x0, 800, L.x1 - L.x0, Math.max(10, L.y1 - 800));
    g = c.createLinearGradient(0, 800, 0, 880); g.addColorStop(0, 'rgba(140,104,70,.16)'); g.addColorStop(1, 'rgba(140,104,70,0)'); c.fillStyle = g; c.fillRect(L.x0, 800, L.x1 - L.x0, 80);
    /* reflexo do frasco, ondulando em faixas */
    L = layer(c, 1);
    if (showBottle && heroImg.complete && heroImg.naturalWidth) {
      const iw = heroImg.naturalWidth, ih = heroImg.naturalHeight, n = 40, sh = ih / n, dh = BOT.h / n;
      for (let k = 0; k < n; k++) {
        const f0 = k / n; const a = .26 * (1 - f0) * (1 - f0); if (a < .01) break;
        const dx = BOT.x + Math.sin(time * 1.9 + k * .75) * (1.2 + k * .16);
        c.globalAlpha = a; c.save(); c.translate(0, 802 + (k + 1) * dh); c.scale(1, -1); c.drawImage(heroImg, 0, ih - (k + 1) * sh, iw, sh, dx, 0, BOT.w, dh + .6); c.restore();
      }
      c.globalAlpha = 1;
    }
    /* reflexo da orla e das luzes */
    L = layer(c, 1.1);
    c.save(); c.beginPath(); c.rect(L.x0, 800, L.x1 - L.x0, Math.max(10, L.y1 - 800)); c.clip(); c.globalAlpha = .42; c.drawImage(L_FR.refl, X0, 800 - 16 * 1.4, X1 - X0, (816 - 650) * 1.4); c.restore(); c.globalAlpha = 1;
    for (const x of lamps) {
      if (x < L.x0 - 10 || x > L.x1 + 10) continue;
      for (let k = 0; k < 6; k++) { const y = 803 + k * 11, w = (2.4 - k * .25) * (1 + .7 * Math.sin(time * 2.2 + k * 1.3 + x)); c.fillStyle = `rgba(255,170,90,${.26 - k * .04})`; c.fillRect(x - w / 2, y, w, 2.2); }
    }
    /* barcos ancorados, balançando */
    for (const bt of boats) {
      const [x, y0, l, sail, ph] = bt; if (x < L.x0 - 30 || x > L.x1 + 30) continue; const y = y0 + Math.sin(time * 1.1 + ph) * .7, tilt = Math.sin(time * .9 + ph) * .04;
      c.save(); c.translate(x, y); c.rotate(tilt);
      c.fillStyle = '#030406'; c.beginPath(); c.moveTo(-l / 2, 0); c.lineTo(l / 2, 0); c.lineTo(l / 2 - 2, 2.4); c.lineTo(-l / 2 + 2, 2.4); c.closePath(); c.fill();
      c.fillRect(-l * .15, -2.4, l * .35, 2.4);
      if (sail) { c.fillRect(-.3, -l * 1.3, .6, l * 1.3); }
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = .9; c.drawImage(spLamp, -3, (sail ? -l * 1.3 : -3.4) - 3, 6, 6);
      c.globalAlpha = .7; c.drawImage(spRed, -l / 2 - 1.5, -2, 4, 4); c.drawImage(spGreen, l / 2 - 2.5, -2, 4, 4);
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.restore();
      for (let k = 0; k < 4; k++) { const w = 1.8 * (1 + .6 * Math.sin(time * 2.3 + k + ph)); c.fillStyle = `rgba(255,226,180,${.22 - k * .05})`; c.fillRect(x - w / 2, y + 4 + k * 5, w, 1.4); }
    }
    /* orla em primeiro plano, postes e carros na avenida */
    drawBaked(c, L_FR);
    for (const x of lamps) { if (x < L.x0 - 10 || x > L.x1 + 10) continue; c.globalAlpha = .95; c.drawImage(spSodium, x - 1.5, 777.5, 9, 9); }
    c.globalAlpha = 1;
    for (const car of qcars) {
      const span = X1 - X0, x = ((car[0] - X0 + car[1] * time) % span + span) % span + X0; if (x < L.x0 || x > L.x1) continue;
      const dir = Math.sign(car[1]), y = dir > 0 ? 798.5 : 797, u = 1 / L.s;
      c.fillStyle = 'rgba(255,240,215,.95)'; c.fillRect(x + dir * 2.2, y, Math.max(1.6, 1.8 * u), Math.max(.9, 1.1 * u));
      c.fillStyle = 'rgba(200,56,46,.8)'; c.fillRect(x - dir * 2.4, y, Math.max(1.1, 1.3 * u), Math.max(.9, 1.1 * u));
    }
    /* névoa dourada e partículas */
    L = layer(c, 1);
    c.globalCompositeOperation = 'lighter';
    if (pour > 0 && fade > 0) {
      const veil = ss(0, .25, pour) * (1 - wf) * fade;
      if (veil > 0) for (let j = 0; j < 28; j++) {
        const side = j % 2 ? 1 : -1, k2 = (j >> 1) / 14, yy = SHOULDER + ((k2 + time * .045 + pour * .4) % 1) * (770 - SHOULDER);
        const r = 70 + 40 * Math.sin(j * 1.7), x = 800 + side * (HALF + 6 + Math.sin(time * .7 + j) * 12);
        c.globalAlpha = .12 * veil; c.drawImage(spFog, x - r, yy - r, r * 2, r * 2);
      }
      for (const f of fog) {
        const tb = clamp((pour - f[4] * .5) / .5); if (tb <= 0) continue; const e = eo(tb);
        const x = 800 + f[0] * e * (80 + f[1] * 1400), y = 755 - f[2] * 130 - e * 25 + Math.sin(time * .4 + f[3] * 6) * 12, r = 160 + f[3] * 190;
        c.globalAlpha = .1 * tb * (1 - wf * .85) * fade; c.drawImage(spFog, x - r, y - r * .55, r * 2, r * 1.1);
      }
      const k = clamp(cam.s * 1.4, 1, 1.8) / L.s;
      for (let i = 0; i < N; i++) {
        const t = clamp((pour - s5[i] * .55) / .45); if (t <= 0) continue;
        pourPos(i, t, time); let x = px, y = py, a = (.3 + .5 * s2[i]) * Math.min(1, t * 6), f = 0;
        if (wf > 0) { f = eio(clamp(wf * 1.35 - s6[i] * .35)); x = lerp(x, tx[i] + Math.sin(time * 2 + s1[i] * 30) * 1.4, f); y = lerp(y, ty[i] + Math.cos(time * 1.7 + s2[i] * 30) * 1.4, f); a = lerp(a, .5 + .4 * s4[i], f); }
        a *= fade; if (a <= .01 || x < L.x0 - 10 || x > L.x1 + 10 || y < L.y0 - 10 || y > L.y1 + 10) continue;
        const r = (1.1 + s3[i] * 1.9) * (1 - .2 * f) * k; c.globalAlpha = a; c.drawImage(spGold, x - r * 2, y - r * 2, r * 4, r * 4);
      }
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  }

  function drawFx(time, dt, p, studioAmt) {
    const c = xx; c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, W, H); c.globalCompositeOperation = 'lighter';
    if (pointer.on && p < .9) { const g = c.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, 260); g.addColorStop(0, 'rgba(241,217,160,.07)'); g.addColorStop(1, 'rgba(241,217,160,0)'); c.fillStyle = g; c.fillRect(pointer.x - 260, pointer.y - 260, 520, 520); }
    if (studioAmt > 0) {
      const bw = Math.min(W * .78, 760);
      for (const d of dust) { const y = ((d[0] * H + time * (14 + d[1] * 26)) % (H * .9)); const spread = (.18 + .82 * (y / H)) * bw * .5; const x = W / 2 + (d[2] - .5) * 2 * spread + Math.sin(time * .6 + d[3] * 9) * 8; c.globalAlpha = studioAmt * (.25 + .5 * d[3]); const r = 1 + d[1] * 1.8; c.drawImage(spGold, x - r * 2, y - r * 2, r * 4, r * 4); }
    }
    for (let i = sprays.length - 1; i >= 0; i--) {
      const s = sprays[i]; s.life += dt; if (s.life > s.max) { sprays.splice(i, 1); continue; }
      const drag = Math.pow(.05, dt); s.vx *= drag; s.vy = s.vy * drag + 26 * dt; s.x += s.vx * dt; s.y += s.vy * dt;
      c.globalAlpha = (1 - s.life / s.max) * .9; const r = s.r * (1 + s.life * .8); c.drawImage(spGold, s.x - r * 2, s.y - r * 2, r * 4, r * 4);
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  }

  function setCopy(el, o, dy = 18) { el.style.opacity = o.toFixed(3); el.style.visibility = o < .01 ? 'hidden' : 'visible'; el.style.translate = `0 ${((1 - o) * dy).toFixed(1)}px`; }

  function frame(time, dt) {
    const rect = film.getBoundingClientRect(), total = Math.max(1, film.offsetHeight - stage.offsetHeight),
      /* AJUSTE DO SITE: o palco gruda em top:var(--header-h-compact),
         abaixo do cabeçalho — então o progresso começa a contar quando o
         topo da seção alcança ESSE offset, não o topo da janela. */
      stageTop = parseFloat(getComputedStyle(stage).top) || 0,
      raw = clamp((stageTop - rect.top) / total);
    P += (raw - P) * (1 - Math.exp(-dt * 6)); if (Math.abs(raw - P) < 1e-4) P = raw;
    mx += (tmx - mx) * (1 - Math.exp(-dt * 3)); my += (tmy - my) * (1 - Math.exp(-dt * 3));
    const p = P; cam = camAt(p);
    const spray = ss(.43, .5, p) * (1 - ss(.66, .73, p)), essence = ss(.45, .6, p);
    const pour = clamp((p - .47) / (.63 - .47)), wf = clamp((p - .64) / (.78 - .64)), fade = 1 - ss(.86, .92, p);
    const flashA = band(p, .9, .93, .035), studioAmt = ss(.925, .955, p);
    pourR = eo(pour) * 1900;

    drawBack(time, p, essence, spray, pour);
    const s = cam.s, ox = W / 2 - mx * 18, oy = H / 2 - my * 10;
    const bxp = (BOT.x - cam.cx) * s + ox, byp = (BOT.y - cam.cy) * s + oy, bw = BOT.w * s, bh = BOT.h * s;
    const show = studioAmt < .999 && bw < 9000;
    hero.style.display = show ? 'block' : 'none'; refl.style.display = 'none';
    if (show) {
      hero.style.width = bw + 'px'; hero.style.height = bh + 'px'; hero.style.transform = `translate(${bxp}px,${byp}px)`;
      heroGlow.style.opacity = (.1 + .6 * essence).toFixed(3);
    }
    drawFront(time, pour, wf, fade, show);
    flash.style.opacity = flashA.toFixed(3);
    studio.style.opacity = studioAmt.toFixed(3); studio.style.visibility = studioAmt > .01 ? 'visible' : 'hidden';
    drawFx(time, dt, p, studioAmt);

    setCopy(copies[0], band(p, -1, .085, .035));
    setCopy(copies[1], band(p, .24, .39, .035));
    setCopy(copies[2], band(p, .5, .62, .03));
    const c4 = band(p, .74, .85, .03); setCopy(copies[3], c4, 10);
    if (c4 > 0) copies[3].style.top = clamp((-35 - cam.cy) * s + oy, 70, H - 110) + 'px';
    hint.style.opacity = (1 - ss(0, .03, p)).toFixed(3);
    const idx = p < .14 ? 0 : p < .44 ? 1 : p < .64 ? 2 : p < .88 ? 3 : 4;
    railBtns.forEach((b, i) => { const on = i === idx; if (b.classList.contains('on') !== on) { b.classList.toggle('on', on); on ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current'); } });
  }

  let running = false, last = 0; const T0 = performance.now();
  function loop(now) { if (!running) return; const dt = Math.min(.05, (now - last) / 1000 || .016); last = now; frame((now - T0) / 1000, dt); requestAnimationFrame(loop); }
  function start() { if (running || reduce) return; running = true; last = performance.now(); requestAnimationFrame(loop); }
  function stop() { running = false; }

  railBtns.forEach(b => b.addEventListener('click', () => {
    /* AJUSTE DO SITE: mesmo desconto do offset do palco, para o capítulo
       parar no ponto certo em vez de uma altura de cabeçalho adiantado. */
    const total = film.offsetHeight - stage.offsetHeight,
          stageTop = parseFloat(getComputedStyle(stage).top) || 0,
          top = film.getBoundingClientRect().top + scrollY - stageTop;
    scrollTo({ top: top + parseFloat(b.dataset.p) * total + 2, behavior: 'smooth' });
  }));
  stage.addEventListener('pointermove', e => { const r = stage.getBoundingClientRect(); pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top; pointer.on = e.pointerType === 'mouse'; tmx = (pointer.x / W - .5) * 2; tmy = (pointer.y / H - .5) * 2; });
  stage.addEventListener('pointerleave', () => { pointer.on = false; tmx = tmy = 0; });
  stage.addEventListener('pointerdown', e => {
    if (e.target.closest('a,button')) return; const r = stage.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    for (let i = 0; i < 46; i++) { const a = -Math.PI / 2 + (Math.random() - .5) * 2.4, v = 60 + Math.random() * 260; sprays.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 1 + Math.random() * .9, r: .8 + Math.random() * 1.6 }); }
    if (sprays.length > 600) sprays.splice(0, sprays.length - 600);
  });

  if (!reduce) {
    resize(); frame(0, .016);
    new IntersectionObserver(es => es.forEach(en => en.isIntersecting ? start() : stop()), { threshold: 0 }).observe(film);
    document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { resize(); if (!running) frame((performance.now() - T0) / 1000, .016); }, 150); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => buildWord());
  }
})();
