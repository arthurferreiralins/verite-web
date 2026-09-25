#!/usr/bin/env node
/**
 * Extrai a sequência de quadros do banner a partir dos vídeos de origem.
 *
 *   node tools/extrair-quadros.js
 *
 * ENTRADA   assets/hero-src/
 *             cena1.mp4 … cena5.mp4       (16:9, desktop)
 *             cena1-m.mp4 … cena5-m.mp4   (9:16, mobile)
 *           As cenas são contínuas: o último quadro de uma é o primeiro da
 *           seguinte, então elas são concatenadas antes da amostragem.
 *
 * SAÍDA     assets/hero-seq/desktop/0001.webp …  (~160 quadros, 1920px)
 *           assets/hero-seq/mobile/0001.webp  …  (~100 quadros, 1080px)
 *           assets/hero-seq/manifest.json        (o que o site lê)
 *
 * PRECISA de ffmpeg no PATH. Não está instalado nesta máquina; no Windows:
 *   winget install Gyan.FFmpeg
 *
 * Por que WebP e não AVIF: AVIF comprime melhor, mas decodificar ~160
 * quadros durante a rolagem é trabalho de CPU a cada troca de quadro, e o
 * AVIF é bem mais caro de decodificar. Numa sequência controlada por scroll
 * o que manda é a velocidade de decodificação, não o tamanho do arquivo.
 * Dá para gerar os dois com --avif e comparar.
 */
'use strict';

const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const ORIGEM = path.join(RAIZ, 'assets', 'hero-src');
const DESTINO = path.join(RAIZ, 'assets', 'hero-seq');

const PERFIS = {
  desktop: { sufixo: '', largura: 1920, quadros: 160 },
  mobile: { sufixo: '-m', largura: 1080, quadros: 100 },
};
const QUALIDADE = 60;
const TAMBEM_AVIF = process.argv.includes('--avif');

function temFfmpeg() {
  const r = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  return !r.error && r.status === 0;
}

function duracao(arquivo) {
  const saida = execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', arquivo,
  ], { encoding: 'utf8' });
  return parseFloat(saida.trim());
}

function gerar(nomePerfil) {
  const perfil = PERFIS[nomePerfil];
  const cenas = [];
  for (let i = 1; i <= 5; i++) {
    const p = path.join(ORIGEM, `cena${i}${perfil.sufixo}.mp4`);
    if (!fs.existsSync(p)) {
      console.error(`  FALTANDO: ${path.relative(RAIZ, p)}`);
      return null;
    }
    cenas.push(p);
  }

  const saidaDir = path.join(DESTINO, nomePerfil);
  fs.rmSync(saidaDir, { recursive: true, force: true });
  fs.mkdirSync(saidaDir, { recursive: true });

  // concat demuxer: junta as 5 cenas sem recodificar
  const lista = path.join(DESTINO, `_${nomePerfil}.txt`);
  fs.writeFileSync(lista, cenas.map((c) => `file '${c.replace(/'/g, "'\\''")}'`).join('\n'));

  const total = cenas.reduce((s, c) => s + duracao(c), 0);
  const fps = perfil.quadros / total;
  console.log(`  ${nomePerfil}: ${total.toFixed(1)}s de vídeo -> ${perfil.quadros} quadros (${fps.toFixed(2)} fps), largura ${perfil.largura}`);

  execFileSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'concat', '-safe', '0', '-i', lista,
    '-vf', `fps=${fps.toFixed(6)},scale=${perfil.largura}:-2:flags=lanczos`,
    '-frames:v', String(perfil.quadros),
    '-c:v', 'libwebp', '-quality', String(QUALIDADE), '-compression_level', '6',
    path.join(saidaDir, '%04d.webp'),
  ], { stdio: 'inherit' });

  if (TAMBEM_AVIF) {
    execFileSync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'concat', '-safe', '0', '-i', lista,
      '-vf', `fps=${fps.toFixed(6)},scale=${perfil.largura}:-2:flags=lanczos`,
      '-frames:v', String(perfil.quadros),
      '-c:v', 'libaom-av1', '-crf', '32', '-cpu-used', '6',
      path.join(saidaDir, '%04d.avif'),
    ], { stdio: 'inherit' });
  }

  fs.unlinkSync(lista);

  const arquivos = fs.readdirSync(saidaDir).filter((f) => f.endsWith('.webp')).sort();
  const bytes = arquivos.reduce((s, f) => s + fs.statSync(path.join(saidaDir, f)).size, 0);
  console.log(`  ${nomePerfil}: ${arquivos.length} quadros, ${(bytes / 1024 / 1024).toFixed(1)} MB no total, ` +
              `${(bytes / arquivos.length / 1024).toFixed(0)} KB por quadro`);
  return { quadros: arquivos.length, largura: perfil.largura, bytes };
}

function main() {
  if (!fs.existsSync(ORIGEM)) {
    console.error(`Pasta de origem não encontrada: ${path.relative(RAIZ, ORIGEM)}`);
    console.error('Coloque cena1..5.mp4 (16:9) e cena1-m..5-m.mp4 (9:16) lá dentro.');
    process.exit(1);
  }
  if (!temFfmpeg()) {
    console.error('ffmpeg não está no PATH. No Windows: winget install Gyan.FFmpeg');
    process.exit(1);
  }
  fs.mkdirSync(DESTINO, { recursive: true });

  const manifesto = { geradoEm: new Date().toISOString().slice(0, 10), formato: 'webp', perfis: {} };
  for (const nome of Object.keys(PERFIS)) {
    const r = gerar(nome);
    if (!r) { console.error(`\nAbortado: faltam vídeos de ${nome}.`); process.exit(1); }
    manifesto.perfis[nome] = { quadros: r.quadros, largura: r.largura };
  }
  fs.writeFileSync(path.join(DESTINO, 'manifest.json'), JSON.stringify(manifesto, null, 2) + '\n');
  console.log('\nmanifest.json escrito. O site lê dele a contagem de quadros — nenhum código precisa mudar.');
}

main();
