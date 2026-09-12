/** Schematic named-cell atlas for the adult fly CNS.

Positions are region jitter, not EM reconstruction coordinates.
Ids are public FlyWire / MaleCNS type labels used as the same brain
everyone else is plugging into games.
*/

import { ATLAS_SCHEMA } from "./schema.js";

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function jitter(rng, c, r) {
  return [
    c[0] + (rng() * 2 - 1) * r[0],
    c[1] + (rng() * 2 - 1) * r[1],
    c[2] + (rng() * 2 - 1) * r[2],
  ];
}

/** Region centers: x right, y up, z anterior. Brain at +z, VNC at -z. */
export const REGIONS = {
  optic_l: { c: [-0.92, 0.08, 0.42], r: [0.22, 0.28, 0.22], color: "#3ec7ff" },
  optic_r: { c: [0.92, 0.08, 0.42], r: [0.22, 0.28, 0.22], color: "#3ec7ff" },
  lamina_l: { c: [-1.18, 0.06, 0.48], r: [0.1, 0.16, 0.1], color: "#6cf" },
  lamina_r: { c: [1.18, 0.06, 0.48], r: [0.1, 0.16, 0.1], color: "#6cf" },
  cx: { c: [0, 0.22, 0.18], r: [0.18, 0.12, 0.16], color: "#d4a0ff" },
  mb_l: { c: [-0.28, 0.28, 0.38], r: [0.14, 0.1, 0.12], color: "#ffb347" },
  mb_r: { c: [0.28, 0.28, 0.38], r: [0.14, 0.1, 0.12], color: "#ffb347" },
  al_l: { c: [-0.22, -0.02, 0.52], r: [0.1, 0.08, 0.08], color: "#9dffb0" },
  al_r: { c: [0.22, -0.02, 0.52], r: [0.1, 0.08, 0.08], color: "#9dffb0" },
  lh_l: { c: [-0.42, 0.1, 0.48], r: [0.08, 0.08, 0.08], color: "#9dffb0" },
  lh_r: { c: [0.42, 0.1, 0.48], r: [0.08, 0.08, 0.08], color: "#9dffb0" },
  gng: { c: [0, -0.28, 0.08], r: [0.2, 0.12, 0.12], color: "#ff8ad4" },
  sez: { c: [0, -0.18, 0.22], r: [0.16, 0.1, 0.1], color: "#ff8ad4" },
  dn: { c: [0, -0.06, 0.02], r: [0.16, 0.12, 0.12], color: "#ffd76a" },
  vnc_t1: { c: [0, -0.12, -0.55], r: [0.22, 0.12, 0.14], color: "#7ee0ff" },
  vnc_t2: { c: [0, -0.1, -0.95], r: [0.2, 0.12, 0.14], color: "#7ee0ff" },
  vnc_t3: { c: [0, -0.08, -1.35], r: [0.18, 0.12, 0.14], color: "#7ee0ff" },
  vnc_a: { c: [0, -0.06, -1.8], r: [0.12, 0.1, 0.22], color: "#5aa" },
};

const CELLS = [
  // lamina / medulla motion
  ["L1_L", "L1", "lamina_l"],
  ["L1_R", "L1", "lamina_r"],
  ["L2_L", "L2", "lamina_l"],
  ["L2_R", "L2", "lamina_r"],
  ["T4c_L", "T4c", "optic_l"],
  ["T4c_R", "T4c", "optic_r"],
  ["T4d_L", "T4d", "optic_l"],
  ["T4d_R", "T4d", "optic_r"],
  ["T5c_L", "T5c", "optic_l"],
  ["T5c_R", "T5c", "optic_r"],
  ["T5d_L", "T5d", "optic_l"],
  ["T5d_R", "T5d", "optic_r"],
  ["LPLC2_L", "LPLC2", "optic_l"],
  ["LPLC2_R", "LPLC2", "optic_r"],
  ["LC4_L", "LC4", "optic_l"],
  ["LC4_R", "LC4", "optic_r"],
  ["LC6_L", "LC6", "optic_l"],
  ["LC6_R", "LC6", "optic_r"],
  ["LC11_L", "LC11", "optic_l"],
  ["LC11_R", "LC11", "optic_r"],
  ["LC16_L", "LC16", "optic_l"],
  ["LC16_R", "LC16", "optic_r"],
  // olfaction / taste
  ["ORN_DM1", "ORN", "al_l"],
  ["ORN_VA1v", "ORN", "al_r"],
  ["PN_DM1", "PN", "al_l"],
  ["PN_VA1v", "PN", "al_r"],
  ["LH_L", "LH", "lh_l"],
  ["LH_R", "LH", "lh_r"],
  ["Gr5a", "Gr5a", "sez"],
  ["Gr66a", "Gr66a", "sez"],
  ["LB3b", "LB3b", "sez"],
  ["PhG1a", "PhG1a", "sez"],
  ["JO-E_L", "JO-E", "sez"],
  ["JO-E_R", "JO-E", "sez"],
  // mushroom body / CX
  ["KC_L", "KC", "mb_l"],
  ["KC_R", "KC", "mb_r"],
  ["PAM01", "PAM", "mb_l"],
  ["PPL101", "PPL", "mb_r"],
  ["MBON01", "MBON", "mb_l"],
  ["EPG_L", "EPG", "cx"],
  ["EPG_R", "EPG", "cx"],
  ["PEN_L", "PEN", "cx"],
  ["PEN_R", "PEN", "cx"],
  ["PFNd", "PFNd", "cx"],
  ["PFNv", "PFNv", "cx"],
  ["FC2", "FC2", "cx"],
  // descending
  ["DNp01", "DNp01", "dn"],
  ["DNp02", "DNp02", "dn"],
  ["DNp09", "DNp09", "dn"],
  ["DNp50", "DNp50", "dn"],
  ["DNa01_L", "DNa01", "dn"],
  ["DNa01_R", "DNa01", "dn"],
  ["DNa02_L", "DNa02", "dn"],
  ["DNa02_R", "DNa02", "dn"],
  ["DNb01", "DNb01", "dn"],
  ["DNg13_L", "DNg13", "dn"],
  ["DNg13_R", "DNg13", "dn"],
  ["MDN", "MDN", "dn"],
  ["BDN2", "BDN2", "dn"],
  ["aDN1", "aDN1", "dn"],
  ["aDN2", "aDN2", "dn"],
  ["BB", "BB", "dn"],
  ["FG", "FG", "dn"],
  // motor / VNC
  ["MN9", "MN9", "gng"],
  ["MN8", "MN8", "gng"],
  ["TTM_L", "TTM", "vnc_t2"],
  ["TTM_R", "TTM", "vnc_t2"],
  ["DLM_L", "DLM", "vnc_t2"],
  ["DLM_R", "DLM", "vnc_t2"],
  ["DVM_L", "DVM", "vnc_t2"],
  ["DVM_R", "DVM", "vnc_t2"],
  ["L1_FeMN", "legMN", "vnc_t1"],
  ["R1_FeMN", "legMN", "vnc_t1"],
  ["L2_FeMN", "legMN", "vnc_t2"],
  ["R2_FeMN", "legMN", "vnc_t2"],
  ["L3_FeMN", "legMN", "vnc_t3"],
  ["R3_FeMN", "legMN", "vnc_t3"],
  ["L1_TiMN", "legMN", "vnc_t1"],
  ["R1_TiMN", "legMN", "vnc_t1"],
  ["L2_TiMN", "legMN", "vnc_t2"],
  ["R2_TiMN", "legMN", "vnc_t2"],
  ["L3_TiMN", "legMN", "vnc_t3"],
  ["R3_TiMN", "legMN", "vnc_t3"],
  ["AbN", "AbN", "vnc_a"],
];

