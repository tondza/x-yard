/*
 * Mockup renderer — "Yard Board" direction, round 08.
 *
 * NOT the game. This is a design study: it reuses the real Cathedral Quarter map
 * and the real generated house layout, then re-draws them with the proposed
 * board grammar (short roof-first houses, paper streets with ink edges, numbered
 * station discs with a mode collar, thick keylined route ribbons, landmark
 * plaques). It exists to judge the look, not to ship.
 */
(() => {
  const MAP = window.__MAP__;
  const CITY = window.XYCITY;
  const NS = 'http://www.w3.org/2000/svg';

  const INK = '#2a2018';
  const PAPER = '#fdf9ec';
  const YARD = PAPER;
  const YARD_EDGE = 'rgba(42,32,24,.13)';
  const PARK = '#a9bd6d';
  const PARK_EDGE = 'rgba(42,32,24,.42)';
  const STREET = '#fffdf6';
  const STONE = '#e9d8b6';
  const STONE_2 = '#dcc7a1';
  const SLATE = '#70808a';
  const SLATE_2 = '#5d6c75';
  const COPPER = '#5f9b84';
  const OCHRE = '#c7954c';
  const TERRA = '#b85b3e';
  const GLASS = '#9cc4d4';
  const WATER = '#5c93ad';

  const OFF = MAP.bounds.height * 0.9;
  const VIEW = { x: 810, y: 305, w: 590, h: 821 / (1107 / 590) };
  const SCALE = 1107 / VIEW.w;

  const svg = document.getElementById('map-svg');
  const root = document.createElementNS(NS, 'g');
  svg.appendChild(root);

  /* ---------------------------------------------------------------- utils */

  function el(tag, attrs, parent) {
    const node = document.createElementNS(NS, tag);
    if (attrs) for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    (parent ?? root).appendChild(node);
    return node;
  }

  function proj(x, y, z = 0) {
    return { x: (x - y) * 0.9 + OFF, y: (x + y) * 0.5 - z };
  }

  function S(x, y, z = 0) {
    const p = proj(x, y, z);
    return { x: (p.x - VIEW.x) * SCALE, y: (p.y - VIEW.y) * SCALE };
  }

  function shade(hex, factor) {
    const n = parseInt(hex.slice(1), 16);
    const c = (v) => Math.max(0, Math.min(255, Math.round(v * factor)));
    return '#' + [c((n >> 16) & 255), c((n >> 8) & 255), c(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('');
  }

  function pathOf(points) {
    if (points.length === 0) return '';
    return 'M ' + points.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ');
  }

  function poly(parent, points, fill, stroke = INK, width = 1.45, opacity = 1) {
    const node = el('polygon', {
      points: points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
      fill,
      stroke,
      'stroke-width': width,
      'stroke-linejoin': 'round',
      opacity,
    }, parent);
    return node;
  }

  function line(parent, a, b, stroke = INK, width = 1.25, dash) {
    const node = el('line', {
      x1: a.x.toFixed(1), y1: a.y.toFixed(1), x2: b.x.toFixed(1), y2: b.y.toFixed(1),
      stroke, 'stroke-width': width, 'stroke-linecap': 'round',
    }, parent);
    if (dash) node.setAttribute('stroke-dasharray', dash);
    return node;
  }

  function circle(parent, cx, cy, r, fill, stroke = INK, width = 1.3) {
    return el('circle', { cx, cy, r, fill, stroke, 'stroke-width': width }, parent);
  }

  function text(parent, x, y, str, opts = {}) {
    const node = el('text', {
      x, y,
      'font-family': opts.family ?? "'Helvetica Neue', Helvetica, 'Liberation Sans', Arial, sans-serif",
      'font-size': opts.size ?? 10,
      'font-weight': opts.weight ?? 600,
      'letter-spacing': opts.ls ?? 1,
      'text-anchor': opts.anchor ?? 'start',
      fill: opts.fill ?? INK,
    }, parent);
    node.textContent = str;
    return node;
  }

  function viewBox(points, pad = 60) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return maxX > -pad && minX < 1107 + pad && maxY > -pad && minY < 821 + pad;
  }

  const measure = (() => {
    const ctx = document.createElement('canvas').getContext('2d');
    return (str, font) => { ctx.font = font; return ctx.measureText(str).width; };
  })();

  /* ------------------------------------------------------------- buildings */

  /*
   * The generated block has one or two wide houses per cell. The board reads as
   * terraces of small houses, so split each wide footprint into 2-3 units that
   * share a party wall. This is the mock's stand-in for the planned generator
   * change ("more, smaller houses per block"), not a game-data change.
   */
  const UNIT_ROOFS = ['clay', 'terracotta', 'ochre', 'clay', 'slate', 'terracotta'];

  function unitOf(b, i, overrides) {
    const hash = (b.hash + Math.imul(i + 1, 2246822519)) >>> 0;
    return {
      ...b,
      ...overrides,
      key: `${b.key}-${i}`,
      hash,
      // Adjacent houses in a terrace should not share a roof or a wall tint:
      // identical units read as one long building, not as a row of houses.
      wall: CITY.WALL_COLOURS[hash % CITY.WALL_COLOURS.length],
      material: UNIT_ROOFS[hash % UNIT_ROOFS.length],
      roof: b.roof === 'flat' ? 'flat' : 'gable',
    };
  }

  function splitHouse(b) {
    if (b.w >= 24) {
      const n = b.w >= 36 ? 3 : 2;
      const w = b.w / n;
      return Array.from({ length: n }, (_, i) => unitOf(b, i, { x: b.x + i * w, w, ridge: 'x' }));
    }
    if (b.h >= 36) {
      const n = b.h >= 52 ? 3 : 2;
      const h = b.h / n;
      return Array.from({ length: n }, (_, i) => unitOf(b, i, { y: b.y + i * h, h, ridge: 'y' }));
    }
    return [b];
  }

  const buildings = CITY.buildingsForMap(MAP).flatMap(splitHouse).sort((a, b) => (a.x + a.y) - (b.x + b.y));
  const trees = CITY.treesForMap(MAP);

  function isHouseVisible(b) {
    return viewBox([
      S(b.x, b.y, 0), S(b.x + b.w, b.y, 0), S(b.x, b.y + b.h, 0),
      S(b.x + b.w, b.y + b.h, 0), S(b.x, b.y, 34), S(b.x + b.w, b.y + b.h, 34),
    ], 30);
  }

  function gableRoof(g, b, x0, y0, x1, y1, z, rise, colour) {
    const inset = b.roof === 'hip' ? (x1 - x0) * 0.3 : 0;
    if (b.ridge === 'y') {
      const rx = (x0 + x1) / 2;
      const ridgeA = { x: rx, y: y0, z: z + rise };
      const ridgeB = { x: rx, y: y1, z: z + rise };
      poly(g, [S(x1, y0, z), S(x1, y1, z), S(ridgeB.x, ridgeB.y, ridgeB.z), S(ridgeA.x, ridgeA.y, ridgeA.z)], colour);
      line(g, S(ridgeA.x, ridgeA.y, ridgeA.z), S(ridgeB.x, ridgeB.y, ridgeB.z), INK, 1.35);
      poly(g, [S(x0, y1, z), S(x1, y1, z), S(rx, y1, z + rise)], shade(b.wall, 0.8));
      return;
    }
    const ry = (y0 + y1) / 2;
    const left = x0 + inset;
    const right = x1 - inset;
    poly(g, [S(x0, y1, z), S(x1, y1, z), S(right, ry, z + rise), S(left, ry, z + rise)], colour);
    line(g, S(left, ry, z + rise), S(right, ry, z + rise), INK, 1.35);
    if (inset > 0) {
      poly(g, [S(x1, y0, z), S(x1, y1, z), S(right, ry, z + rise)], shade(colour, 0.9));
    } else {
      poly(g, [S(x1, y0, z), S(x1, y1, z), S(right, ry, z + rise)], shade(b.wall, 0.8));
    }
  }

  function chimney(g, b, x0, y0, x1, y1, z, rise) {
    const cx = x0 + (x1 - x0) * 0.72;
    const cy = (y0 + y1) / 2;
    const top = z + rise + 2.6;
    poly(g, [S(cx - 1.1, cy + 1.1, top - 3.2), S(cx + 1.1, cy + 1.1, top - 3.2), S(cx + 1.1, cy + 1.1, top), S(cx - 1.1, cy + 1.1, top)], shade(b.wall, 0.85), INK, 0.9);
    poly(g, [S(cx - 1.1, cy + 1.1, top), S(cx + 1.1, cy + 1.1, top), S(cx + 1.1, cy - 1.1, top), S(cx - 1.1, cy - 1.1, top)], '#6b5a45', INK, 0.9);
  }

  function drawHouse(g, b) {
    if (!isHouseVisible(b)) return;
    const x0 = b.x, y0 = b.y, x1 = b.x + b.w, y1 = b.y + b.h;
    const roofStyle = CITY.ROOF_STYLES[b.material] ?? CITY.ROOF_STYLES.clay;
    const roofColour = roofStyle.roof;
    const z = Math.min(13.5, 6.6 + (b.hash % 4) * 1.35 + b.lift * 0.13);
    const rise = Math.min(8, Math.max(3.2, Math.min(b.w, b.h) * 0.34));

    // Two visible faces: the south wall catches the light, the east wall is shaded.
    poly(g, [S(x0, y1, 0), S(x1, y1, 0), S(x1, y1, z), S(x0, y1, z)], b.wall);
    poly(g, [S(x1, y0, 0), S(x1, y1, 0), S(x1, y1, z), S(x1, y0, z)], shade(b.wall, 0.84));

    // Two small window marks, not a façade drawing.
    const count = b.w > 26 ? 2 : 1;
    for (let i = 0; i < count; i += 1) {
      const u = 0.24 + i * 0.36;
      const ww = 0.12;
      const v0 = 0.28, v1 = 0.62;
      poly(g, [
        S(x0 + u * b.w, y1, z * v0), S(x0 + (u + ww) * b.w, y1, z * v0),
        S(x0 + (u + ww) * b.w, y1, z * v1), S(x0 + u * b.w, y1, z * v1),
      ], '#5d4b39', INK, 0.45);
    }

    if (b.roof === 'flat') {
      poly(g, [S(x0, y0, z), S(x1, y0, z), S(x1, y1, z), S(x0, y1, z)], roofColour);
      poly(g, [S(x0 + 1, y0 + 1, z), S(x1 - 1, y0 + 1, z), S(x1 - 1, y1 - 1, z), S(x0 + 1, y1 - 1, z)], shade(roofColour, 1.06), INK, 0.6);
    } else {
      gableRoof(g, b, x0, y0, x1, y1, z, rise, roofColour);
    }

    if (b.chimneyPots > 0 && b.hash % 3 === 0) chimney(g, b, x0, y0, x1, y1, z, rise);
  }

  function drawTree(g, t) {
    const base = S(t.x, t.y, 0);
    const top = S(t.x, t.y, t.r * 1.5);
    if (base.x < -30 || base.x > 1137) return;
    line(g, base, { x: top.x, y: top.y + t.r * 0.4 }, '#6d5638', 1.4);
    circle(g, top.x, top.y, t.r * SCALE * 0.92, '#7f9a4e', INK, 1.1);
    circle(g, top.x - t.r * SCALE * 0.28, top.y - t.r * SCALE * 0.22, t.r * SCALE * 0.5, '#96ad61', 'none', 0);
  }

  /* ------------------------------------------------------------- landmarks */

  function prism(g, x0, y0, x1, y1, z0, z1, wall, top, drawTop = true) {
    poly(g, [S(x0, y1, z0), S(x1, y1, z0), S(x1, y1, z1), S(x0, y1, z1)], wall, INK, 1.35);
    poly(g, [S(x1, y0, z0), S(x1, y1, z0), S(x1, y1, z1), S(x1, y0, z1)], shade(wall, 0.82), INK, 1.35);
    if (drawTop) poly(g, [S(x0, y0, z1), S(x1, y0, z1), S(x1, y1, z1), S(x0, y1, z1)], top, INK, 1.35);
  }

  function roofGable(g, x0, y0, x1, y1, z, rise, colour) {
    const ry = (y0 + y1) / 2;
    poly(g, [S(x0, y1, z), S(x1, y1, z), S(x1, ry, z + rise), S(x0, ry, z + rise)], colour, INK, 1.35);
    line(g, S(x0, ry, z + rise), S(x1, ry, z + rise), INK, 1.5);
    poly(g, [S(x1, y0, z), S(x1, y1, z), S(x1, ry, z + rise)], shade(colour, 0.9), INK, 1.35);
  }

  function spire(g, x0, y0, x1, y1, z, height, colour) {
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    poly(g, [S(x0, y1, z), S(x1, y1, z), S(cx, cy, z + height)], colour, INK, 1.3);
    poly(g, [S(x1, y0, z), S(x1, y1, z), S(cx, cy, z + height)], shade(colour, 0.8), INK, 1.3);
    line(g, S(cx, cy, z + height), S(cx, cy, z + height + 4), INK, 1.4);
    line(g, S(cx - 2, cy, z + height + 2.5), S(cx + 2, cy, z + height + 2.5), INK, 1.2);
  }

  function columns(g, x0, y0, x1, y1, z, count, wall) {
    for (let i = 0; i < count; i += 1) {
      const t0 = x0 + ((x1 - x0) * i) / count;
      const t1 = t0 + (x1 - x0) / count * 0.52;
      prism(g, t0, y1, t1, y1 + 2.2, 0, z, wall, wall);
    }
  }

  function drawCathedral(g, x, y) {
    poly(g, [S(x - 30, y - 16), S(x + 30, y - 16), S(x + 30, y + 16), S(x - 30, y + 16)], '#f3e6c9', 'rgba(42,32,24,.4)', 1);
    prism(g, x - 25, y - 9, x + 13, y + 9, 0, 11, STONE, SLATE);
    roofGable(g, x - 25, y - 9, x + 13, y + 9, 11, 12, SLATE);
    prism(g, x + 13, y - 8, x + 26, y + 8, 0, 28, STONE, SLATE);
    spire(g, x + 13, y - 8, x + 26, y + 8, 28, 17, COPPER);
    circle(g, S(x - 7, y + 9, 6.5).x, S(x - 7, y + 9, 6.5).y, 4, '#f8efd9', INK, 1.2);
    for (const dx of [-21, -12, -3, 6]) prism(g, x + dx - 1.2, y + 8, x + dx + 1.2, y + 10.6, 0, 7, STONE_2, STONE_2);
  }

  function drawStation(g, x, y) {
    prism(g, x - 28, y - 10, x + 8, y + 10, 0, 9, STONE, SLATE);
    roofGable(g, x - 28, y - 10, x + 8, y + 10, 9, 7, SLATE);
    prism(g, x + 8, y - 6, x + 20, y + 6, 0, 25, STONE, SLATE);
    roofGable(g, x + 8, y - 6, x + 20, y + 6, 25, 6, SLATE);
    circle(g, S(x + 14, y + 6, 17).x, S(x + 14, y + 6, 17).y, 3.3, '#f8efd9', INK, 1.2);
    line(g, S(x + 14, y + 6, 17), S(x + 14, y + 6, 19), INK, 1);
    for (const dx of [-22, -15, -8, -1]) prism(g, x + dx, y + 10, x + dx + 5, y + 12.4, 0, 4, STONE_2, shade(STONE_2, 0.9));
  }

  function drawMarket(g, x, y) {
    prism(g, x - 18, y - 8, x + 12, y + 8, 0, 8, STONE, OCHRE);
    roofGable(g, x - 18, y - 8, x + 12, y + 8, 8, 8, OCHRE);
    prism(g, x - 3, y - 3, x + 2, y + 2, 8, 14, STONE, SLATE);
    spire(g, x - 3, y - 3, x + 2, y + 2, 14, 5, SLATE);
    for (const dx of [-15, -4, 7]) {
      prism(g, x + dx, y + 11, x + dx + 6, y + 15, 0, 3.4, '#d8b98a', TERRA);
    }
  }

  function drawSquare(g, x, y) {
    poly(g, [S(x - 19, y - 13), S(x + 19, y - 13), S(x + 19, y + 13), S(x - 19, y + 13)], '#f0e2c3', 'rgba(42,32,24,.45)', 1);
    const c = S(x - 8, y + 2, 0);
    circle(g, c.x, c.y, 5.4, WATER, INK, 1.2);
    circle(g, c.x, c.y, 2.4, '#e9f3f1', 'none', 0);
    prism(g, x - 1.6, y - 1.6, x + 1.6, y + 1.6, 0, 19, STONE, STONE);
    spire(g, x - 1.6, y - 1.6, x + 1.6, y + 1.6, 19, 5.5, STONE);
    for (const [dx, dy] of [[-13, -7], [11, -5], [12, 8]]) {
      const b = S(x + dx, y + dy, 0);
      circle(g, b.x, b.y - 4, 3.2, '#7f9a4e', INK, 1);
    }
  }

  function drawMuseum(g, x, y) {
    prism(g, x - 18, y - 8, x + 18, y + 8, 0, 12, STONE, SLATE);
    columns(g, x - 13, y + 8, x + 13, y + 10.5, 10, 5, STONE);
    poly(g, [S(x - 15, y + 10.5, 12), S(x + 15, y + 10.5, 12), S(x, y + 10.5, 18)], SLATE_2, INK, 1.3);
    prism(g, x - 7, y - 4, x + 7, y + 4, 12, 18, STONE, COPPER);
    const d = S(x, y, 18);
    el('ellipse', { cx: d.x, cy: d.y, rx: 7 * SCALE * 0.9, ry: 7 * SCALE * 0.42, fill: shade(COPPER, 1.06), stroke: INK, 'stroke-width': 1.3 }, g);
  }

  function drawTownHall(g, x, y) {
    prism(g, x - 16, y - 8, x + 16, y + 8, 0, 13, STONE, SLATE);
    columns(g, x - 12, y + 8, x + 12, y + 10.5, 11, 5, STONE);
    poly(g, [S(x - 14, y + 10.5, 13), S(x + 14, y + 10.5, 13), S(x, y + 10.5, 18)], SLATE_2, INK, 1.3);
    prism(g, x - 4, y - 4, x + 4, y + 4, 13, 29, STONE, SLATE);
    roofGable(g, x - 4, y - 4, x + 4, y + 4, 29, 7, SLATE);
    circle(g, S(x, y + 4, 23).x, S(x, y + 4, 23).y, 2.6, '#f8efd9', INK, 1.1);
  }

  function drawChurch(g, x, y) {
    prism(g, x - 12, y - 6, x + 8, y + 6, 0, 8, STONE, SLATE);
    roofGable(g, x - 12, y - 6, x + 8, y + 6, 8, 6, SLATE);
    prism(g, x + 8, y - 4, x + 16, y + 4, 0, 20, STONE, SLATE);
    spire(g, x + 8, y - 4, x + 16, y + 4, 20, 12, SLATE_2);
  }

  function drawUniversity(g, x, y) {
    prism(g, x - 18, y - 10, x + 18, y + 10, 0, 10, STONE, SLATE);
    prism(g, x - 4, y - 4, x + 4, y + 4, 10, 24, STONE, SLATE);
    roofGable(g, x - 4, y - 4, x + 4, y + 4, 24, 6, SLATE);
    poly(g, [S(x - 18, y, 0), S(x + 18, y, 0), S(x + 18, y - 10, 0), S(x - 18, y - 10, 0)], '#d8c8a4', 'rgba(42,32,24,.35)', 1);
  }

  function drawTheatre(g, x, y) {
    prism(g, x - 14, y - 7, x + 14, y + 7, 0, 12, STONE, OCHRE);
    columns(g, x - 10, y + 7, x + 10, y + 9, 10, 4, STONE);
    poly(g, [S(x - 12, y + 9, 12), S(x + 12, y + 9, 12), S(x, y + 9, 17)], TERRA, INK, 1.3);
    circle(g, S(x, y + 7, 6).x, S(x, y + 7, 6).y, 2.6, '#6b4a3a', INK, 1);
  }

  function drawHospital(g, x, y) {
    prism(g, x - 18, y - 6, x - 2, y + 8, 0, 10, STONE, SLATE);
    prism(g, x - 2, y - 8, x + 18, y + 8, 0, 12, STONE, SLATE);
    prism(g, x - 18, y + 8, x - 2, y + 12, 0, 7, STONE, SLATE);
    roofGable(g, x - 2, y - 8, x + 18, y + 8, 12, 5, SLATE);
  }

  function drawGasworks(g, x, y) {
    prism(g, x - 14, y - 6, x - 6, y + 6, 0, 18, STONE_2, SLATE_2);
    prism(g, x + 2, y - 6, x + 10, y + 6, 0, 15, STONE_2, SLATE_2);
    const c = S(x + 14, y + 10, 0);
    circle(g, c.x, c.y, 6, '#b9a98d', INK, 1.2);
    circle(g, c.x, c.y - 5, 6, '#cdbfa5', INK, 1.2);
  }

  function drawSportsGround(g, x, y) {
    const c = S(x, y, 0);
    el('ellipse', { cx: c.x, cy: c.y, rx: 17 * SCALE * 0.9, ry: 17 * SCALE * 0.5, fill: '#c9b98f', stroke: INK, 'stroke-width': 1.2 }, g);
    el('ellipse', { cx: c.x, cy: c.y, rx: 11 * SCALE * 0.9, ry: 11 * SCALE * 0.5, fill: '#a9bd6d', stroke: INK, 'stroke-width': 1 }, g);
  }

  function drawGardens(g, x, y) {
    const c = S(x, y, 0);
    el('ellipse', { cx: c.x, cy: c.y, rx: 16 * SCALE * 0.9, ry: 16 * SCALE * 0.5, fill: PARK, stroke: PARK_EDGE, 'stroke-width': 1.2 }, g);
    prism(g, x - 3, y - 2, x + 3, y + 2, 0, 6, '#efe3c4', COPPER);
    spire(g, x - 3, y - 2, x + 3, y + 2, 6, 3.5, SLATE);
  }

  function drawCivicHall(g, x, y) {
    prism(g, x - 14, y - 7, x + 14, y + 7, 0, 11, STONE, SLATE);
    roofGable(g, x - 14, y - 7, x + 14, y + 7, 11, 7, SLATE);
  }

  function drawLandmark(g, l) {
    const x = l.at.x, y = l.at.y;
    switch (l.kind) {
      case 'cathedral': return drawCathedral(g, x, y);
      case 'station': return drawStation(g, x, y);
      case 'market': return drawMarket(g, x, y);
      case 'square': return drawSquare(g, x, y);
      case 'museum': return drawMuseum(g, x, y);
      case 'townHall': return drawTownHall(g, x, y);
      case 'church': return drawChurch(g, x, y);
      case 'university': return drawUniversity(g, x, y);
      case 'theatre': return drawTheatre(g, x, y);
      case 'hospital': return drawHospital(g, x, y);
      case 'gasworks': return drawGasworks(g, x, y);
      case 'sportsGround': return drawSportsGround(g, x, y);
      case 'gardens': return drawGardens(g, x, y);
      default: return drawCivicHall(g, x, y);
    }
  }

  const LABEL_Z = {
    cathedral: 52, station: 38, market: 26, square: 26, museum: 30, townHall: 37,
    church: 34, university: 30, theatre: 24, hospital: 20, gasworks: 26,
    sportsGround: 12, gardens: 14,
  };

  function plaque(g, x, y, label) {
    const str = label.toUpperCase();
    const font = '700 10px "Helvetica Neue", Helvetica, Arial, sans-serif';
    const w = measure(str, font) + str.length * 1.35 + 18;
    const h = 19;
    const left = Math.max(10, Math.min(1097 - w, x - w / 2));
    const top = Math.max(10, Math.min(800 - h, y - h));
    el('rect', { x: left, y: top, width: w, height: h, fill: '#fbf3df', stroke: INK, 'stroke-width': 1.3, rx: 1.5 }, g);
    text(g, left + w / 2, top + 13, str, { size: 10, weight: 700, anchor: 'middle', ls: 1.35 });
  }

  /* ---------------------------------------------------------------- plate */

  // paper
  el('rect', { x: 0, y: 0, width: 1107, height: 821, fill: PAPER }, root);

  // A very quiet paper tint outside the built area keeps the plate reading as
  // one sheet rather than a cut-out.
  const parkBlocks = MAP.city.blocks.filter((b) => b.kind === 'park');
  for (const block of MAP.city.blocks) {
    const pts = block.polygon.map((p) => S(p.x, p.y, 0));
    if (!viewBox(pts, 40)) continue;
    poly(root, pts, block.kind === 'park' ? PARK : YARD, block.kind === 'park' ? PARK_EDGE : YARD_EDGE, 1.0);
  }

  // Streets: two ink edges and a paper carriageway, no centre line.
  const STREET_W = [14, 18, 23];
  for (const street of MAP.city.streets) {
    const base = street.rank === 0 ? STREET_W[0] : street.rank === 1 ? STREET_W[1] : STREET_W[2];
    const pts = street.path.map((p) => {
      const q = proj(p.x, p.y);
      return { x: (q.x - VIEW.x) * SCALE, y: (q.y - VIEW.y) * SCALE };
    });
    if (!viewBox(pts, 40)) continue;
    const d = pathOf(pts);
    el('path', { d, fill: 'none', stroke: INK, 'stroke-width': base + 4.0, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, root);
    el('path', { d, fill: 'none', stroke: STREET, 'stroke-width': base, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, root);
  }

  // Houses.
  const houses = el('g', {}, root);
  for (const building of buildings) drawHouse(houses, building);

  // Trees.
  const treeLayer = el('g', {}, root);
  for (const tree of trees) drawTree(treeLayer, tree);

  // Landmarks, back to front.
  const landmarkLayer = el('g', {}, root);
  const visibleLandmarks = MAP.city.landmarks
    .filter((l) => {
      const p = S(l.at.x, l.at.y, 0);
      return p.x > -120 && p.x < 1230 && p.y > -160 && p.y < 980;
    })
    .sort((a, b) => (a.at.x + a.at.y) - (b.at.x + b.at.y));
  for (const landmark of visibleLandmarks) drawLandmark(landmarkLayer, landmark);

  /* ---------------------------------------------------------------- routes */

  const ROUTE = {
    taxi: { colour: '#c08a2c', width: 4.8 },
    bus: { colour: '#3f7a52', width: 5.6 },
    special: { colour: '#6a4b9a', width: 5.4, dash: '8 6' },
    underground: { colour: '#a43d33', width: 6.2 },
  };
  const ORDER = ['taxi', 'bus', 'special', 'underground'];

  const routeLayer = el('g', {}, root);
  const edges = MAP.graph.edges.slice().sort((a, b) => ORDER.indexOf(a.mode) - ORDER.indexOf(b.mode));
  for (const edge of edges) {
    const path = edge.path ?? null;
    if (path === null) continue;
    const pts = path.map((p) => {
      const q = proj(p.x, p.y);
      return { x: (q.x - VIEW.x) * SCALE, y: (q.y - VIEW.y) * SCALE };
    });
    if (!viewBox(pts, 30)) continue;
    const style = ROUTE[edge.mode];
    const d = pathOf(pts);
    const casing = el('path', {
      d, fill: 'none', stroke: INK, 'stroke-width': style.width + 3.0,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.94,
    }, routeLayer);
    if (style.dash) casing.setAttribute('stroke-dasharray', style.dash);
    const core = el('path', {
      d, fill: 'none', stroke: style.colour, 'stroke-width': style.width,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    }, routeLayer);
    if (style.dash) core.setAttribute('stroke-dasharray', style.dash);
  }

  /* ----------------------------------------------------------------- nodes */

  const STOPS = {
    bus: { colour: ROUTE.bus.colour, from: -124, to: -56 },
    underground: { colour: ROUTE.underground.colour, from: 56, to: 124 },
    special: { colour: ROUTE.special.colour, from: -32, to: 32 },
  };

  function polar(cx, cy, r, deg) {
    const a = (deg * Math.PI) / 180;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  }

  function arcPath(cx, cy, r, from, to) {
    const a = polar(cx, cy, r, from);
    const b = polar(cx, cy, r, to);
    return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
  }

  const collarLayer = el('g', {}, root);
  const nodeLayer = el('g', {}, root);
  const visibleNodes = MAP.graph.nodes.filter((n) => {
    const p = S(n.x, n.y, 0);
    return p.x > -30 && p.x < 1137 && p.y > -30 && p.y < 851;
  });

  for (const node of visibleNodes) {
    const c = S(node.x, node.y, 0);
    const stops = (node.modes ?? []).filter((m) => m !== 'taxi');
    for (const mode of stops) {
      const slot = STOPS[mode];
      if (!slot) continue;
      const d = arcPath(c.x, c.y, 19.5, slot.from, slot.to);
      // Paper, then ink, then colour: the paper under-stroke lifts the collar
      // off any route that happens to pass the station, so it reads as a badge.
      el('path', { d, fill: 'none', stroke: PAPER, 'stroke-width': 8, 'stroke-linecap': 'round' }, collarLayer);
      el('path', { d, fill: 'none', stroke: INK, 'stroke-width': 4.9, 'stroke-linecap': 'round' }, collarLayer);
      el('path', { d, fill: 'none', stroke: slot.colour, 'stroke-width': 3.2, 'stroke-linecap': 'round' }, collarLayer);
    }
  }

  // Legal destinations sit outside the pieces.
  const legalLayer = el('g', {}, root);
  const fugitive = 'n8';
  const legalTargets = ['n11', 'n14', 'n24', 'n6'];
  for (const target of legalTargets) {
    const node = MAP.graph.nodes.find((n) => n.id === target);
    if (!node) continue;
    const c = S(node.x, node.y, 0);
    el('circle', {
      cx: c.x, cy: c.y, r: 28, fill: 'none',
      stroke: ROUTE.taxi.colour, 'stroke-width': 2.2, 'stroke-dasharray': '4 3', opacity: 0.95,
    }, legalLayer);
  }

  for (const node of visibleNodes) {
    const c = S(node.x, node.y, 0);
    const number = node.id.replace(/^[^0-9]*/, '');
    circle(nodeLayer, c.x, c.y, 13, '#f9f0da', INK, 2.1);
    text(nodeLayer, c.x, c.y + 4.2, number, { size: 11.5, weight: 800, anchor: 'middle', ls: 0.2 });
  }

  /* ---------------------------------------------------------------- tokens */

  const tokenLayer = el('g', {}, root);
  const fugitiveNode = MAP.graph.nodes.find((n) => n.id === fugitive);
  const agentSeats = MAP.starts.agents;

  for (let i = 0; i < agentSeats.length; i += 1) {
    const node = MAP.graph.nodes.find((n) => n.id === agentSeats[i]);
    if (!node) continue;
    const c = S(node.x, node.y, 0);
    if (c.x < 0 || c.x > 1107 || c.y < 0 || c.y > 821) continue;
    circle(tokenLayer, c.x, c.y, 10.5, '#2f6fed', INK, 2.1);
    text(tokenLayer, c.x, c.y + 2.8, `A${i + 1}`, { size: 7.5, weight: 800, anchor: 'middle', fill: '#f7efda', ls: 0 });
  }

  if (fugitiveNode) {
    const c = S(fugitiveNode.x, fugitiveNode.y, 0);
    circle(tokenLayer, c.x, c.y, 13.5, '#8f2f26', INK, 2.3);
    circle(tokenLayer, c.x, c.y, 8.4, 'none', '#f3e3c8', 1.2);
    text(tokenLayer, c.x, c.y + 3.6, 'F', { size: 10, weight: 800, anchor: 'middle', fill: '#f7efda', ls: 0 });
  }

  /* ---------------------------------------------------------------- labels */

  const labelLayer = el('g', {}, root);
  for (const landmark of visibleLandmarks) {
    const labelY = S(landmark.at.x, landmark.at.y, LABEL_Z[landmark.kind] ?? 26).y - 8 - (landmark.kind === 'museum' ? 12 : 0);
    const labelX = S(landmark.at.x, landmark.at.y, 0).x;
    if (labelY < 24 || labelY > 800 || labelX < -40 || labelX > 1147) continue;
    plaque(labelLayer, labelX, labelY, landmark.label);
  }

  /* --------------------------------------------------------- panel samples */

  function miniDisc(modes, number) {
    const svgNode = document.createElementNS(NS, 'svg');
    svgNode.setAttribute('viewBox', '0 0 40 40');
    svgNode.setAttribute('width', '40');
    svgNode.setAttribute('height', '40');
    for (const mode of modes) {
      const slot = STOPS[mode];
      if (!slot) continue;
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', arcPath(20, 20, 13, slot.from, slot.to));
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', slot.colour);
      p.setAttribute('stroke-width', 3.2);
      p.setAttribute('stroke-linecap', 'round');
      svgNode.appendChild(p);
    }
    const disc = document.createElementNS(NS, 'circle');
    disc.setAttribute('cx', '20'); disc.setAttribute('cy', '20'); disc.setAttribute('r', '9.5');
    disc.setAttribute('fill', '#f9f0da'); disc.setAttribute('stroke', INK); disc.setAttribute('stroke-width', '1.8');
    svgNode.appendChild(disc);
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', '20'); t.setAttribute('y', '23.2'); t.setAttribute('text-anchor', 'middle');
    t.setAttribute('font-family', "'Helvetica Neue', Helvetica, Arial, sans-serif");
    t.setAttribute('font-size', '9'); t.setAttribute('font-weight', '800'); t.setAttribute('fill', INK);
    t.textContent = number;
    svgNode.appendChild(t);
    return svgNode;
  }

  const samples = document.getElementById('collar-samples');
  if (samples) {
    for (const [modes, label] of [[['bus'], 'BUS'], [['underground'], 'METRO'], [['special'], 'SPECIAL']]) {
      const wrap = document.createElement('div');
      wrap.className = 'sample';
      wrap.appendChild(miniDisc(modes, '14'));
      const caption = document.createElement('span');
      caption.textContent = label;
      wrap.appendChild(caption);
      samples.appendChild(wrap);
    }
  }

  const key = document.getElementById('collar-key');
  if (key) {
    key.appendChild(miniDisc(['bus'], '14'));
    const span = document.createElement('span');
    span.style.marginLeft = '5px';
    span.textContent = 'Mode at station';
    key.appendChild(span);
  }

  document.body.dataset.ready = '1';
  console.log('mock: houses', buildings.length, 'nodes', visibleNodes.length, 'edges', edges.length, 'landmarks', visibleLandmarks.length);
})();
