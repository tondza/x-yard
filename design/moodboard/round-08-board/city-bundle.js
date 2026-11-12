"use strict";
var XYCITY = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // apps/web/src/prototype/city.ts
  var city_exports = {};
  __export(city_exports, {
    ROOF_STYLES: () => ROOF_STYLES,
    WALL_COLOURS: () => WALL_COLOURS,
    blockBounds: () => blockBounds,
    buildingsForMap: () => buildingsForMap,
    furnitureForMap: () => furnitureForMap,
    pathData: () => pathData,
    treesForMap: () => treesForMap
  });
  var ROOF_STYLES = {
    clay: { roof: "#c26a4a", edge: "#984b32", ridge: "#a5553a" },
    terracotta: { roof: "#b85b3e", edge: "#8c432b", ridge: "#9c4a33" },
    ochre: { roof: "#c7954c", edge: "#a07234", ridge: "#b3833f" },
    slate: { roof: "#7f8c94", edge: "#5e6a72", ridge: "#6d7880" },
    copper: { roof: "#5c9a84", edge: "#3f7462", ridge: "#4d8470" },
    gravel: { roof: "#b7a98f", edge: "#95876d", ridge: "#a6977e" },
    glass: { roof: "#9cc4d4", edge: "#749cac", ridge: "#86adc0" }
  };
  var WALL_COLOURS = [
    "#e8d6b8",
    "#dfc9a8",
    "#d4bd9c",
    "#efe1c7",
    "#e3c5a8",
    "#d6c2a0",
    "#cbb48c",
    "#e6d8bd"
  ];
  var PROVISIONAL_HOUSE_GAP = 8.5;
  var PROVISIONAL_HOUSE_MARGIN = 5;
  var PROVISIONAL_HOUSE_INSET = 1.2;
  var PROVISIONAL_HOUSE_INSET_RANGE = 2.4;
  var PROVISIONAL_EMPTY_RUN_CHANCE = 0.22;
  var PROVISIONAL_TERRACE_GAP = 6;
  var PROVISIONAL_SINGLE_HOUSE_MIN_WIDTH = 70;
  var PROVISIONAL_SINGLE_HOUSE_CHANCE = 0.12;
  var PROVISIONAL_THREE_COLUMN_MIN_WIDTH = 55;
  var PROVISIONAL_THREE_COLUMN_CHANCE = 0.5;
  var PROVISIONAL_TWO_ROW_MIN_HEIGHT = 55;
  var PROVISIONAL_TWO_ROW_CHANCE = 0.45;
  var PROVISIONAL_WIDTH_JITTER_MIN = 0.78;
  var PROVISIONAL_WIDTH_JITTER_RANGE = 0.44;
  var PROVISIONAL_MIN_FOOTPRINT = 16;
  var PROVISIONAL_MIN_HOUSE_SIDE = 5;
  var PROVISIONAL_TRIPLE_RUN_CHANCE = 0.55;
  var ROOF_PITCH = {
    terrace: 0.56,
    townhouse: 0.6,
    cottage: 0.8,
    mansion: 0.5,
    tenement: 0.04,
    warehouse: 0.36,
    shop: 0.04
  };
  var HOUSE_DORMERS = {
    terrace: 1,
    townhouse: 1,
    cottage: 1,
    mansion: 0,
    tenement: 0,
    warehouse: 0,
    shop: 0
  };
  var HOUSE_CHIMNEYS = {
    terrace: 2,
    townhouse: 2,
    cottage: 1,
    mansion: 3,
    tenement: 2,
    warehouse: 1,
    shop: 1
  };
  var HOUSE_LIFT_BONUS = {
    terrace: 0,
    townhouse: 1,
    cottage: -1,
    mansion: 4,
    tenement: 4,
    warehouse: 5,
    shop: -2
  };
  var HOUSE_TYPES = [
    "terrace",
    "terrace",
    "terrace",
    "townhouse",
    "townhouse",
    "townhouse",
    "cottage",
    "cottage",
    "mansion",
    "tenement",
    "warehouse",
    "shop"
  ];
  var RUN_TYPES = ["terrace", "terrace", "townhouse", "townhouse", "cottage"];
  function roofForHouse(type, hash) {
    switch (type) {
      case "terrace":
        return "gable";
      case "townhouse":
        return hash % 3 === 0 ? "hip" : "gable";
      case "cottage":
        return "gable";
      case "mansion":
        return "hip";
      case "tenement":
        return "flat";
      case "warehouse":
        return "sawtooth";
      case "shop":
        return "flat";
      default:
        return "gable";
    }
  }
  function windowsForHouse(type, hash) {
    switch (type) {
      case "mansion":
        return 3;
      case "tenement":
        return 3 + hash % 2;
      case "warehouse":
        return 2;
      case "shop":
        return 2;
      default:
        return 2;
    }
  }
  function blockBounds(block) {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const point of block.polygon) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
    return { minX, minY, maxX, maxY };
  }
  function hashString(text) {
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }
  function makeRandom(seed) {
    let state = seed >>> 0;
    return () => {
      state = Math.imul(state, 1664525) + 1013904223 >>> 0;
      return state / 4294967296;
    };
  }
  function buildingHash(key, seed) {
    return (hashString(key) ^ seed) >>> 0;
  }
  var MATERIALS = [
    "clay",
    "clay",
    "clay",
    "terracotta",
    "terracotta",
    "ochre",
    "slate",
    "slate",
    "gravel",
    "gravel",
    "copper",
    "glass"
  ];
  function terraceRuns(cols, random) {
    const runs = [];
    let start = 0;
    while (start < cols) {
      const remaining = cols - start;
      const length = remaining >= 3 && random() < PROVISIONAL_TRIPLE_RUN_CHANCE ? 3 : Math.min(2, remaining);
      runs.push({ start, length });
      start += length;
    }
    return runs;
  }
  function chimneyPotsFor(type, isTerrace, runStart, runEnd, hash) {
    const base = HOUSE_CHIMNEYS[type];
    if (!isTerrace) return base;
    if (runStart || runEnd) return Math.max(1, base - 1);
    return hash % 3 === 0 ? 1 : 0;
  }
  function makeBuilding(key, seed, type, roof, isTerrace, terraceRun, runStart, runEnd, x, y, w, h, lift, ridge) {
    const hash = buildingHash(key, seed);
    const random = makeRandom(hash);
    const material = MATERIALS[Math.floor(random() * MATERIALS.length)] ?? "clay";
    const wall = WALL_COLOURS[Math.floor(random() * WALL_COLOURS.length)] ?? "#e8d6b8";
    const dormerCount = HOUSE_DORMERS[type];
    const dormers = dormerCount === 0 ? 0 : 1 + hash % dormerCount;
    const chimneyPots = chimneyPotsFor(type, isTerrace, runStart, runEnd, hash);
    const roofPitch = ROOF_PITCH[type];
    const windows = windowsForHouse(type, hash);
    return {
      key,
      x,
      y,
      w,
      h,
      lift,
      wall,
      material,
      windows,
      chimney: chimneyPots > 0,
      hash,
      type,
      roof,
      ridge,
      roofPitch,
      dormers,
      chimneyPots,
      terraceRun,
      runStart,
      runEnd
    };
  }
  function buildingsForBlock(block, seed) {
    const bounds = blockBounds(block);
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    if (width < PROVISIONAL_MIN_FOOTPRINT || height < PROVISIONAL_MIN_FOOTPRINT) return [];
    const blockRandom = makeRandom(hashString(block.id) ^ seed);
    const layoutRoll = blockRandom();
    const maxCols = Math.max(
      1,
      Math.floor(
        (width - PROVISIONAL_HOUSE_MARGIN * 2 + PROVISIONAL_HOUSE_GAP) / (PROVISIONAL_MIN_HOUSE_SIDE + PROVISIONAL_HOUSE_GAP)
      )
    );
    const desiredCols = width > PROVISIONAL_SINGLE_HOUSE_MIN_WIDTH && layoutRoll < PROVISIONAL_SINGLE_HOUSE_CHANCE ? 1 : width > PROVISIONAL_THREE_COLUMN_MIN_WIDTH && layoutRoll > PROVISIONAL_THREE_COLUMN_CHANCE ? 3 : 2;
    const cols = Math.min(maxCols, desiredCols);
    const maxRows = Math.max(
      1,
      Math.floor(
        (height - PROVISIONAL_HOUSE_MARGIN * 2 + PROVISIONAL_HOUSE_GAP) / (PROVISIONAL_MIN_HOUSE_SIDE + PROVISIONAL_HOUSE_GAP)
      )
    );
    const desiredRows = height > PROVISIONAL_TWO_ROW_MIN_HEIGHT && layoutRoll < PROVISIONAL_TWO_ROW_CHANCE ? 2 : 1;
    const rows = Math.min(maxRows, desiredRows);
    const cellWidth = (width - PROVISIONAL_HOUSE_MARGIN * 2 - PROVISIONAL_HOUSE_GAP * (cols - 1)) / cols;
    const cellHeight = (height - PROVISIONAL_HOUSE_MARGIN * 2 - PROVISIONAL_HOUSE_GAP * (rows - 1)) / rows;
    const buildings = [];
    for (let row = 0; row < rows; row += 1) {
      const runs = terraceRuns(cols, blockRandom);
      for (const run of runs) {
        const runKey = `${block.id}-${row}-run${run.start}`;
        const runRandom = makeRandom(hashString(runKey) ^ seed);
        if (runRandom() < PROVISIONAL_EMPTY_RUN_CHANCE) continue;
        const inset = PROVISIONAL_HOUSE_INSET + runRandom() * PROVISIONAL_HOUSE_INSET_RANGE;
        const x0 = bounds.minX + PROVISIONAL_HOUSE_MARGIN + run.start * (cellWidth + PROVISIONAL_HOUSE_GAP);
        const runWidth = run.length * cellWidth + (run.length - 1) * PROVISIONAL_HOUSE_GAP;
        const available = Math.max(
          PROVISIONAL_MIN_HOUSE_SIDE * run.length,
          runWidth - inset * 2 - PROVISIONAL_TERRACE_GAP * (run.length - 1)
        );
        const weights = [];
        let weightTotal = 0;
        for (let index = 0; index < run.length; index += 1) {
          const weight = PROVISIONAL_WIDTH_JITTER_MIN + runRandom() * PROVISIONAL_WIDTH_JITTER_RANGE;
          weights.push(weight);
          weightTotal += weight;
        }
        const isTerrace = run.length >= 2;
        const runHash = (hashString(runKey) ^ seed) >>> 0;
        const runType = isTerrace ? RUN_TYPES[Math.floor(runRandom() * RUN_TYPES.length)] ?? "terrace" : "terrace";
        const runRoof = isTerrace ? roofForHouse(runType, runHash) : "gable";
        const sharedLift = Math.max(
          6,
          5 + HOUSE_LIFT_BONUS[runType] + runRandom() * Math.min(13, cellHeight * 0.45)
        );
        let cursorX = x0 + inset;
        for (let index = 0; index < run.length; index += 1) {
          const col = run.start + index;
          const key = `${block.id}-${row}-${col}`;
          const hash = buildingHash(key, seed);
          const type = isTerrace ? runType : HOUSE_TYPES[hash % HOUSE_TYPES.length] ?? "terrace";
          const roof = isTerrace ? runRoof : roofForHouse(type, hash);
          const yInset = PROVISIONAL_HOUSE_INSET + runRandom() * PROVISIONAL_HOUSE_INSET_RANGE;
          const y = bounds.minY + PROVISIONAL_HOUSE_MARGIN + row * (cellHeight + PROVISIONAL_HOUSE_GAP) + yInset;
          const h = Math.max(PROVISIONAL_MIN_HOUSE_SIDE, cellHeight - yInset * 2);
          const w = Math.max(
            PROVISIONAL_MIN_HOUSE_SIDE,
            available * (weights[index] ?? 1) / weightTotal
          );
          const lift = isTerrace ? sharedLift : Math.max(
            6,
            5 + HOUSE_LIFT_BONUS[type] + runRandom() * Math.min(13, cellHeight * 0.45)
          );
          const x = cursorX;
          cursorX += w + PROVISIONAL_TERRACE_GAP;
          const ridge = isTerrace ? "x" : w >= h ? "x" : "y";
          buildings.push(
            makeBuilding(
              key,
              seed,
              type,
              roof,
              isTerrace,
              isTerrace ? runKey : key,
              col === run.start,
              col === run.start + run.length - 1,
              x,
              y,
              w,
              h,
              lift,
              ridge
            )
          );
        }
      }
    }
    return buildings.sort((left, right) => left.y + left.h - (right.y + right.h));
  }
  function buildingsForMap(map) {
    const landmarkBlocks = new Set(map.city.landmarks.map((landmark) => landmark.blockId));
    const buildings = [];
    for (const block of map.city.blocks) {
      if (block.kind !== "block" || landmarkBlocks.has(block.id)) continue;
      buildings.push(...buildingsForBlock(block, map.seed));
    }
    return buildings.sort((left, right) => left.y + left.h - (right.y + right.h));
  }
  function treesForMap(map) {
    const trees = [];
    for (const block of map.city.blocks) {
      const random = makeRandom(hashString(`trees-${block.id}`) ^ map.seed);
      if (block.kind === "park") {
        const bounds = blockBounds(block);
        const count = 5 + Math.floor(random() * 5);
        for (let index = 0; index < count; index += 1) {
          trees.push({
            key: `${block.id}-tree-${index}`,
            x: bounds.minX + 7 + random() * Math.max(1, bounds.maxX - bounds.minX - 14),
            y: bounds.minY + 7 + random() * Math.max(1, bounds.maxY - bounds.minY - 14),
            r: 3.5 + random() * 3
          });
        }
        continue;
      }
      if (random() < 0.14) {
        const bounds = blockBounds(block);
        trees.push({
          key: `${block.id}-street-tree`,
          x: bounds.minX + random() * (bounds.maxX - bounds.minX),
          y: bounds.minY + random() * (bounds.maxY - bounds.minY),
          r: 3 + random() * 2
        });
      }
    }
    return trees;
  }
  var PROVISIONAL_FURNITURE_STATION_CLEARANCE = 30;
  var PROVISIONAL_LAMP_CHANCE = 0.22;
  var PROVISIONAL_BOLLARD_CHANCE = 0.12;
  var PROVISIONAL_PARK_RAILING_CHANCE = 0.6;
  var PROVISIONAL_RAILING_SPAN = 0.62;
  var PROVISIONAL_FURNITURE_EDGE_OFFSET = 3.5;
  var PROVISIONAL_CAB_CHANCE = 0.025;
  var PROVISIONAL_CAB_OFFSET = 4;
  function edgeMidpoints(bounds) {
    const midX = (bounds.minX + bounds.maxX) / 2;
    const midY = (bounds.minY + bounds.maxY) / 2;
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    return [
      { x: midX, y: bounds.minY, angle: 0, span: width },
      { x: bounds.maxX, y: midY, angle: Math.PI / 2, span: height },
      { x: midX, y: bounds.maxY, angle: 0, span: width },
      { x: bounds.minX, y: midY, angle: Math.PI / 2, span: height }
    ];
  }
  function furnitureForMap(map) {
    const stations = map.graph.nodes;
    const clearOfStations = (x, y) => stations.every(
      (station) => Math.hypot(station.x - x, station.y - y) > PROVISIONAL_FURNITURE_STATION_CLEARANCE
    );
    const furniture = [];
    for (const block of map.city.blocks) {
      const random = makeRandom(hashString(`furniture-${block.id}`) ^ map.seed);
      const bounds = blockBounds(block);
      const midX = (bounds.minX + bounds.maxX) / 2;
      const midY = (bounds.minY + bounds.maxY) / 2;
      const edges = edgeMidpoints(bounds);
      if (block.kind === "park") {
        for (const [index, edge2] of edges.entries()) {
          if (random() >= PROVISIONAL_PARK_RAILING_CHANCE) continue;
          if (!clearOfStations(edge2.x, edge2.y)) continue;
          furniture.push({
            key: `${block.id}-railing-${index}`,
            kind: "railing",
            x: edge2.x,
            y: edge2.y,
            angle: edge2.angle,
            size: edge2.span * PROVISIONAL_RAILING_SPAN
          });
        }
        continue;
      }
      const edge = edges[Math.floor(random() * edges.length)] ?? edges[0];
      if (edge === void 0) continue;
      const outwardX = edge.angle === Math.PI / 2 ? Math.sign(edge.x - midX) : 0;
      const outwardY = edge.angle === 0 ? Math.sign(edge.y - midY) : 0;
      const lampX = edge.x + outwardX * PROVISIONAL_FURNITURE_EDGE_OFFSET;
      const lampY = edge.y + outwardY * PROVISIONAL_FURNITURE_EDGE_OFFSET;
      if (random() < PROVISIONAL_LAMP_CHANCE && clearOfStations(lampX, lampY)) {
        furniture.push({
          key: `${block.id}-lamp`,
          kind: "lamp",
          x: lampX,
          y: lampY,
          angle: edge.angle,
          size: 1
        });
      }
      if (random() < PROVISIONAL_BOLLARD_CHANCE) {
        const alongX = edge.angle === 0 ? 1 : 0;
        const alongY = edge.angle === Math.PI / 2 ? 1 : 0;
        for (const offset of [-4, 4]) {
          const x = lampX + alongX * offset;
          const y = lampY + alongY * offset;
          if (!clearOfStations(x, y)) continue;
          furniture.push({
            key: `${block.id}-bollard-${offset}`,
            kind: "bollard",
            x,
            y,
            angle: edge.angle,
            size: 1
          });
        }
      }
    }
    for (const street of map.city.streets) {
      const random = makeRandom(hashString(`cab-${street.id}`) ^ map.seed);
      if (random() >= PROVISIONAL_CAB_CHANCE) continue;
      const path = street.path;
      if (path.length < 2) continue;
      const first = path[0];
      const last = path[path.length - 1];
      const middle = path[Math.floor(path.length / 2)];
      const dx = last.x - first.x;
      const dy = last.y - first.y;
      const length = Math.hypot(dx, dy) || 1;
      const x = middle.x - dy / length * PROVISIONAL_CAB_OFFSET;
      const y = middle.y + dx / length * PROVISIONAL_CAB_OFFSET;
      if (!clearOfStations(x, y)) continue;
      furniture.push({
        key: `${street.id}-cab`,
        kind: "cab",
        x,
        y,
        angle: Math.atan2(dy, dx),
        size: 1
      });
    }
    return furniture;
  }
  function pathData(points) {
    return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
  }
  return __toCommonJS(city_exports);
})();
