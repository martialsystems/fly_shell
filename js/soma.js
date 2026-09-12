/** MaleCNS soma cloud pack (FSMP v2, structure-of-arrays). DOM-free. */

export const SOMA_MAGIC = "FSMP";
export const SOMA_VERSION = 2;

/** Optic lobes cyan, central brain dark blue, projection neurons orange. */
export const CLASS_COLORS = {
  0: [0.18, 0.32, 0.42],
  1: [0.22, 0.78, 0.95],
  2: [0.10, 0.38, 0.62],
  3: [0.16, 0.48, 0.58],
  4: [0.95, 0.52, 0.18],
  5: [1.00, 0.72, 0.28],
  6: [0.95, 0.45, 0.70],
  7: [0.90, 0.58, 0.22],
  8: [0.35, 0.72, 0.90],
  9: [0.85, 0.62, 0.30],
};

export function stripSide(id) {
  const s = String(id || "");
  return s.replace(/_[LR]$/, "");
}

function align4(n) {
  return (n + 3) & ~3;
}

export function parseSomaPack(buf) {
  const src = buf instanceof ArrayBuffer ? new Uint8Array(buf) : new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  const bytes = src.byteOffset === 0 ? src : src.slice();
  if (bytes.byteLength < 24) throw new Error("soma pack too small");
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (magic !== SOMA_MAGIC) throw new Error("soma magic " + magic);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = view.getUint32(4, true);
  if (version !== SOMA_VERSION) throw new Error("soma version " + version);
  const count = view.getUint32(8, true);
  const ntypes = view.getUint32(12, true);
  let off = 24;
  const types = [];
  const decoder = new TextDecoder("utf-8");
  for (let i = 0; i < ntypes; i++) {
    if (off + 2 > bytes.byteLength) throw new Error("type table truncated");
    const n = view.getUint16(off, true);
    off += 2;
    types.push(decoder.decode(bytes.subarray(off, off + n)));
    off += n;
  }
  off = align4(off);
  const posBytes = count * 12;
  if (off + posBytes > bytes.byteLength) throw new Error("soma positions truncated");
  const positions = new Float32Array(bytes.buffer, bytes.byteOffset + off, count * 3);
  off += posBytes;
  if (off + count > bytes.byteLength) throw new Error("soma classes truncated");
  const classes = new Uint8Array(bytes.buffer, bytes.byteOffset + off, count);
  off = align4(off + count);
  if (off + count * 2 > bytes.byteLength) throw new Error("soma type ids truncated");
  const typeIds = new Uint16Array(bytes.buffer, bytes.byteOffset + off, count);
  return { count, types, positions, classes, typeIds };
}

export function indexByType(pack) {
  const buckets = new Map();
  for (let i = 0; i < pack.count; i++) {
    const name = pack.types[pack.typeIds[i]] || "";
    let list = buckets.get(name);
    if (!list) {
      list = [];
      buckets.set(name, list);
    }
    list.push(i);
  }
  const out = new Map();
  for (const [name, list] of buckets) out.set(name, Uint32Array.from(list));
  return out;
}

export function fillBaseColors(pack, rgb) {
  const n = pack.count;
  for (let i = 0; i < n; i++) {
    const c = CLASS_COLORS[pack.classes[i]] || CLASS_COLORS[0];
    rgb[i * 3] = c[0];
    rgb[i * 3 + 1] = c[1];
    rgb[i * 3 + 2] = c[2];
  }
  return rgb;
}

export function litTypesFromNeurons(neurons) {
  const lit = new Map();
  for (const rec of Object.values(neurons || {})) {
    const rate = rec.rate || 0;
    if (rate < 0.05) continue;
    const keys = [rec.id, rec.type, stripSide(rec.id), stripSide(rec.type)];
    for (const k of keys) {
      if (!k) continue;
      const prev = lit.get(k) || 0;
      if (rate > prev) lit.set(k, rate);
    }
  }
  return lit;
}
