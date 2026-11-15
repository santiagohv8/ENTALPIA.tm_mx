/*
 * Juego de prevención — versión web (canvas, pixel art 16 bits)
 * Requiere un <canvas id="juego" width="900" height="600"></canvas> en la página.
 * No usa imágenes ni librerías externas.
 */
(() => {
  'use strict';

  const W = 900;
  const H = 600;
  const WALL = 100;

  const FONT = '"DejaVu Sans Mono", Menlo, Consolas, "Courier New", monospace';
  const font = (px, bold = true) => `${bold ? 'bold ' : ''}${px}px ${FONT}`;

  // ------------------------------------------------------------
  // ARTE (pixel art dibujado con código)
  // ------------------------------------------------------------

  const OUTLINE = [24, 20, 32];

  const css = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
  const shade = (c, f) => c.map((v) => Math.min(255, Math.floor(v * f)));
  const rect = (g, c, x, y, w, h) => {
    g.fillStyle = css(c);
    g.fillRect(x, y, w, h);
  };
  const rectA = (g, style, x, y, w, h) => {
    g.fillStyle = style;
    g.fillRect(x, y, w, h);
  };

  // Generador pseudoaleatorio con semilla (para que el piso siempre se vea igual)
  const seeded = (seed) => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  const PAL = {
    w: [255, 255, 255],
    y: [255, 220, 60],
    o: [255, 140, 30],
    r: [220, 50, 50],
    g: [80, 200, 100],
    k: [25, 22, 35],
    a: [120, 125, 140],
    A: [70, 72, 88],
    l: [200, 205, 215],
    b: [60, 110, 220],
    n: [140, 90, 50],
    h: [90, 55, 30],
    s: [245, 200, 160],
    p: [50, 50, 90],
  };

  const PLAYER_A = [
    '..hhhhhh..',
    '.hhhhhhhh.',
    '.hssssssh.',
    '.ssksskss.',
    '..ssssss..',
    '.bbbbbbbb.',
    'sbbbbbbbbs',
    '.bbbbbbbb.',
    '..pp..pp..',
    '..kk..kk..',
  ];
  const PLAYER_B = [
    '..hhhhhh..',
    '.hhhhhhhh.',
    '.hssssssh.',
    '.ssksskss.',
    '..ssssss..',
    '.bbbbbbbb.',
    'sbbbbbbbbs',
    '.bbbbbbbb.',
    '...pppp...',
    '...kkkk...',
  ];
  const CANDLE = [
    '...yy...', '..oyyo..', '...oo...', '..wwww..',
    '..wwww..', '..wwlw..', '..wwww..', '.aaaaaa.',
  ];
  const CORD = [
    '..l..l..', '.llllll.', '.llAAll.', '.llllll.',
    '...yy...', '...yy...', '..yy....', '..yyyy..',
  ];
  const STOVE = [
    'llllllll', 'lAAllAAl', 'lAAllAAl', 'llllllll',
    'aaaaaaaa', 'akkkkkka', 'akkkkkka', '.a....a.',
  ];
  const DETECTOR = [
    '..llll..', '.llwwrl.', 'llwAAwll', 'lwAkkAwl',
    'lwAkkAwl', 'llwAAwll', '.llwwll.', '..llll..',
  ];
  const GAS = [
    '...kk...', '..kkkk..', '.rrrrrr.', 'rrrrrrrr',
    'rrwwwwrr', 'rrwwwwrr', 'rrrrrrrr', '.AAAAAA.',
  ];
  const BOILER = [
    '.aaaaaa.', 'alllllla', 'alwwwwla', 'alwrrwla',
    'alwwwwla', 'alllllla', 'aAAAAAAa', '.A....A.',
  ];
  const BBQ = [
    '.aaaaaa.', 'aaaaaaaa', 'aAAAAAAa', 'kkkkkkkk',
    'kkokkokk', '.kkkkkk.', '..a..a..', '.a....a.',
  ];
  const CHECK = [
    'gggggggg', 'ggggggwg', 'gggggwgg', 'gwgwwggg',
    'ggwwgggg', 'gggwgggg', 'gggggggg',
  ];
  const ARROW_UP = [
    '...y...', '..yyy..', '.yyyyy.', 'yyyyyyy',
    '..yyy..', '..yyy..', '..yyy..',
  ];

  const SPRITES = {
    'Apagar vela': CANDLE,
    'Revisar extensi\u00f3n': CORD,
    'Apagar estufa': STOVE,
    'Revisar detector de humo': DETECTOR,
    'Levantar bote de gasolina': GAS,
    'Apagar calentador': BOILER,
    'Cerrar asador': BBQ,
  };

  function sprite(g, rows, x, y, scale) {
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        const col = PAL[rows[r][c]];
        if (!col) continue;
        rect(g, col, x + c * scale, y + r * scale, scale, scale);
      }
    }
  }

  function spriteColor(g, rows, x, y, scale, col) {
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        if (rows[r][c] === '.') continue;
        rect(g, col, x + c * scale, y + r * scale, scale, scale);
      }
    }
  }

  function arrowFor(dir) {
    const n = ARROW_UP.length;
    const out = Array.from({ length: n }, () => new Array(n).fill('.'));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const c = ARROW_UP[i][j];
        if (dir === 'U') out[i][j] = c;
        else if (dir === 'D') out[n - 1 - i][j] = c;
        else if (dir === 'L') out[j][i] = c;
        else out[j][n - 1 - i] = c;
      }
    }
    return out.map((r) => r.join(''));
  }

  // Bloque grueso: borde oscuro, relleno, brillo arriba y sombra abajo
  function block(g, x, y, w, h, base) {
    rect(g, OUTLINE, x, y, w, h);
    rect(g, base, x + 3, y + 3, w - 6, h - 6);
    if (w >= 12 && h >= 12) {
      rect(g, shade(base, 1.25), x + 3, y + 3, w - 6, 3);
      rect(g, shade(base, 0.72), x + 3, y + h - 6, w - 6, 3);
    }
  }

  // Panel de interfaz estilo retro
  function panel(g, x, y, w, h, fill = [58, 62, 92]) {
    rect(g, OUTLINE, x, y, w, h);
    rect(g, fill, x + 3, y + 3, w - 6, h - 6);
    rect(g, shade(fill, 1.35), x + 3, y + 3, w - 6, 3);
    rect(g, shade(fill, 1.35), x + 3, y + 3, 3, h - 6);
    rect(g, shade(fill, 0.7), x + 3, y + h - 6, w - 6, 3);
    rect(g, shade(fill, 0.7), x + w - 6, y + 3, 3, h - 6);
  }

  const shadow = (g, x, y, w, h) => rectA(g, 'rgba(0,0,0,0.235)', x, y, w, h);

  // ----- pisos y paredes -----

  function wood(g, y0) {
    const base = [176, 120, 70];
    const light = [190, 134, 82];
    const dark = [136, 90, 52];
    for (let row = 0, y = y0; y < H; row++, y += 30) {
      rect(g, row % 2 === 0 ? base : light, 0, y, W, 30);
      rect(g, dark, 0, y + 27, W, 3);
      const off = (row % 2) * 60;
      for (let x = off; x < W; x += 120) rect(g, dark, x, y, 3, 27);
    }
  }

  function checker(g, y0, t, a, b) {
    for (let y = y0, r = 0; y < H; y += t, r++) {
      for (let x = 0, c = 0; x < W; x += t, c++) {
        rect(g, (r + c) % 2 === 0 ? a : b, x, y, t, t);
      }
    }
  }

  function concrete(g, y0) {
    rect(g, [110, 112, 120], 0, y0, W, H - y0);
    const rnd = seeded(7);
    for (let i = 0; i < 260; i++) {
      const x = Math.floor(rnd() * (W / 6)) * 6;
      const y = y0 + Math.floor(rnd() * ((H - y0) / 6)) * 6;
      rect(g, rnd() < 0.5 ? [98, 100, 108] : [124, 126, 134], x, y, 6, 6);
    }
    for (let x = 150; x < W; x += 300) rect(g, [84, 86, 94], x, y0, 3, H - y0);
    for (let y = y0 + 200; y < H; y += 250) rect(g, [84, 86, 94], 0, y, W, 3);
  }

  function grass(g, y0) {
    rect(g, [76, 160, 70], 0, y0, W, H - y0);
    const rnd = seeded(11);
    for (let i = 0; i < 340; i++) {
      const x = Math.floor(rnd() * (W / 6)) * 6;
      const y = y0 + Math.floor(rnd() * ((H - y0) / 6)) * 6;
      rect(g, rnd() < 0.5 ? [64, 140, 60] : [96, 180, 86], x, y, 6, 6);
    }
    for (let i = 0; i < 45; i++) {
      const x = Math.floor(rnd() * (W / 6)) * 6;
      const y = y0 + Math.floor(rnd() * ((H - y0) / 6)) * 6;
      rect(g, [46, 112, 50], x, y, 3, 9);
      rect(g, [46, 112, 50], x + 6, y + 3, 3, 6);
    }
  }

  function wall(g, base, stripe, baseboard) {
    rect(g, base, 0, 0, W, WALL);
    for (let x = 0; x < W; x += 24) rect(g, stripe, x, 0, 6, WALL - 10);
    rect(g, baseboard, 0, WALL - 10, W, 10);
    rect(g, OUTLINE, 0, WALL, W, 4);
    rectA(g, 'rgba(0,0,0,0.2)', 0, WALL + 4, W, 10);
  }

  function windowPane(g, x, y, w, h, sky) {
    const frame = [150, 100, 60];
    rect(g, OUTLINE, x, y, w, h);
    rect(g, frame, x + 3, y + 3, w - 6, h - 6);
    rect(g, sky, x + 9, y + 9, w - 18, h - 18);
    rectA(g, 'rgba(255,255,255,0.35)', x + 12, y + 12, 12, Math.floor((h - 24) / 2));
    rect(g, frame, x + Math.floor(w / 2) - 3, y + 9, 6, h - 18);
    rect(g, frame, x + 9, y + Math.floor(h / 2) - 3, w - 18, 6);
  }

  // ----- muebles -----

  function rug(g, x, y, w, h, a, b) {
    rect(g, OUTLINE, x, y, w, h);
    rect(g, a, x + 3, y + 3, w - 6, h - 6);
    rect(g, b, x + 12, y + 12, w - 24, 3);
    rect(g, b, x + 12, y + h - 15, w - 24, 3);
    rect(g, b, x + 12, y + 12, 3, h - 24);
    rect(g, b, x + w - 15, y + 12, 3, h - 24);
    const dots = shade(a, 0.8);
    for (let i = x + 30; i < x + w - 36; i += 30) {
      for (let j = y + 30; j < y + h - 36; j += 30) rect(g, dots, i, j, 9, 9);
    }
  }

  function sofaV(g, x, y, h, c) {
    shadow(g, x + 4, y + 6, 98, h);
    block(g, x, y, 28, h, shade(c, 0.85));
    block(g, x + 28, y, 66, 26, shade(c, 0.9));
    block(g, x + 28, y + h - 26, 66, 26, shade(c, 0.9));
    block(g, x + 28, y + 26, 66, h - 52, c);
    rect(g, shade(c, 0.7), x + 31, y + 26 + Math.floor((h - 52) / 2), 60, 3);
  }

  function table(g, x, y, w, h) {
    shadow(g, x + 4, y + 6, w, h);
    block(g, x, y, w, h, [160, 104, 60]);
    rect(g, [130, 84, 48], x + 9, y + 9, w - 18, 3);
  }

  function plant(g, x, y) {
    shadow(g, x - 2, y + 54, 46, 8);
    block(g, x + 6, y + 36, 28, 22, [190, 100, 60]);
    const leaf = [60, 160, 70];
    block(g, x + 14, y, 12, 24, leaf);
    block(g, x, y + 12, 16, 16, shade(leaf, 0.9));
    block(g, x + 24, y + 12, 16, 16, shade(leaf, 1.1));
    block(g, x + 12, y + 20, 16, 18, shade(leaf, 0.95));
  }

  function bookshelf(g, x, y, w, h) {
    shadow(g, x + 4, y + 6, w, h);
    block(g, x, y, w, h, [120, 76, 44]);
    const bk = [
      [200, 60, 60], [60, 110, 200], [80, 170, 90], [230, 190, 60], [150, 80, 180],
    ];
    const rows = 2;
    const rh = Math.floor((h - 12) / rows);
    for (let r = 0; r < rows; r++) {
      const by = y + 6 + r * rh;
      rect(g, [70, 44, 26], x + 6, by, w - 12, rh - 3);
      let i = r;
      for (let bx = x + 9; bx < x + w - 15; bx += 9, i++) {
        rect(g, bk[i % bk.length], bx, by + 4 + (i % 3) * 2, 6, rh - 11 - (i % 3) * 2);
      }
    }
  }

  function bed(g, x, y, w, h, blanket) {
    shadow(g, x + 4, y + 6, w, h);
    block(g, x, y, w, h, [130, 84, 50]);
    rect(g, [235, 235, 245], x + 9, y + 9, w - 18, h - 18);
    const pw = Math.floor((w - 30) / 2);
    block(g, x + 12, y + 12, pw, 30, [255, 255, 255]);
    block(g, x + 18 + pw, y + 12, pw, 30, [255, 255, 255]);
    block(g, x + 9, y + 48, w - 18, h - 57, blanket);
  }

  function wardrobe(g, x, y, w, h) {
    shadow(g, x + 4, y + 6, w, h);
    block(g, x, y, w, h, [110, 70, 50]);
    rect(g, OUTLINE, x + Math.floor(w / 2) - 1, y + 6, 3, h - 12);
    rect(g, [240, 200, 90], x + Math.floor(w / 2) - 10, y + Math.floor(h / 2), 5, 10);
    rect(g, [240, 200, 90], x + Math.floor(w / 2) + 6, y + Math.floor(h / 2), 5, 10);
  }

  function fridge(g, x, y) {
    shadow(g, x + 4, y + 6, 70, 130);
    block(g, x, y, 70, 130, [225, 230, 235]);
    rect(g, OUTLINE, x + 3, y + 52, 64, 3);
    rect(g, [120, 125, 140], x + 10, y + 20, 4, 24);
    rect(g, [120, 125, 140], x + 10, y + 64, 4, 36);
  }

  function counter(g, x, y, w) {
    shadow(g, x + 4, y + 6, w, 56);
    block(g, x, y, w, 56, [150, 100, 60]);
    rect(g, [220, 220, 228], x + 3, y + 3, w - 6, 14);
    for (let dx = x + 48; dx < x + w - 6; dx += 48) rect(g, OUTLINE, dx, y + 20, 3, 33);
    for (let dx = x + 36; dx < x + w - 10; dx += 48) rect(g, [240, 200, 90], dx, y + 28, 5, 8);
  }

  function sink(g, x, y) {
    block(g, x, y, 70, 24, [170, 180, 190]);
    rect(g, [90, 150, 200], x + 9, y + 9, 52, 9);
    rect(g, [120, 125, 140], x + 32, y - 8, 6, 14);
  }

  function car(g, x, y, w, h, body) {
    shadow(g, x + 6, y + h - 4, w, 14);
    rect(g, OUTLINE, x + 30, y - 6, 44, 14);
    rect(g, OUTLINE, x + w - 80, y - 6, 44, 14);
    rect(g, OUTLINE, x + 30, y + h - 8, 44, 14);
    rect(g, OUTLINE, x + w - 80, y + h - 8, 44, 14);
    block(g, x, y, w, h, body);
    block(g, x + Math.floor((w * 30) / 100), y + 10, Math.floor((w * 38) / 100), h - 20, [120, 190, 230]);
    rect(g, [255, 230, 120], x + w - 9, y + 10, 6, 14);
    rect(g, [255, 230, 120], x + w - 9, y + h - 24, 6, 14);
    rect(g, [230, 50, 50], x + 3, y + 10, 6, 14);
    rect(g, [230, 50, 50], x + 3, y + h - 24, 6, 14);
  }

  function tree(g, x, y) {
    shadow(g, x - 6, y + 78, 78, 10);
    block(g, x + 24, y + 48, 18, 36, [120, 76, 44]);
    const leaf = [52, 140, 62];
    block(g, x, y + 20, 66, 40, shade(leaf, 0.9));
    block(g, x + 8, y, 50, 34, leaf);
  }

  function tires(g, x, y) {
    for (let i = 0; i < 3; i++) {
      block(g, x, y - i * 18, 54, 22, [40, 40, 48]);
      rect(g, [90, 90, 100], x + 18, y - i * 18 + 8, 18, 6);
    }
  }

  function hazardMat(g, x, y, w, h) {
    rect(g, OUTLINE, x, y, w, h);
    const n = Math.floor((w - 6) / 12);
    for (let i = 0; i < n; i++) {
      rect(g, i % 2 === 0 ? [240, 200, 40] : [40, 38, 46], x + 3 + i * 12, y + 3, 12, h - 6);
    }
  }

  function stoneSlab(g, x, y, w, h) {
    for (let i = 0; i < w; i += 36) {
      for (let j = 0; j < h; j += 30) block(g, x + i, y + j, 36, 30, [160, 160, 168]);
    }
  }

  // ----- paredes laterales y puertas (solo decoración del fondo) -----

  const WALL_T = 18; // grosor de las paredes izquierda y derecha
  const BOTTOM_Y = H - 24; // inicio de la pared de abajo
  const DOOR_WOOD = [150, 100, 60];

  function perimeter(g, base) {
    // sombra de las paredes sobre el piso
    rectA(g, 'rgba(0,0,0,0.18)', WALL_T, WALL + 4, 10, BOTTOM_Y - WALL - 4);
    rectA(g, 'rgba(0,0,0,0.18)', W - WALL_T - 10, WALL + 4, 10, BOTTOM_Y - WALL - 4);
    rectA(g, 'rgba(0,0,0,0.18)', WALL_T, BOTTOM_Y - 10, W - 2 * WALL_T, 10);
    // izquierda
    rect(g, base, 0, WALL, WALL_T - 4, H - WALL);
    rect(g, OUTLINE, WALL_T - 4, WALL, 4, H - WALL);
    // derecha
    rect(g, OUTLINE, W - WALL_T, WALL, 4, H - WALL);
    rect(g, base, W - WALL_T + 4, WALL, WALL_T - 4, H - WALL);
    // abajo
    rect(g, OUTLINE, 0, BOTTOM_Y, W, 4);
    rect(g, base, 0, BOTTOM_Y + 4, W, H - BOTTOM_Y - 4);
    rect(g, shade(base, 1.2), 0, BOTTOM_Y + 4, W, 3);
  }

  function doorMat(g, x, y, w, h) {
    rect(g, OUTLINE, x, y, w, h);
    rect(g, [160, 60, 60], x + 3, y + 3, w - 6, h - 6);
    rect(g, [210, 120, 90], x + 6, y + 6, w - 12, Math.max(2, h - 12));
  }

  // Puerta en la pared de arriba (vista de frente)
  function doorTop(g, cx, wood = DOOR_WOOD) {
    const x = cx - 32;
    rect(g, OUTLINE, x - 7, 14, 78, 92);
    rect(g, shade(wood, 0.72), x - 4, 17, 72, 86);
    block(g, x, 22, 64, 82, wood);
    const pn = shade(wood, 0.8);
    rect(g, pn, x + 9, 31, 18, 26);
    rect(g, pn, x + 37, 31, 18, 26);
    rect(g, pn, x + 9, 63, 18, 31);
    rect(g, pn, x + 37, 63, 18, 31);
    rect(g, [240, 200, 90], x + 29, 66, 6, 6);
    doorMat(g, cx - 34, 108, 68, 12);
  }

  // Puerta en la pared de abajo
  function doorBottom(g, cx, wood = DOOR_WOOD) {
    const x = cx - 36;
    rect(g, OUTLINE, x - 6, BOTTOM_Y - 2, 84, 26);
    block(g, x, BOTTOM_Y + 2, 72, 22, wood);
    const pn = shade(wood, 0.8);
    rect(g, pn, x + 8, BOTTOM_Y + 8, 24, 10);
    rect(g, pn, x + 40, BOTTOM_Y + 8, 24, 10);
    rect(g, [240, 200, 90], x + 33, BOTTOM_Y + 10, 6, 6);
    doorMat(g, cx - 32, BOTTOM_Y - 18, 64, 12);
  }

  // Puerta en la pared izquierda
  function doorLeft(g, cy, wood = DOOR_WOOD) {
    const y = cy - 36;
    block(g, 0, y, WALL_T, 72, wood);
    const pn = shade(wood, 0.8);
    rect(g, pn, 6, y + 8, 6, 24);
    rect(g, pn, 6, y + 40, 6, 24);
    rect(g, [240, 200, 90], 11, y + 33, 4, 6);
    doorMat(g, WALL_T + 4, cy - 30, 12, 60);
  }

  // Puerta en la pared derecha
  function doorRight(g, cy, wood = DOOR_WOOD) {
    const y = cy - 36;
    const x = W - WALL_T;
    block(g, x, y, WALL_T, 72, wood);
    const pn = shade(wood, 0.8);
    rect(g, pn, x + 6, y + 8, 6, 24);
    rect(g, pn, x + 6, y + 40, 6, 24);
    rect(g, [240, 200, 90], x + 3, y + 33, 4, 6);
    doorMat(g, x - 16, cy - 30, 12, 60);
  }

  // ----- cuartos -----

  function sala(g) {
    wood(g, WALL);
    wall(g, [214, 190, 150], [206, 180, 140], [120, 80, 50]);
    windowPane(g, 296, 16, 86, 66, [130, 200, 240]);
    block(g, 505, 20, 100, 62, [40, 40, 50]); // TV
    rect(g, [90, 150, 190], 514, 29, 82, 40);
    rect(g, [150, 200, 230], 514, 29, 82, 6);
    block(g, 622, 26, 52, 50, [200, 150, 60]); // cuadro
    rect(g, [90, 160, 90], 631, 35, 34, 32);
    rect(g, [240, 230, 120], 653, 41, 8, 8);

    rug(g, 220, 170, 380, 230, [170, 50, 60], [220, 170, 80]);
    sofaV(g, 72, 190, 160, [70, 110, 190]);
    table(g, 270, 235, 100, 70);
    bookshelf(g, 700, 106, 120, 72);
    plant(g, 70, 400);
    plant(g, 800, 440);

    perimeter(g, [190, 160, 120]);
    doorTop(g, 450); // -> Cocina
    doorBottom(g, 450); // -> Dormitorio
    doorLeft(g, 300); // -> Patio
    doorRight(g, 300); // -> Garage
  }

  function cocina(g) {
    checker(g, WALL, 48, [236, 238, 240], [190, 200, 214]);
    wall(g, [225, 232, 238], [225, 232, 238], [150, 160, 175]);
    for (let x = 0; x < W; x += 24) rect(g, [190, 200, 212], x, 0, 2, WALL - 10);
    for (let y = 0; y < WALL - 10; y += 24) rect(g, [190, 200, 212], 0, y, W, 2);
    rect(g, OUTLINE, 0, WALL, W, 4);
    windowPane(g, 330, 16, 100, 62, [130, 200, 240]);
    block(g, 470, 54, 110, 10, [150, 100, 60]); // repisa
    const jars = [[220, 80, 80], [240, 200, 70], [90, 180, 100], [90, 140, 220]];
    for (let i = 0; i < 4; i++) block(g, 478 + i * 26, 30, 20, 26, jars[i]);
    block(g, 620, 26, 44, 44, [255, 255, 255]); // reloj
    rect(g, OUTLINE, 640, 34, 4, 16);
    rect(g, OUTLINE, 640, 46, 12, 4);

    counter(g, 30, 106, 260);
    sink(g, 130, 108);
    fridge(g, 700, 104);
    shadow(g, 274, 234, 100, 86); // isla bajo la estufa
    block(g, 270, 228, 100, 86, [150, 100, 60]);
    rect(g, [220, 220, 228], 273, 231, 94, 14);
    table(g, 440, 240, 130, 80); // comedor
    block(g, 470, 210, 24, 24, [190, 70, 70]);
    block(g, 516, 210, 24, 24, [190, 70, 70]);
    block(g, 470, 330, 24, 24, [190, 70, 70]);
    block(g, 516, 330, 24, 24, [190, 70, 70]);

    perimeter(g, [196, 206, 220]);
    doorBottom(g, 450); // -> Sala
  }

  function garage(g) {
    concrete(g, WALL);
    wall(g, [150, 152, 160], [158, 160, 168], [90, 92, 100]);
    block(g, 330, 10, 230, 86, [200, 204, 214]); // portón
    for (let y = 24; y < 94; y += 14) rect(g, [140, 144, 156], 333, y, 224, 3);
    block(g, 620, 30, 40, 16, [255, 240, 160]); // lámpara

    shadow(g, 34, 112, 160, 70); // estante
    block(g, 30, 106, 160, 70, [120, 76, 44]);
    block(g, 42, 118, 36, 22, [190, 150, 100]);
    block(g, 86, 118, 36, 22, [190, 150, 100]);
    block(g, 132, 118, 40, 22, [200, 60, 60]);
    block(g, 42, 144, 60, 22, [190, 150, 100]);
    block(g, 112, 144, 24, 22, [80, 150, 90]);

    shadow(g, 704, 112, 140, 60); // banco de trabajo
    block(g, 700, 106, 140, 60, [130, 100, 70]);
    rect(g, [200, 205, 215], 716, 120, 36, 6);
    rect(g, [220, 70, 60], 770, 118, 28, 10);

    hazardMat(g, 268, 282, 104, 76);
    car(g, 540, 330, 260, 130, [190, 40, 40]);
    tires(g, 70, 420);

    perimeter(g, [126, 128, 140]);
    doorLeft(g, 300); // -> Sala
  }

  function dormitorio(g) {
    checker(g, WALL, 48, [96, 90, 150], [104, 98, 160]);
    wall(g, [70, 70, 120], [64, 64, 110], [50, 40, 70]);
    windowPane(g, 300, 16, 90, 66, [20, 30, 70]);
    rect(g, [250, 240, 180], 360, 32, 12, 12); // luna
    rect(g, [255, 255, 255], 320, 38, 3, 3);
    rect(g, [255, 255, 255], 336, 56, 3, 3);
    rect(g, [255, 255, 255], 350, 62, 3, 3);
    block(g, 500, 24, 60, 52, [230, 200, 90]); // póster
    rect(g, [200, 70, 70], 509, 33, 42, 34);
    rect(g, [255, 255, 255], 521, 41, 18, 18);

    wardrobe(g, 60, 104, 90, 130);
    bed(g, 640, 108, 150, 120, [200, 60, 70]);
    block(g, 590, 120, 36, 40, [140, 90, 56]); // mesita
    block(g, 598, 104, 20, 16, [255, 230, 120]); // lámpara
    table(g, 280, 235, 80, 60);
    rug(g, 360, 400, 250, 80, [160, 80, 120], [230, 190, 120]);

    perimeter(g, [84, 84, 140]);
    doorTop(g, 450); // -> Sala
  }

  function patio(g) {
    grass(g, 0);
    rect(g, [190, 140, 90], 0, 0, W, WALL); // cerca de arriba
    for (let x = 0; x < W; x += 18) rect(g, [150, 106, 64], x, 0, 3, WALL - 8);
    rect(g, [120, 82, 48], 0, 26, W, 6);
    rect(g, [120, 82, 48], 0, 70, W, 6);
    rect(g, OUTLINE, 0, WALL - 8, W, 4);
    rectA(g, 'rgba(0,0,0,0.2)', 0, WALL - 4, W, 10);

    for (let x = 360, i = 0; x < W; x += 60, i++) {
      block(g, x + 4, 285 + (i % 2) * 6, 52, 50, [170, 170, 176]); // camino
    }
    stoneSlab(g, 270, 270, 108, 90);
    stoneSlab(g, 570, 226, 108, 90);

    block(g, 380, 108, 200, 22, [110, 70, 44]); // jardinera
    const fl = [[240, 90, 120], [250, 220, 80], [250, 250, 250], [170, 110, 220]];
    for (let i = 0; i < 10; i++) rect(g, fl[i % fl.length], 392 + i * 18, 114, 6, 6);

    tree(g, 60, 130);
    tree(g, 790, 400);
    tree(g, 160, 370);

    // cerca en los otros lados + portón a la sala
    perimeter(g, [190, 140, 90]);
    for (let y = WALL + 6; y < H; y += 18) {
      rect(g, [150, 106, 64], 0, y, WALL_T - 4, 3);
      rect(g, [150, 106, 64], W - WALL_T + 4, y, WALL_T - 4, 3);
    }
    for (let x = 0; x < W; x += 18) rect(g, [150, 106, 64], x, BOTTOM_Y + 8, 3, H - BOTTOM_Y - 8);
    doorRight(g, 300, [176, 126, 80]); // -> Sala
  }

  const ROOMS = { Sala: sala, Cocina: cocina, Cochera: garage, Dormitorio: dormitorio, Patio: patio };
  const cache = {};

  function roomImage(name) {
    if (cache[name]) return cache[name];
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d');
    if (ROOMS[name]) ROOMS[name](g);
    else rect(g, [45, 45, 55], 0, 0, W, H);
    cache[name] = cv;
    return cv;
  }

  // ----- elementos dinámicos -----

  function drawPlayer(g, x, y, moving) {
    shadow(g, x + 3, y + 27, 24, 4);
    const frameA = !moving || Math.floor(Date.now() / 150) % 2 === 0;
    sprite(g, frameA ? PLAYER_A : PLAYER_B, x, y, 3);
  }

  function drawTask(g, t, near) {
    const x = t.x;
    const y = t.y;

    shadow(g, x, y + 36, 38, 5);
    sprite(g, SPRITES[t.name] || CHECK, x - 2, y - 2, 5);

    if (t.completed) {
      sprite(g, CHECK, x + 22, y - 18, 3);
    } else if (near) {
      block(g, x + 6, y - 32, 28, 28, [255, 255, 255]);
      g.fillStyle = css(OUTLINE);
      g.font = font(18);
      g.fillText('E', x + 14, y - 12);
    } else {
      const bob = (Math.floor(Date.now() / 250) % 2) * 3;
      block(g, x + 10, y - 28 - bob, 20, 24, [255, 210, 50]);
      rect(g, OUTLINE, x + 18, y - 23 - bob, 4, 9);
      rect(g, OUTLINE, x + 18, y - 11 - bob, 4, 4);
    }

    g.font = font(12);
    const tw = Math.ceil(g.measureText(t.name).width);
    const lx = x + 18 - Math.floor(tw / 2);
    const ly = y + 58;
    rectA(g, 'rgba(20,18,30,0.75)', lx - 4, ly - 12, tw + 8, 17);
    g.fillStyle = t.completed ? 'rgb(120,255,150)' : '#fff';
    g.fillText(t.name, lx, ly);
  }

  function exitSign(g, dir, cx, cy, label, c) {
    spriteColor(g, arrowFor(dir), cx - 14, cy - 14, 4, c);
    const tw = Math.ceil(g.measureText(label).width);
    let lx;
    let ly;
    if (dir === 'U') { lx = cx - Math.floor(tw / 2); ly = cy + 30; }
    else if (dir === 'D') { lx = cx - Math.floor(tw / 2); ly = cy - 20; }
    else if (dir === 'L') { lx = 24; ly = cy - 22; }
    else { lx = 862 - tw; ly = cy - 22; }
    rectA(g, 'rgba(20,18,30,0.75)', lx - 3, ly - 11, tw + 6, 15);
    g.fillStyle = css(c);
    g.fillText(label, lx, ly);
  }

  // Las flechas van justo frente a cada puerta
  function drawExits(g, room) {
    const c = Math.floor(Date.now() / 400) % 2 === 0 ? [255, 230, 80] : [255, 170, 40];
    g.font = font(12);
    switch (room) {
      case 'Sala':
        exitSign(g, 'U', 450, 138, 'COCINA', c);
        exitSign(g, 'D', 450, 520, 'DORMITORIO', c);
        exitSign(g, 'L', 50, 300, 'PATIO', c);
        exitSign(g, 'R', 846, 300, 'COCHERA', c);
        break;
      case 'Cocina': exitSign(g, 'D', 450, 520, 'SALA', c); break;
      case 'Cochera': exitSign(g, 'L', 50, 300, 'SALA', c); break;
      case 'Dormitorio': exitSign(g, 'U', 450, 138, 'SALA', c); break;
      case 'Patio': exitSign(g, 'R', 846, 300, 'SALA', c); break;
      default: break;
    }
  }

  const Art = { panel, roomImage, drawPlayer, drawTask, drawExits };

  // ------------------------------------------------------------
  // FÍSICA: colisiones con paredes, muebles y objetos
  // ------------------------------------------------------------

  const R = (x, y, w, h) => ({ x, y, w, h });
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  // Caja de colisión del jugador: solo los pies (vista desde arriba),
  // así puede pararse "delante" de un mueble sin chocar con la cabeza.
  const HB = { ox: 4, oy: 16, w: 22, h: 14 };
  const hitbox = (x, y) => R(x + HB.ox, y + HB.oy, HB.w, HB.h);

  // Huecos de las puertas (el único lugar por donde se puede salir)
  const DOOR_X1 = 414; // puertas de arriba / abajo
  const DOOR_X2 = 486;
  const DOOR_Y1 = 264; // puertas de izquierda / derecha
  const DOOR_Y2 = 336;
  const TOP_EDGE = WALL + 4;

  function wallSolids(d) {
    const out = [];
    // arriba
    if (d.top) out.push(R(0, 0, DOOR_X1, TOP_EDGE), R(DOOR_X2, 0, W - DOOR_X2, TOP_EDGE));
    else out.push(R(0, 0, W, TOP_EDGE));
    // abajo
    if (d.bottom) out.push(R(0, BOTTOM_Y, DOOR_X1, H - BOTTOM_Y), R(DOOR_X2, BOTTOM_Y, W - DOOR_X2, H - BOTTOM_Y));
    else out.push(R(0, BOTTOM_Y, W, H - BOTTOM_Y));
    // izquierda
    if (d.left) out.push(R(0, 0, WALL_T, DOOR_Y1), R(0, DOOR_Y2, WALL_T, H - DOOR_Y2));
    else out.push(R(0, 0, WALL_T, H));
    // derecha
    if (d.right) out.push(R(W - WALL_T, 0, WALL_T, DOOR_Y1), R(W - WALL_T, DOOR_Y2, WALL_T, H - DOOR_Y2));
    else out.push(R(W - WALL_T, 0, WALL_T, H));
    return out;
  }

  const treeSolid = (x, y) => R(x + 4, y + 24, 58, 60);
  const plantSolid = (x, y) => R(x + 6, y + 36, 28, 22);

  // Muebles sólidos de cada cuarto (coinciden con lo que se dibuja arriba)
  const ROOM_SOLIDS = {
    Sala: [
      ...wallSolids({ top: true, bottom: true, left: true, right: true }),
      R(72, 190, 94, 160), // sillón
      R(270, 235, 100, 70), // mesa
      R(700, 106, 120, 72), // librero
      plantSolid(70, 400),
      plantSolid(800, 440),
    ],
    Cocina: [
      ...wallSolids({ bottom: true }),
      R(30, 106, 260, 56), // barra + fregadero
      R(700, 104, 70, 130), // refrigerador
      R(270, 228, 100, 86), // isla de la estufa
      R(440, 240, 130, 80), // mesa
      R(470, 210, 24, 24), R(516, 210, 24, 24), // sillas
      R(470, 330, 24, 24), R(516, 330, 24, 24),
    ],
    Cochera: [
      ...wallSolids({ left: true }),
      R(30, 106, 160, 70), // estante
      R(700, 106, 140, 60), // banco de trabajo
      R(540, 324, 260, 142), // carro (con llantas)
      R(70, 384, 54, 58), // llantas apiladas
    ],
    Dormitorio: [
      ...wallSolids({ top: true }),
      R(60, 104, 90, 130), // ropero
      R(640, 108, 150, 120), // cama
      R(590, 104, 36, 56), // mesita + lámpara
      R(280, 235, 80, 60), // mesa
    ],
    Patio: [
      ...wallSolids({ right: true }),
      R(380, 108, 200, 22), // jardinera
      treeSolid(60, 130),
      treeSolid(790, 400),
      treeSolid(160, 370),
    ],
  };

  // Base de los objetos de las tareas (vela, estufa, etc.)
  const taskSolid = (t) => R(t.x, t.y + 10, 36, 28);

  // ------------------------------------------------------------
  // JUGADOR Y TAREAS
  // ------------------------------------------------------------

  class Player {
    constructor() {
      this.x = 450;
      this.y = 300;
      this.speed = 4;
      this.up = false;
      this.down = false;
      this.left = false;
      this.right = false;
    }

    blocked(x, y, solids) {
      const hb = hitbox(x, y);
      return solids.some((s) => overlap(hb, s));
    }

    // Avanza pixel por pixel en un eje y se detiene justo al tocar algo
    moveAxis(dx, dy, solids) {
      const steps = Math.abs(dx || dy);
      const sx = Math.sign(dx);
      const sy = Math.sign(dy);
      for (let i = 0; i < steps; i++) {
        const nx = Math.max(0, Math.min(this.x + sx, 870));
        const ny = Math.max(0, Math.min(this.y + sy, 570));
        // si ya estuviera atorado dentro de algo, se le deja salir
        if (this.blocked(nx, ny, solids) && !this.blocked(this.x, this.y, solids)) break;
        this.x = nx;
        this.y = ny;
      }
    }

    update(solids = []) {
      const dx = (this.right ? 1 : 0) - (this.left ? 1 : 0);
      const dy = (this.down ? 1 : 0) - (this.up ? 1 : 0);
      // cada eje por separado: permite deslizarse pegado a una pared
      if (dx) this.moveAxis(dx * this.speed, 0, solids);
      if (dy) this.moveAxis(0, dy * this.speed, solids);
    }

    stop() {
      this.up = this.down = this.left = this.right = false;
    }

    draw(g, hop = 0) {
      const moving = hop > 0 || this.up || this.down || this.left || this.right;
      Art.drawPlayer(g, this.x, this.y - hop, moving);
    }
  }

  class Task {
    constructor(name, room, x, y, explanation) {
      this.name = name;
      this.room = room;
      this.x = x;
      this.y = y;
      this.explanation = explanation;
      this.completed = false;
    }

    complete() {
      this.completed = true;
    }
  }

  // ------------------------------------------------------------
  // JUEGO
  // ------------------------------------------------------------

  const CONFETTI = [
    [255, 80, 80], [255, 176, 48], [255, 224, 64], [96, 224, 112], [80, 160, 255], [192, 112, 255],
  ];
  const STAR = [
    '....y....', '...yyy...', 'yyyyyyyyy', '.yyyyyyy.', '..yyyyy..', '.yyy.yyy.', 'yy.....yy',
  ];

  const WARN = [
    '....y....', '...yky...', '...yky...', '..yykyy..', '..yykyy..', '.yyyyyyy.', '.yyykyyy.', 'yyyyyyyyy',
  ];

  const FLAME_FIRE = { outer: [255, 140, 30], tip: [230, 70, 40], mid: [255, 220, 60], core: [255, 250, 210] };
  const FLAME_GAS = { outer: [50, 100, 235], tip: [40, 70, 200], mid: [120, 180, 255], core: [225, 240, 255] };

  // Flama de pixeles que parpadea. rows = alto en pixeles grandes, u = tamaño de cada pixel
  function pixelFlame(g, cx, baseY, rows, u, t, seed = 0, pal = FLAME_FIRE) {
    if (rows < 1) return;
    const flick = Math.sin(t * 17 + seed) * 0.5 + Math.sin(t * 29 + seed * 2.3) * 0.5;
    const h = Math.max(1, Math.round(rows + flick));
    const maxHalf = Math.max(1, Math.round(rows * 0.38));
    for (let r = 0; r < h; r++) {
      const f = r / h;
      const shape = f < 0.3 ? 0.75 + f * 0.83 : (1 - f) / 0.7;
      const half = Math.max(1, Math.round(maxHalf * shape));
      const sway = Math.round(Math.sin(t * 9 + r * 0.7 + seed) * f * 1.5);
      const y = baseY - (r + 1) * u;
      const x = cx + sway * u;
      rect(g, f > 0.75 ? pal.tip : pal.outer, x - half * u, y, half * 2 * u, u);
      if (half >= 2) rect(g, pal.mid, x - (half - 1) * u, y, (half - 1) * 2 * u, u);
      if (half >= 3 && f < 0.5) rect(g, pal.core, x - (half - 2) * u, y, (half - 2) * 2 * u, u);
    }
  }

  // Bocanadas de humo que suben (d = segundos desde que empezó)
  function smokePuffs(g, cx, baseY, d) {
    for (let i = 0; i < 4; i++) {
      const k = d - i * 0.12;
      if (k < 0) continue;
      const a = 0.7 - k * 0.8;
      if (a <= 0) continue;
      const s = 9 + Math.round((k * 12) / 3) * 3;
      const x = Math.round((cx + Math.sin(k * 7 + i * 2) * 10 - s / 2) / 3) * 3;
      const y = Math.round((baseY - k * 90) / 3) * 3;
      rectA(g, `rgba(175,175,185,${a.toFixed(2)})`, x, y, s, s);
    }
  }

  const snap3 = (v) => Math.round(v / 3) * 3;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  // Curvas de animación
  function easeOutBack(x) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  }
  function easeOutBounce(x) {
    const n = 7.5625;
    const d = 2.75;
    if (x < 1 / d) return n * x * x;
    if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
    if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375;
    return n * (x -= 2.625 / d) * x + 0.984375;
  }

  const PANEL_X = 150;
  const PANEL_Y = 80;
  const PANEL_WIDTH = 600;
  const PANEL_HEIGHT = 440;
  const MESSAGE_DURATION = 5000;

  // Texto centrado horizontalmente en la pantalla
  function ctext(g, text, y) {
    g.textAlign = 'center';
    g.fillText(text, W / 2, y);
    g.textAlign = 'left';
  }

  function roundRectPath(g, x, y, w, h, arc) {
    const r = arc / 2;
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function fillRoundRect(g, x, y, w, h, arc) {
    roundRectPath(g, x, y, w, h, arc);
    g.fill();
  }

  function fillOval(g, x, y, w, h) {
    g.beginPath();
    g.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    g.fill();
  }

  class Game {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.reset();
    }

    // Deja todo como al inicio (también se usa para "jugar otra vez")
    reset() {
      this.particles = [];
      this.endStart = 0;
      this.nextBurst = 0;

      this.player = new Player();
      this.tasks = [];

      this.timeLeft = 180;
      this.lastTime = Date.now();

      this.currentRoom = 'Sala';
      this.message = '\u00a1Completa todas las tareas!';

      this.gameWon = false;
      this.gameOver = false;

      this.showingTask = false;
      this.activeTask = null;

      this.showingMessage = false;
      this.messageStartTime = 0;
      this.educationalTitle = '';
      this.educationalMessage = '';

      this.dragging = false;
      this.mouseX = 0;
      this.mouseY = 0;

      this.cableX = 570;
      this.switchX = 340;
      this.bbqY = 248;
      this.grabDY = 0;
      this.taskStart = 0;
      this.taskDone = 0;

      this.taskType = '';

      this.buildTasks();
    }

    buildTasks() {
      const add = (name, room, x, y, text) => this.tasks.push(new Task(name, room, x, y, text));

      // SALA
      add('Apagar vela', 'Sala', 300, 250,
        'Apaga siempre las velas al salir de un cuarto. Nunca dejes una vela encendida sin vigilancia.');
      add('Revisar extensi\u00f3n', 'Sala', 600, 350,
        'Las extensiones da\u00f1adas o sobrecargadas pueden causar un accidente el\u00e9ctrico o un incendio.');

      // COCINA
      add('Apagar estufa', 'Cocina', 300, 250,
        'Apaga siempre la estufa al terminar de cocinar. Nunca dejes comida en el fuego sin vigilancia.');
      add('Revisar detector de humo', 'Cocina', 600, 350,
        'Los detectores de humo avisan a tiempo cuando hay un incendio. Revisa que funcionen.');

      // GARAGE
      add('Levantar bote de gasolina', 'Cochera', 300, 300,
        'Guarda los botes de gasolina de pie, bien cerrados y en un lugar seguro, lejos de cualquier fuente de calor o chispas.');

      // DORMITORIO
      add('Apagar vela', 'Dormitorio', 300, 250,
        'Nunca dejes velas encendidas mientras duermes o cuando sales de un cuarto.');
      add('Revisar extensi\u00f3n', 'Dormitorio', 600, 350,
        'Revisa los cables el\u00e9ctricos y no uses extensiones da\u00f1adas o sobrecargadas.');

      // PATIO
      add('Apagar calentador', 'Patio', 300, 300,
        'Apaga el calentador cuando no lo necesites y sigue las instrucciones de seguridad del fabricante.');
      add('Cerrar asador', 'Patio', 600, 250,
        'Cierra el asador despu\u00e9s de usarlo y sigue sus instrucciones de seguridad. Aseg\u00farate de que quede bien apagado.');
    }

    // ----- ciclo de juego (un "tick" ≈ 16 ms) -----

    update() {
      const now = Date.now();

      if (this.showingTask) {
        // después de la animación de "¡LISTO!" se muestra el consejo
        if (this.taskDone && now - this.taskDone >= 1100) this.completeTask();
        return;
      }

      if (this.showingMessage) {
        if (now - this.messageStartTime >= MESSAGE_DURATION) {
          this.showingMessage = false;
          this.lastTime = now;
        }
        return;
      }

      if (!this.gameWon && !this.gameOver) {
        this.player.update(this.solids());
        this.checkRoomTransition();

        if (now - this.lastTime >= 1000) {
          this.timeLeft--;
          this.lastTime += 1000;
          // si la pestaña estuvo en segundo plano, no castigar al jugador
          if (now - this.lastTime >= 1000) this.lastTime = now;
        }

        if (this.timeLeft <= 0) {
          this.timeLeft = 0;
          this.gameOver = true;
          this.message = '\u00a1SE ACAB\u00d3 EL TIEMPO!';
        }
      }

      if (this.gameWon || this.gameOver) this.updateEnding(now);
    }

    // ----- animaciones de victoria y derrota -----

    updateEnding(now) {
      if (!this.endStart) {
        this.endStart = now;
        this.nextBurst = now + 300;
        this.player.stop();
      }
      const t = (now - this.endStart) / 1000;
      const P = this.particles;
      const rnd = (a, b) => a + Math.random() * (b - a);

      if (this.gameWon) {
        // confeti que cae
        const rate = t < 4 ? 3 : 1;
        for (let i = 0; i < rate; i++) {
          P.push({
            kind: 'confetti', x: rnd(0, W), y: -10, vx: rnd(-1, 1), vy: rnd(1.2, 3),
            life: 0, max: 500, size: 6, spin: rnd(0, 6),
            color: CONFETTI[Math.floor(Math.random() * CONFETTI.length)],
          });
        }
        // fuegos artificiales
        if (now >= this.nextBurst) {
          this.nextBurst = now + rnd(500, 1000);
          const cx = rnd(120, W - 120);
          const cy = rnd(120, 300);
          const color = CONFETTI[Math.floor(Math.random() * CONFETTI.length)];
          for (let i = 0; i < 36; i++) {
            const a = (i / 36) * Math.PI * 2;
            const s = rnd(2.5, 5);
            P.push({
              kind: 'spark', x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
              life: 0, max: rnd(45, 75), size: 6, color,
            });
          }
        }
      } else {
        // fuego que sube desde abajo, cada vez más intenso
        const rate = Math.min(7, 1 + Math.floor(t * 3));
        for (let i = 0; i < rate; i++) {
          P.push({
            kind: 'fire', x: rnd(0, W), y: H + 6, vx: rnd(-0.5, 0.5), vy: -rnd(2, 5),
            life: 0, max: rnd(40, 95), size: 12 + Math.floor(rnd(0, 3)) * 6,
          });
        }
      }

      for (const p of P) {
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        if (p.kind === 'spark') { p.vy += 0.08; p.vx *= 0.98; }
        else if (p.kind === 'confetti') p.vx += Math.sin((p.life + p.spin * 10) / 15) * 0.05;
        else if (p.kind === 'fire') p.vx += rnd(-0.3, 0.3);
      }
      this.particles = P.filter((p) => p.life < p.max && p.y < H + 30).slice(-1200);
    }

    drawParticles() {
      const g = this.ctx;
      for (const p of this.particles) {
        const f = p.life / p.max;
        const x = Math.round(p.x / 3) * 3;
        const y = Math.round(p.y / 3) * 3;
        if (p.kind === 'confetti') {
          // se "voltea" mientras cae
          const w = Math.abs(Math.cos(p.life / 8 + p.spin)) > 0.5 ? 6 : 3;
          rect(g, p.color, x, y, w, 6);
        } else if (p.kind === 'spark') {
          rectA(g, `rgba(${p.color[0]},${p.color[1]},${p.color[2]},${(1 - f).toFixed(2)})`, x, y, 6, 6);
        } else {
          const s = Math.max(3, Math.round((p.size * (1 - f * 0.6)) / 3) * 3);
          let style;
          if (f < 0.25) style = 'rgb(255,230,90)';
          else if (f < 0.5) style = 'rgb(255,140,30)';
          else if (f < 0.72) style = 'rgb(220,50,40)';
          else style = `rgba(60,58,70,${(0.7 * (1 - f)).toFixed(2)})`;
          rectA(g, style, x - s / 2, y - s / 2, s, s);
        }
      }
    }

    // Texto con borde oscuro estilo pixel
    outlinedText(text, x, y, fill) {
      const g = this.ctx;
      g.fillStyle = css(OUTLINE);
      for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3], [3, 3]]) g.fillText(text, x + dx, y + dy);
      g.fillStyle = fill;
      g.fillText(text, x, y);
    }

    centeredText(text, y, size, fill, bold = true) {
      const g = this.ctx;
      g.font = font(size, bold);
      const w = g.measureText(text).width;
      this.outlinedText(text, Math.round(W / 2 - w / 2), y, fill);
    }

    // Letras que ondulan (cada letra con su propio color/altura)
    waveText(text, y, size, t, colorFor, amp = 8) {
      const g = this.ctx;
      g.font = font(size);
      const chars = [...text];
      const widths = chars.map((c) => g.measureText(c).width);
      let x = W / 2 - widths.reduce((a, b) => a + b, 0) / 2;
      chars.forEach((c, i) => {
        const dy = Math.round((Math.sin(t * 6 - i * 0.6) * amp) / 3) * 3;
        this.outlinedText(c, Math.round(x), y + dy, colorFor(i));
        x += widths[i];
      });
    }

    drawVictory() {
      const g = this.ctx;
      const t = (Date.now() - this.endStart) / 1000;

      rectA(g, `rgba(10,10,40,${Math.min(0.45, t * 0.6).toFixed(2)})`, 0, 0, W, H);

      // panel que baja con rebote
      const py = Math.round(-300 + (170 + 300) * easeOutBack(Math.min(1, t / 0.7)));
      Art.panel(g, 190, py, 520, 270, [38, 43, 55]);
      rect(g, [255, 210, 50], 199, py + 9, 502, 3);

      const rainbow = ['#ff5050', '#ffb030', '#ffe040', '#60e070', '#50a0ff', '#c070ff'];
      this.waveText('\u00a1GANASTE!', py + 70, 48, t, (i) => rainbow[(i + Math.floor(t * 8)) % rainbow.length]);

      // personajes festejando a los lados del título
      for (const [px, phase] of [[222, 0], [638, Math.PI / 2]]) {
        const jump = Math.round((Math.abs(Math.sin(t * 6 + phase)) * 24) / 3) * 3;
        shadow(g, px + 4, py + 82, 32, 6);
        sprite(g, Math.floor(t * 6) % 2 ? PLAYER_A : PLAYER_B, px, py + 44 - jump, 4);
      }

      // tres estrellas que aparecen una por una
      for (let i = 0; i < 3; i++) {
        const k = (t - 0.7 - i * 0.3) / 0.25;
        if (k <= 0) continue;
        const scale = Math.max(1, Math.round(5 * easeOutBack(Math.min(1, k))));
        const cx = 450 + (i - 1) * 80;
        const cy = py + 120 - (i === 1 ? 10 : 0);
        sprite(g, STAR, cx - Math.round((9 * scale) / 2), cy - Math.round((7 * scale) / 2), scale);
      }

      if (t > 1.6) {
        this.centeredText('\u00a1La casa est\u00e1 segura!', py + 180, 22, '#fff');
        const m = Math.floor(this.timeLeft / 60);
        const s = String(this.timeLeft % 60).padStart(2, '0');
        this.centeredText(`Tiempo restante: ${m}:${s}`, py + 212, 17, '#9f9', false);
      }
      if (t > 2.2 && Math.floor(t * 2) % 2 === 0) this.centeredText('R = Jugar otra vez', py + 248, 17, '#ff0');

      this.drawParticles();
    }

    drawDefeat() {
      const g = this.ctx;
      const t = (Date.now() - this.endStart) / 1000;

      // tinte rojo que late
      const a = Math.min(0.5, t * 0.35) + Math.sin(t * 4) * 0.05;
      rectA(g, `rgba(120,0,0,${Math.max(0, a).toFixed(2)})`, 0, 0, W, H);

      this.drawParticles();

      const py = Math.round(-300 + (160 + 300) * easeOutBounce(Math.min(1, Math.max(0, t - 0.3) / 0.9)));
      Art.panel(g, 190, py, 520, 260, [55, 30, 35]);
      rect(g, [220, 50, 40], 199, py + 9, 502, 3);

      const flash = Math.floor(t * 4) % 2 === 0 ? '#ff3030' : '#ff9a30';
      this.waveText('\u00a1TIEMPO AGOTADO!', py + 75, 42, t, () => flash, 3);

      if (t > 1.3) {
        this.centeredText('La casa no qued\u00f3 segura a tiempo...', py + 130, 19, '#fff');
        const done = this.tasks.filter((x) => x.completed).length;
        this.centeredText(`Tareas completadas: ${done}/${this.tasks.length}`, py + 168, 18, '#fc8', false);
      }
      if (t > 2 && Math.floor(t * 2) % 2 === 0) this.centeredText('R = Intentar de nuevo', py + 220, 18, '#ff0');
    }

    // Todo lo que bloquea al jugador en el cuarto actual
    solids() {
      const list = ROOM_SOLIDS[this.currentRoom] || [];
      const objs = this.tasks.filter((t) => t.room === this.currentRoom).map(taskSolid);
      return list.concat(objs);
    }

    // Como las paredes son sólidas, el jugador solo llega a estos bordes
    // pasando por el hueco de la puerta.
    checkRoomTransition() {
      const p = this.player;
      switch (this.currentRoom) {
        case 'Sala':
          if (p.y <= 5) { this.currentRoom = 'Cocina'; p.y = 520; }
          else if (p.x >= 860) { this.currentRoom = 'Cochera'; p.x = 10; }
          else if (p.y >= 555) { this.currentRoom = 'Dormitorio'; p.y = 10; }
          else if (p.x <= 5) { this.currentRoom = 'Patio'; p.x = 850; }
          break;
        case 'Cocina':
          if (p.y >= 555) { this.currentRoom = 'Sala'; p.y = 10; }
          break;
        case 'Cochera':
          if (p.x <= 5) { this.currentRoom = 'Sala'; p.x = 850; }
          break;
        case 'Dormitorio':
          if (p.y <= 5) { this.currentRoom = 'Sala'; p.y = 540; }
          break;
        case 'Patio':
          if (p.x >= 860) { this.currentRoom = 'Sala'; p.x = 10; }
          break;
        default: break;
      }
    }

    // ----- tareas -----

    interact() {
      for (const task of this.tasks) {
        if (task.room === this.currentRoom && !task.completed) {
          const distance = Math.hypot(this.player.x - task.x, this.player.y - task.y);
          if (distance < 65) {
            this.activeTask = task;
            this.showingTask = true;
            this.dragging = false;

            this.cableX = 570;
            this.switchX = 340;
            this.bbqY = 248;
            this.taskStart = Date.now();
            this.taskDone = 0;

            this.identifyTask();
            this.player.stop();
            return;
          }
        }
      }
      this.message = '\u00a1No hay tareas cerca!';
    }

    identifyTask() {
      const types = {
        'Apagar vela': 'CANDLE',
        'Revisar extensi\u00f3n': 'CABLE',
        'Apagar estufa': 'STOVE',
        'Revisar detector de humo': 'DETECTOR',
        'Levantar bote de gasolina': 'GAS',
        'Apagar calentador': 'BOILER',
        'Cerrar asador': 'BBQ',
      };
      this.taskType = this.activeTask ? types[this.activeTask.name] || '' : '';
    }

    completeTask() {
      if (!this.activeTask) return;

      const done = this.activeTask;
      done.complete();
      this.taskDone = 0;

      this.activeTask = null;
      this.showingTask = false;
      this.dragging = false;

      this.showEducationalMessage(done);
      this.checkVictory();
    }

    showEducationalMessage(task) {
      this.educationalTitle = task.name;
      this.educationalMessage = task.explanation;
      this.showingMessage = true;
      this.messageStartTime = Date.now();
      this.message = '\u00a1Misi\u00f3n completada!';
    }

    checkVictory() {
      this.gameWon = this.tasks.every((t) => t.completed);
      if (this.gameWon) this.message = '\u00a1TODAS LAS TAREAS LISTAS!';
    }

    // ----- dibujo -----

    drawWrappedText(text, x, y, maxWidth, lineHeight) {
      const g = this.ctx;
      const words = text.split(' ');
      let line = '';
      for (const word of words) {
        const test = line === '' ? word : `${line} ${word}`;
        if (g.measureText(test).width > maxWidth) {
          g.fillText(line, x, y);
          y += lineHeight;
          line = word;
        } else {
          line = test;
        }
      }
      if (line !== '') g.fillText(line, x, y);
    }

    drawTaskInterface() {
      const g = this.ctx;
      const now = Date.now();
      const t = (now - this.taskStart) / 1000;
      const done = this.taskDone ? (now - this.taskDone) / 1000 : -1; // segundos desde que se logró
      const blink = Math.floor(t * 3) % 2 === 0;
      const cue = done < 0 && !this.dragging && blink; // flechita de ayuda

      rectA(g, 'rgba(0,0,0,0.86)', 0, 0, W, H);

      Art.panel(g, PANEL_X, PANEL_Y, PANEL_WIDTH, PANEL_HEIGHT, [38, 43, 55]);
      const border = done >= 0 && Math.floor(done * 8) % 2 === 0 ? [170, 255, 190] : [80, 190, 130];
      rect(g, border, PANEL_X + 9, PANEL_Y + 9, PANEL_WIDTH - 18, 3);
      rect(g, border, PANEL_X + 9, PANEL_Y + PANEL_HEIGHT - 12, PANEL_WIDTH - 18, 3);
      rect(g, border, PANEL_X + 9, PANEL_Y + 9, 3, PANEL_HEIGHT - 18);
      rect(g, border, PANEL_X + PANEL_WIDTH - 12, PANEL_Y + 9, 3, PANEL_HEIGHT - 18);

      g.fillStyle = '#fff';
      g.font = font(27);
      ctext(g, 'ACTIVIDAD', 130);

      g.font = font(21);
      g.fillStyle = '#ff0';
      g.fillText(this.activeTask.name, 200, 175);

      g.fillStyle = '#fff';
      g.font = font(15, false);
      g.fillText('Completa la actividad usando el mouse.', 200, 205);

      // escenario de la actividad
      rect(g, OUTLINE, 176, 220, 548, 226);
      rect(g, [28, 31, 42], 179, 223, 542, 220);

      let hint = '';
      const arrow = (dir, x, y) => { if (cue) spriteColor(g, arrowFor(dir), x, y, 4, [255, 230, 80]); };

      g.save();
      g.beginPath();
      g.rect(179, 223, 542, 220);
      g.clip();

      switch (this.taskType) {
        case 'CANDLE': {
          hint = 'HAZ CLIC EN LA FLAMA PARA APAGAR LA VELA';
          const out = done >= 0 ? clamp01(done / 0.25) : 0;
          if (out < 1) {
            const a = (0.09 + Math.sin(t * 8) * 0.03) * (1 - out);
            for (let i = 3; i >= 1; i--) rectA(g, `rgba(255,200,80,${a.toFixed(3)})`, 450 - i * 33, 285 - i * 24, i * 66, i * 48);
          }
          block(g, 390, 400, 120, 16, [170, 175, 190]); // plato
          block(g, 424, 318, 52, 86, [250, 245, 235]); // vela
          rect(g, [222, 212, 196], 464, 324, 6, 74);
          rect(g, [255, 255, 250], 432, 321, 6, 18); // cera escurrida
          rect(g, [255, 255, 250], 452, 321, 6, 10);
          rect(g, OUTLINE, 448, 304, 4, 16); // pabilo
          if (out < 1) pixelFlame(g, 450, 306, Math.round(12 * (1 - out)), 4, t);
          if (done >= 0.15) smokePuffs(g, 450, 290, done - 0.15);
          arrow('L', 500, 252);
          break;
        }

        case 'CABLE': {
          hint = 'ARRASTRA LA CLAVIJA A LA IZQUIERDA PARA DESCONECTARLA';
          const off = done >= 0;
          const cx = Math.round(this.cableX);
          // lámpara conectada
          if (!off) rectA(g, 'rgba(255,230,120,0.16)', 170, 240, 104, 100);
          block(g, 196, 398, 48, 12, [120, 90, 70]);
          rect(g, [150, 150, 160], 217, 300, 6, 100);
          block(g, 190, 266, 60, 38, off ? [150, 120, 80] : [250, 210, 120]);
          if (!off) rect(g, [255, 250, 200], 212, 304, 16, 8);
          // cable por el piso
          const cable = [240, 200, 60];
          rect(g, cable, 244, 401, cx - 40 - 244, 6);
          rect(g, cable, cx - 40, 318, 6, 89);
          rect(g, cable, cx - 40, 315, 26, 6);
          rect(g, [70, 40, 30], 318, 401, 26, 6); // parte dañada
          rect(g, [230, 140, 60], 322, 398, 3, 3);
          rect(g, [230, 140, 60], 334, 407, 3, 3);
          rect(g, [230, 140, 60], 340, 398, 3, 3);
          // regleta sobrecargada
          const plugs = [[220, 70, 70], [80, 150, 230], [90, 190, 110]];
          plugs.forEach((c, i) => rect(g, c, 612 + i * 36, 232, 6, 50));
          block(g, 590, 296, 124, 44, [225, 228, 235]);
          plugs.forEach((c, i) => block(g, 602 + i * 36, 274, 26, 30, c));
          rect(g, [220, 60, 50], 700, 304, 6, 6); // luz roja
          // clavija del jugador
          block(g, cx - 15, 302, 36, 32, [240, 240, 245]);
          rect(g, [200, 170, 60], cx + 21, 308, 10, 5);
          rect(g, [200, 170, 60], cx + 21, 323, 10, 5);
          if (!off) {
            const rnd = seeded(Math.floor(t * 14));
            for (let i = 0; i < 6; i++) {
              if (rnd() < 0.4) continue;
              const c = rnd() < 0.5 ? [255, 255, 210] : [255, 210, 60];
              rect(g, c, snap3(582 + rnd() * 44), snap3(286 + rnd() * 56), 4, 4);
            }
            const r2 = seeded(Math.floor(t * 9) + 99);
            if (r2() < 0.5) rect(g, [255, 230, 80], snap3(318 + r2() * 24), snap3(388 + r2() * 8), 4, 4);
            if (blink) sprite(g, WARN, 540, 238, 4);
          } else {
            smokePuffs(g, 600, 300, done);
          }
          arrow('L', cx - 14, 258);
          break;
        }

        case 'STOVE': {
          hint = 'ARRASTRA LA PERILLA HASTA APAGADO';
          const k = done >= 0 ? 1 : clamp01((this.switchX - 340) / 195);
          block(g, 310, 278, 280, 92, [235, 235, 240]);
          rect(g, [60, 62, 72], 336, 298, 228, 50); // ventana del horno
          rect(g, [96, 100, 116], 342, 304, 216, 6);
          rect(g, [200, 200, 210], 350, 356, 200, 6); // jaladera
          block(g, 300, 260, 300, 20, [70, 72, 84]); // cubierta
          for (const bx of [380, 520]) {
            rect(g, [40, 40, 48], bx - 40, 254, 80, 8);
            const rows = Math.round(6 * (1 - k));
            for (let i = -1; i <= 1; i++) pixelFlame(g, bx + i * 22, 256, rows, 3, t, bx + i * 3, FLAME_GAS);
            if (done >= 0) smokePuffs(g, bx, 240, done);
          }
          this.drawSlider(k, t);
          break;
        }

        case 'BOILER': {
          hint = 'ARRASTRA LA PERILLA HASTA APAGADO';
          const k = done >= 0 ? 1 : clamp01((this.switchX - 340) / 195);
          rect(g, [200, 70, 60], 420, 223, 10, 12); // tubos
          rect(g, [70, 120, 220], 470, 223, 10, 12);
          block(g, 395, 232, 110, 136, [235, 235, 240]);
          rect(g, [200, 205, 215], 398, 256, 104, 4);
          rect(g, [200, 205, 215], 398, 314, 104, 4);
          // manómetro
          block(g, 428, 262, 44, 44, [255, 255, 255]);
          rect(g, [230, 80, 70], 458, 268, 8, 6);
          const ang = Math.PI * 0.85 + (1 - k) * (1.3 + Math.sin(t * 13) * 0.12) * Math.PI * 0.55;
          g.strokeStyle = 'rgb(200,40,40)';
          g.lineWidth = 3;
          g.beginPath();
          g.moveTo(450, 284);
          g.lineTo(450 + Math.cos(ang) * 15, 284 + Math.sin(ang) * 15);
          g.stroke();
          rect(g, OUTLINE, 447, 281, 6, 6);
          // ventanita con la flama
          rect(g, OUTLINE, 424, 326, 52, 36);
          rect(g, [20, 18, 26], 427, 329, 46, 30);
          const rows = Math.round(6 * (1 - k));
          for (let i = -1; i <= 1; i++) pixelFlame(g, 450 + i * 12, 359, rows, 3, t, i * 5, FLAME_GAS);
          if (done >= 0) smokePuffs(g, 450, 220, done);
          this.drawSlider(k, t);
          break;
        }

        case 'DETECTOR': {
          hint = 'HAZ CLIC EN EL DETECTOR PARA PROBARLO';
          rect(g, [200, 190, 170], 179, 223, 542, 14); // techo
          rect(g, OUTLINE, 179, 237, 542, 3);
          if (done >= 0) {
            g.lineWidth = 6;
            for (let i = 0; i < 3; i++) {
              const r = ((done * 140 + i * 45) % 135) + 55;
              const a = 1 - (r - 55) / 135;
              g.strokeStyle = `rgba(255,220,80,${a.toFixed(2)})`;
              g.beginPath();
              g.arc(450, 290, r, 0.1, Math.PI - 0.1);
              g.stroke();
            }
          }
          const wob = done >= 0 ? Math.round(Math.sin(done * 40) * 2) : 0;
          sprite(g, DETECTOR, 402 + wob, 242, 12);
          const led = done >= 0 ? [80, 255, 120] : (Math.floor(t * 2) % 2 ? [255, 60, 60] : [120, 30, 30]);
          rect(g, led, 462 + wob, 254, 12, 12);
          if (done >= 0) {
            g.font = font(22);
            g.fillStyle = '#ff0';
            if (Math.floor(done * 6) % 2 === 0) g.fillText('\u00a1BIP!', 230, 340);
            else g.fillText('\u00a1BIP!', 600, 340);
          } else {
            // humito que se acerca
            for (let i = 0; i < 3; i++) {
              const ph = (t * 0.35 + i / 3) % 1;
              rectA(g, `rgba(170,170,180,${(0.45 * (1 - ph)).toFixed(2)})`,
                snap3(300 + i * 110 + Math.sin(t * 2 + i) * 15), snap3(430 - ph * 70), 18, 18);
            }
          }
          arrow('U', 436, 362);
          break;
        }

        case 'GAS': {
          hint = 'HAZ CLIC EN EL BOTE PARA PONERLO DE PIE';
          rect(g, [70, 60, 55], 179, 400, 542, 43); // piso
          rect(g, OUTLINE, 179, 400, 542, 3);
          const ang = done >= 0
            ? -Math.PI / 2 * (1 - easeOutBack(clamp01(done / 0.6)))
            : -Math.PI / 2 + Math.sin(t * 3) * 0.03;
          const spill = done >= 0 ? clamp01(1 - done / 0.6) : 1;
          if (spill > 0) {
            rectA(g, `rgba(150,120,40,${(0.85 * spill).toFixed(2)})`, 262, 398, 96, 8);
            rectA(g, `rgba(220,200,120,${(0.6 * spill).toFixed(2)})`, 276, 398, 30, 3);
          }
          if (done < 0) {
            rect(g, [210, 180, 70], 306, snap3(318 + ((t * 120) % 78)), 6, 8); // gota
            for (let i = 0; i < 3; i++) {
              for (let j = 0; j < 5; j++) {
                const y = 386 - j * 11 - ((t * 30) % 11);
                rectA(g, 'rgba(200,220,150,0.45)', snap3(282 + i * 22 + Math.sin(t * 5 + j + i) * 4), snap3(y), 4, 6);
              }
            }
          }
          g.save();
          g.translate(440, 400);
          g.rotate(ang);
          rect(g, OUTLINE, 10, -142, 52, 25); // asa
          rect(g, [210, 40, 40], 13, -139, 46, 19);
          rect(g, [28, 31, 42], 23, -133, 26, 10);
          block(g, 70, -144, 20, 28, [240, 200, 60]); // boquilla
          block(g, 0, -120, 100, 120, [210, 40, 40]);
          rect(g, [250, 240, 230], 14, -82, 72, 30);
          g.fillStyle = css(OUTLINE);
          g.font = font(18);
          g.fillText('GAS', 33, -60);
          g.restore();
          arrow('U', 362, 328);
          break;
        }

        case 'BBQ': {
          hint = 'TOMA LA TAPA Y B\u00c1JALA PARA CERRAR EL ASADOR';
          const by = Math.round(this.bbqY);
          const k = done >= 0 ? 1 : clamp01((by - 248) / 52);
          rect(g, [90, 90, 100], 362, 400, 10, 40); // patas
          rect(g, [90, 90, 100], 528, 400, 10, 40);
          block(g, 352, 428, 28, 14, [40, 40, 48]);
          block(g, 340, 340, 220, 64, [50, 50, 58]);
          rect(g, [30, 28, 32], 352, 342, 196, 10); // carbón
          for (let i = 0; i < 10; i++) {
            const c = (Math.floor(t * 6) + i) % 3 ? [220, 60, 30] : [255, 150, 40];
            rect(g, c, 358 + i * 19, 344, 10, 6);
          }
          const gap = 340 - (by + 60);
          if (done < 0 && gap > 0) {
            const rows = Math.round(Math.min(8, gap / 5));
            for (let i = 0; i < 5; i++) pixelFlame(g, 372 + i * 39, 344, rows, 4, t, i * 1.7);
          }
          if (k < 1) {
            for (let i = 0; i < 5; i++) {
              const ph = (t * 0.8 + i / 5) % 1;
              rectA(g, `rgba(150,150,160,${((1 - ph) * 0.5 * (1 - k)).toFixed(2)})`,
                snap3(360 + i * 42 + Math.sin(t * 3 + i) * 8), snap3(by + 40 - ph * 80), 15, 15);
            }
          }
          rect(g, [90, 90, 100], 336, 336, 228, 8); // borde
          // tapa
          block(g, 380, by, 140, 16, [70, 70, 82]);
          block(g, 356, by + 12, 188, 18, [64, 64, 76]);
          block(g, 340, by + 26, 220, 34, [58, 58, 70]);
          rect(g, [110, 110, 125], 372, by + 18, 30, 4);
          block(g, 418, by - 16, 64, 18, [205, 205, 215]); // manija
          if (done >= 0) smokePuffs(g, 450, by + 10, done);
          arrow('D', 500, by - 46);
          break;
        }

        default: break;
      }
      g.restore();

      if (done >= 0) {
        this.waveText('\u00a1LISTO!', 474, 26, done, () => '#7f9', 4);
      } else {
        g.fillStyle = '#fff';
        g.font = font(15);
        ctext(g, hint, 470);
      }

      g.fillStyle = '#ccc';
      g.font = font(14, false);
      ctext(g, 'ESC = Salir de la actividad', 502);
    }

    // Perilla deslizable (estufa y calentador). k = 0 encendido, 1 apagado
    drawSlider(k, t) {
      const g = this.ctx;
      const x = Math.round(this.switchX);
      block(g, 330, 389, 252, 16, [50, 52, 62]);
      rect(g, [80, 200, 100], 336, 394, Math.max(0, x - 336), 6);
      const col = [220, 60, 50].map((v, i) => Math.round(v + ([80, 200, 100][i] - v) * k));
      block(g, x - 15, 378, 45, 38, col);
      rect(g, OUTLINE, x + 5, 384, 5, 26);
      g.font = font(14);
      g.fillStyle = k < 1 ? '#f88' : '#888';
      g.fillText('ENCENDIDO', 300, 437);
      g.fillStyle = k >= 1 ? '#8f8' : '#888';
      g.fillText('APAGADO', 526, 437);
      if (!this.taskDone && !this.dragging && Math.floor(t * 3) % 2 === 0 && k === 0) {
        spriteColor(g, arrowFor('R'), x + 38, 383, 4, [255, 230, 80]);
      }
    }

    draw() {
      const g = this.ctx;
      g.imageSmoothingEnabled = false;
      g.textBaseline = 'alphabetic';
      g.textAlign = 'left';

      // al perder, la pantalla tiembla un momento
      const endT = this.endStart ? (Date.now() - this.endStart) / 1000 : 99;
      const shaking = this.gameOver && endT < 0.8;
      if (shaking) {
        const k = 12 * (1 - endT / 0.8);
        g.save();
        rect(g, OUTLINE, 0, 0, W, H);
        g.translate(Math.round((Math.random() - 0.5) * k), Math.round((Math.random() - 0.5) * k));
      }

      // fondo del cuarto (piso, paredes, muebles)
      g.drawImage(Art.roomImage(this.currentRoom), 0, 0);
      Art.drawExits(g, this.currentRoom);

      for (const task of this.tasks) {
        if (task.room === this.currentRoom) {
          const near = !task.completed
            && Math.hypot(this.player.x - task.x, this.player.y - task.y) < 65;
          Art.drawTask(g, task, near);
        }
      }

      // al ganar, el personaje brinca de gusto
      const hop = this.gameWon && this.endStart && !this.showingMessage
        ? Math.round((Math.abs(Math.sin(endT * 6)) * 18) / 3) * 3 : 0;
      this.player.draw(g, hop);

      // HUD
      Art.panel(g, 14, 8, 270, 54);
      Art.panel(g, 688, 8, 192, 88);
      Art.panel(g, 14, 478, 340, 86);

      g.fillStyle = '#fff';
      g.font = font(25);
      g.fillText(this.currentRoom, 30, 43);

      const completed = this.tasks.filter((t) => t.completed).length;
      g.font = font(18);
      g.fillText(`Tareas: ${completed}/${this.tasks.length}`, 700, 40);

      const minutes = Math.floor(this.timeLeft / 60);
      const seconds = this.timeLeft % 60;
      const time = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      g.fillStyle = this.timeLeft <= 60 ? '#f00' : '#fff';
      g.font = font(21);
      g.fillText(`TIEMPO: ${time}`, 700, 80);

      g.fillStyle = '#fff';
      g.font = font(16, false);
      g.fillText('WASD = Mover | E = Interactuar', 30, 550);
      g.fillText(this.message, 30, 500);

      if (this.showingTask && this.activeTask) this.drawTaskInterface();

      if (this.showingMessage) {
        rectA(g, 'rgba(0,0,0,0.84)', 0, 0, W, H);
        Art.panel(g, 140, 150, 620, 330, [38, 43, 55]);

        g.fillStyle = '#0f0';
        g.font = font(30);
        ctext(g, '\u00a1MISI\u00d3N COMPLETADA!', 200);

        g.fillStyle = '#fff';
        g.font = font(22);
        ctext(g, this.educationalTitle, 260);

        g.font = font(17, false);
        this.drawWrappedText(this.educationalMessage, 170, 320, 560, 25);

        const secondsLeft = 5 - Math.floor((Date.now() - this.messageStartTime) / 1000);
        g.fillStyle = '#ff0';
        g.font = font(20);
        ctext(g, `Continuando en ${Math.max(0, secondsLeft)}...`, 420);

        g.fillStyle = '#fff';
        g.font = font(15, false);
        ctext(g, 'ESPACIO = Saltar mensaje', 460);
      }

      if (this.endStart && this.gameWon && !this.showingMessage && !this.showingTask) this.drawVictory();
      if (this.endStart && this.gameOver) this.drawDefeat();

      if (shaking) g.restore();
    }

    // ----- teclado -----

    keyDown(code) {
      const p = this.player;

      if (this.showingTask) {
        if (code === 'Escape' && this.taskDone) {
          this.completeTask();
        } else if (code === 'Escape') {
          this.showingTask = false;
          this.activeTask = null;
          this.dragging = false;
          this.lastTime = Date.now();
        }
        return;
      }

      if (this.showingMessage && code === 'Space') {
        this.showingMessage = false;
        this.lastTime = Date.now();
        return;
      }

      if ((this.gameWon || this.gameOver) && !this.showingMessage && code === 'KeyR') {
        this.reset();
        return;
      }

      if (this.gameWon || this.gameOver || this.showingMessage) return;

      if (code === 'KeyW' || code === 'ArrowUp') p.up = true;
      if (code === 'KeyS' || code === 'ArrowDown') p.down = true;
      if (code === 'KeyA' || code === 'ArrowLeft') p.left = true;
      if (code === 'KeyD' || code === 'ArrowRight') p.right = true;
      if (code === 'KeyE') this.interact();
    }

    keyUp(code) {
      const p = this.player;
      if (code === 'KeyW' || code === 'ArrowUp') p.up = false;
      if (code === 'KeyS' || code === 'ArrowDown') p.down = false;
      if (code === 'KeyA' || code === 'ArrowLeft') p.left = false;
      if (code === 'KeyD' || code === 'ArrowRight') p.right = false;
    }

    // ----- mouse / touch (coordenadas del canvas 900x600) -----

    pointerDown(x, y) {
      if (!this.showingTask || !this.activeTask || this.taskDone) return;

      this.mouseX = x;
      this.mouseY = y;

      switch (this.taskType) {
        case 'CANDLE':
          if (x >= 405 && x <= 495 && y >= 230 && y <= 335) this.finishTask();
          break;
        case 'CABLE':
          if (x >= this.cableX - 25 && x <= this.cableX + 34 && y >= 292 && y <= 345) this.dragging = true;
          break;
        case 'STOVE':
        case 'BOILER':
          if (x >= this.switchX - 22 && x <= this.switchX + 37 && y >= 370 && y <= 422) this.dragging = true;
          break;
        case 'DETECTOR':
          if (x >= 395 && x <= 505 && y >= 236 && y <= 342) this.finishTask();
          break;
        case 'GAS':
          if (x >= 290 && x <= 560 && y >= 250 && y <= 405) this.finishTask();
          break;
        case 'BBQ':
          if (x >= 340 && x <= 560 && y >= this.bbqY - 20 && y <= this.bbqY + 60) {
            this.dragging = true;
            this.grabDY = y - this.bbqY;
          }
          break;
        default: break;
      }
    }

    pointerMove(x, y) {
      if (!this.showingTask || !this.dragging || this.taskDone) return;

      this.mouseX = x;
      this.mouseY = y;

      if (this.taskType === 'CABLE') {
        this.cableX = Math.max(350, Math.min(570, x));
        if (this.cableX <= 400) this.finishTask();
      } else if (this.taskType === 'STOVE' || this.taskType === 'BOILER') {
        this.switchX = Math.max(340, Math.min(560, x));
        if (this.switchX >= 535) { this.switchX = 560; this.finishTask(); }
      } else if (this.taskType === 'BBQ') {
        this.bbqY = Math.max(248, Math.min(300, y - this.grabDY));
        if (this.bbqY >= 296) { this.bbqY = 300; this.finishTask(); }
      }
    }

    pointerUp() {
      this.dragging = false;

      if (this.showingTask && !this.taskDone) {
        if (this.taskType === 'CABLE' && this.cableX > 400) this.cableX = 570;
        if ((this.taskType === 'STOVE' || this.taskType === 'BOILER') && this.switchX < 535) this.switchX = 340;
        if (this.taskType === 'BBQ' && this.bbqY < 296) this.bbqY = 248;
      }
    }

    // La actividad se logró: se muestra la animación de "¡LISTO!" y luego el consejo
    finishTask() {
      if (this.taskDone) return;
      this.taskDone = Date.now();
      this.dragging = false;
    }

  }

  // ------------------------------------------------------------
  // ARRANQUE
  // ------------------------------------------------------------

  function start() {
    let canvas = document.getElementById('juego');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'juego';
      document.body.appendChild(canvas);
    }
    canvas.width = W;
    canvas.height = H;

    const game = new Game(canvas);

    const GAME_KEYS = new Set([
      'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE',
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Escape', 'KeyR',
    ]);

    const typing = (el) => el && (
      el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' ||
      el.tagName === 'SELECT' || el.isContentEditable
    );

    window.addEventListener('keydown', (e) => {
      if (typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (!GAME_KEYS.has(e.code)) return;
      e.preventDefault();
      game.keyDown(e.code);
    });

    window.addEventListener('keyup', (e) => {
      if (!GAME_KEYS.has(e.code)) return;
      game.keyUp(e.code);
    });

    window.addEventListener('blur', () => game.player.stop());

    const toCanvas = (e) => {
      const r = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) * W) / r.width,
        y: ((e.clientY - r.top) * H) / r.height,
      };
    };

    canvas.addEventListener('pointerdown', (e) => {
      const p = toCanvas(e);
      if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
      game.pointerDown(p.x, p.y);
    });
    canvas.addEventListener('pointermove', (e) => {
      const p = toCanvas(e);
      game.pointerMove(p.x, p.y);
    });
    const release = () => game.pointerUp();
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);

    // bucle con paso fijo de ~16 ms (igual que el Timer de Java)
    const STEP = 16;
    let last = performance.now();
    let acc = 0;

    function frame(now) {
      acc += now - last;
      last = now;
      if (acc > 250) acc = 250;
      while (acc >= STEP) {
        game.update();
        acc -= STEP;
      }
      game.draw();
      requestAnimationFrame(frame);
    }

    game.lastTime = Date.now();
    requestAnimationFrame(frame);

    // para pruebas desde la consola
    window.juegoPrevencion = game;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();