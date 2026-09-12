/** fly_shell frame and mapping contract. Browser and node. */

export const FRAME_SCHEMA = "fly_shell.v1";
export const MAPPING_SCHEMA = "fly_shell.mapping.v1";
export const ATLAS_SCHEMA = "fly_shell.atlas.v1";

export const GAITS = Object.freeze([
  "idle",
  "walk",
  "retreat",
  "turn_l",
  "turn_r",
  "jump",
  "groom",
  "feed",
  "flight",
]);

export const REDUCERS = Object.freeze(["max", "mean", "sum", "any"]);
export const MATCHES = Object.freeze(["id", "type", "prefix"]);

const RATE_TAU_HZ = 80;

export function clamp01(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  if (n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
}

export function hzToRate(hz) {
  const n = Number(hz);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return 1 - Math.exp(-n / RATE_TAU_HZ);
}

export function asNeuronRecord(id, raw) {
  if (raw == null) return { id, type: id, rate: 0, spike: false };
  if (typeof raw === "number") {
    const rate = clamp01(raw);
    return { id, type: id, rate, spike: rate > 0.6 };
  }
  const type = String(raw.type || raw.cell_type || id);
  let rate;
  if (raw.rate != null) rate = clamp01(raw.rate);
  else if (raw.hz != null) rate = hzToRate(raw.hz);
  else if (raw.spike) rate = 1;
  else rate = 0;
  const xyz = Array.isArray(raw.xyz) && raw.xyz.length >= 3
    ? [Number(raw.xyz[0]), Number(raw.xyz[1]), Number(raw.xyz[2])]
    : null;
  return {
    id: String(raw.id || id),
    type,
    rate,
    spike: Boolean(raw.spike) || rate > 0.6,
    xyz,
    region: raw.region ? String(raw.region) : null,
  };
}

export function normalizeNeurons(raw) {
  const out = {};
  if (!raw) return out;
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (item == null) continue;
      const id = String(item.id || item.name || "");
      if (!id) continue;
      out[id] = asNeuronRecord(id, item);
    }
    return out;
  }
  if (typeof raw === "object") {
    for (const [id, item] of Object.entries(raw)) {
      out[String(id)] = asNeuronRecord(String(id), item);
    }
  }
  return out;
}

function asVec3(v, fallback) {
  if (Array.isArray(v) && v.length >= 3) {
    return [Number(v[0]) || 0, Number(v[1]) || 0, Number(v[2]) || 0];
  }
  if (v && typeof v === "object") {
    return [Number(v.x) || 0, Number(v.y) || 0, Number(v.z) || 0];
  }
  return fallback;
}

export function normalizeJoints(raw) {
  if (!raw || typeof raw !== "object") return {};
  const out = {};
  for (const [name, val] of Object.entries(raw)) {
    if (val == null) continue;
    if (typeof val === "number") {
      out[name] = { value: val };
      continue;
    }
    const joint = {};
    for (const k of ["coxa", "femur", "tibia", "tarsus", "yaw", "pitch", "roll", "value"]) {
      if (val[k] != null && Number.isFinite(Number(val[k]))) joint[k] = Number(val[k]);
    }
    out[name] = joint;
  }
  return out;
}

export function normalizeBody(raw) {
  if (!raw || typeof raw !== "object") return null;
  const gait = raw.gait && GAITS.includes(raw.gait) ? raw.gait : null;
  return {
    position: asVec3(raw.position || raw.xyz, null),
    rotation: asVec3(raw.rotation, null),
    yaw: Number.isFinite(Number(raw.yaw)) ? Number(raw.yaw) : null,
    pitch: Number.isFinite(Number(raw.pitch)) ? Number(raw.pitch) : null,
    roll: Number.isFinite(Number(raw.roll)) ? Number(raw.roll) : null,
    gait,
    joints: normalizeJoints(raw.joints),
    wings: {
      L: raw.wings && raw.wings.L != null ? clamp01(raw.wings.L) : null,
      R: raw.wings && raw.wings.R != null ? clamp01(raw.wings.R) : null,
    },
  };
}

export function normalizePayload(raw) {
  if (!raw || typeof raw !== "object") return null;
  const markers = Array.isArray(raw.markers)
    ? raw.markers.map((m) => ({
        x: Number(m.x) || 0,
        z: Number(m.z) || 0,
        label: m.label != null ? String(m.label) : "",
        color: m.color != null ? String(m.color) : "#7ee0ff",
      }))
    : [];
  const path = Array.isArray(raw.path)
    ? raw.path.map((p) => [Number(p[0]) || 0, Number(p[1]) || 0])
    : [];
  return {
    hud: raw.hud != null ? String(raw.hud) : "",
    markers,
    path,
  };
}