export function buildAtlas(seed = 1) {
  const rng = mulberry32(seed);
  const neurons = {};
  for (const [id, type, region] of CELLS) {
    const spec = REGIONS[region];
    const xyz = jitter(rng, spec.c, spec.r);
    neurons[id] = {
      id,
      type,
      region,
      xyz,
      color: spec.color,
    };
  }
  return {
    schema: ATLAS_SCHEMA,
    source: "schematic",
    seed,
    neurons,
  };
}

export function mergeAtlas(base, overlay) {
  const neurons = { ...(base.neurons || {}) };
  const extra = (overlay && overlay.neurons) || overlay || {};
  const list = Array.isArray(extra) ? extra : Object.values(extra);
  for (const n of list) {
    if (!n || !n.id) continue;
    const prev = neurons[n.id] || {};
    neurons[n.id] = {
      ...prev,
      ...n,
      id: String(n.id),
      type: n.type || prev.type || n.id,
      xyz: n.xyz || prev.xyz,
      region: n.region || prev.region || "cx",
      color: n.color || prev.color || "#ffd76a",
    };
  }
  return {
    schema: ATLAS_SCHEMA,
    source: (overlay && overlay.source) || base.source || "schematic",
    seed: base.seed,
    neurons,
  };
}

export const DEFAULT_MAPPING = {
  schema: "fly_shell.mapping.v1",
  channels: [
    {
      id: "walk_fwd",
      label: "walk forward",
      from: ["DNp09", "BDN2"],
      match: "id",
      reduce: "max",
      threshold: 0.12,
      drive: "gait:walk",
    },
    {
      id: "walk_back",
      label: "walk back",
      from: ["MDN"],
      match: "id",
      reduce: "max",
      threshold: 0.12,
      drive: "gait:retreat",
    },
    {
      id: "steer_l",
      label: "steer left",
      from: ["DNa02_L", "DNg13_L"],
      match: "id",
      reduce: "mean",
      threshold: 0,
      drive: "steer",
    },
    {
      id: "steer_r",
      label: "steer right",
      from: ["DNa02_R", "DNg13_R"],
      match: "id",
      reduce: "mean",
      threshold: 0,
      drive: "steer",
    },
    {
      id: "jump",
      label: "jump",
      from: ["DNp01"],
      match: "id",
      reduce: "max",
      threshold: 0.4,
      drive: "gait:jump",
    },
    {
      id: "halt",
      label: "halt",
      from: ["BB", "FG"],
      match: "id",
      reduce: "max",
      threshold: 0.25,
      drive: "gait:idle",
    },
    {
      id: "feed",
      label: "feed",
      from: ["MN9"],
      match: "id",
      reduce: "max",
      threshold: 0.2,
      drive: "gait:feed",
    },
    {
      id: "loom",
      label: "loom",
      from: ["LPLC2"],
      match: "prefix",
      reduce: "max",
      threshold: 0,
      drive: "control",
    },
    {
      id: "sugar",
      label: "sugar",
      from: ["Gr5a", "LB3b", "PhG1a"],
      match: "id",
      reduce: "max",
      threshold: 0,
      drive: "control",
    },
    {
      id: "flight",
      label: "flight",
      from: ["DLM", "DVM"],
      match: "prefix",
      reduce: "mean",
      threshold: 0.3,
      drive: "gait:flight",
    },
  ],
};
