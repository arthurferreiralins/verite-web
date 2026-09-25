# Vídeos de origem do banner "Impossível de ignorar"

Coloque os 10 arquivos **aqui dentro**, com estes nomes exatos:

```
assets/hero-src/
  cena1.mp4    cena2.mp4    cena3.mp4    cena4.mp4    cena5.mp4      ← 16:9, desktop
  cena1-m.mp4  cena2-m.mp4  cena3-m.mp4  cena4-m.mp4  cena5-m.mp4    ← 9:16, celular
```

As cenas são contínuas: o último quadro de uma é o primeiro da seguinte.
O script concatena as cinco antes de amostrar, então não precisa haver
sobreposição nem corte entre elas.

## Depois de colocar os vídeos

1. Instale o ffmpeg (não está nesta máquina):

   ```
   winget install Gyan.FFmpeg
   ```

2. Gere os quadros:

   ```
   node tools/extrair-quadros.js
   ```

   Isso escreve `assets/hero-seq/desktop/` (~160 quadros, 1920px),
   `assets/hero-seq/mobile/` (~100 quadros, 1080px) e o `manifest.json`.

**Nenhum código precisa mudar.** O site lê a contagem de quadros do
manifesto; enquanto ele não existir, o banner continua sendo a cena de
estúdio atual, sem nada quebrado.

## Por que esta pasta está no repositório vazia

Para o caminho existir e os nomes ficarem registrados. Os `.mp4` em si
**não** entram no Git (são pesados) — veja o `.gitignore` aqui do lado.
Os quadros gerados em `assets/hero-seq/` também ficam de fora até a
gente decidir se eles vão versionados ou geram no deploy.