export function normalizeControls(raw) {
  if (!raw || typeof raw !== "object") return {};
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (Number.isFinite(Number(v))) out[k] = Number(v);
  }
  return out;
}

export function emptyFrame(t = 0) {
  return {
    schema: FRAME_SCHEMA,
    t,
    neurons: {},
    body: null,
    controls: {},
    payload: null,
    skip_map: false,
  };
}

export function normalizeFrame(raw, tFallback = 0) {
  if (raw == null || typeof raw !== "object") {
    return emptyFrame(tFallback);
  }
  const t = Number.isFinite(Number(raw.t)) ? Number(raw.t) : tFallback;
  return {
    schema: FRAME_SCHEMA,
    t,
    neurons: normalizeNeurons(raw.neurons),
    body: normalizeBody(raw.body),
    controls: normalizeControls(raw.controls),
    payload: normalizePayload(raw.payload),
    skip_map: Boolean(raw.skip_map),
  };
}

export function normalizeChannel(raw, index = 0) {
  const id = String((raw && raw.id) || `ch${index}`);
  const from = Array.isArray(raw && raw.from)
    ? raw.from.map((s) => String(s)).filter(Boolean)
    : [];
  const match = MATCHES.includes(raw && raw.match) ? raw.match : "id";
  const reduce = REDUCERS.includes(raw && raw.reduce) ? raw.reduce : "max";
  const threshold = Number.isFinite(Number(raw && raw.threshold))
    ? Number(raw.threshold)
    : 0;
  return {
    id,
    label: String((raw && raw.label) || id),
    from,
    match,
    reduce,
    threshold,
    drive: String((raw && raw.drive) || "control"),
  };
}

export function normalizeMapping(raw) {
  const channels = Array.isArray(raw && raw.channels)
    ? raw.channels.map((c, i) => normalizeChannel(c, i))
    : [];
  return { schema: MAPPING_SCHEMA, channels };
}

export function mappingErrors(mapping) {
  const errs = [];
  if (!mapping || mapping.schema !== MAPPING_SCHEMA) {
    errs.push("mapping.schema must be " + MAPPING_SCHEMA);
  }
  const ids = new Set();
  for (const ch of (mapping && mapping.channels) || []) {
    if (!ch.id) errs.push("channel missing id");
    if (ids.has(ch.id)) errs.push("duplicate channel id: " + ch.id);
    ids.add(ch.id);
    if (!MATCHES.includes(ch.match)) errs.push(ch.id + " bad match");
    if (!REDUCERS.includes(ch.reduce)) errs.push(ch.id + " bad reduce");
  }
  return errs;
}

export function frameLooksLike(raw) {
  if (!raw || typeof raw !== "object") return false;
  if (raw.schema === FRAME_SCHEMA) return true;
  if (raw.neurons != null) return true;
  if (raw.body != null) return true;
  if (raw.controls != null) return true;
  return false;
}

export function lerp(a, b, u) {
  return a + (b - a) * u;
}

export function lerpFrame(a, b, u) {
  const t = lerp(a.t, b.t, u);
  const ids = new Set([...Object.keys(a.neurons), ...Object.keys(b.neurons)]);
  const neurons = {};
  for (const id of ids) {
    const na = a.neurons[id];
    const nb = b.neurons[id];
    if (na && nb) {
      neurons[id] = {
        id,
        type: nb.type || na.type,
        rate: lerp(na.rate, nb.rate, u),
        spike: u < 0.5 ? na.spike : nb.spike,
        xyz: nb.xyz || na.xyz,
        region: nb.region || na.region,
      };
    } else {
      const src = nb || na;
      neurons[id] = { ...src, rate: (nb ? u : 1 - u) * src.rate };
    }
  }
  const controls = {};
  const cids = new Set([...Object.keys(a.controls), ...Object.keys(b.controls)]);
  for (const id of cids) {
    controls[id] = lerp(a.controls[id] || 0, b.controls[id] || 0, u);
  }
  const body = b.body || a.body;
  return {
    schema: FRAME_SCHEMA,
    t,
    neurons,
    body,
    controls,
    payload: u < 0.5 ? a.payload : b.payload,
    skip_map: b.skip_map,
  };
}
