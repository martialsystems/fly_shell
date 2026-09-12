/** Built-in plugs. They write named-cell rates. The shell maps those to the body. */

function pulse(t, t0, width, amp = 1) {
  const d = (t - t0) / width;
  if (d < 0 || d > 1) return 0;
  return amp * Math.sin(Math.PI * d);
}

function hold(t, t0, t1, amp = 1) {
  return t >= t0 && t < t1 ? amp : 0;
}

function gaitLegs(phase, group) {
  const s = Math.sin(phase + (group === "A" ? 0 : Math.PI));
  return 0.35 + 0.55 * Math.max(0, s);
}

function baseNeurons() {
  return {};
}

function set(n, id, rate) {
  if (rate <= 0.002) return;
  n[id] = { id, rate: Math.min(1, rate) };
}

export const idleAdapter = {
  id: "idle",
  title: "Idle",
  tick(dt, ctx) {
    const t = ctx.t;
    const n = baseNeurons();
    set(n, "EPG_L", 0.08 + 0.04 * Math.sin(t * 1.7));
    set(n, "EPG_R", 0.08 + 0.04 * Math.sin(t * 1.7 + 0.4));
    set(n, "BB", 0.05);
    return {
      t,
      neurons: n,
      payload: { hud: "idle" },
    };
  },
};

export const walkAdapter = {
  id: "walk",
  title: "Walk",
  tick(dt, ctx) {
    const t = ctx.t;
    const n = baseNeurons();
    const phase = t * 10;
    set(n, "DNp09", 0.72);
    set(n, "BDN2", 0.4);
    set(n, "EPG_L", 0.25 + 0.1 * Math.sin(t * 2));
    set(n, "EPG_R", 0.25 + 0.1 * Math.sin(t * 2 + 0.5));
    set(n, "L1_FeMN", gaitLegs(phase, "A"));
    set(n, "R2_FeMN", gaitLegs(phase, "A"));
    set(n, "L3_FeMN", gaitLegs(phase, "A"));
    set(n, "R1_FeMN", gaitLegs(phase, "B"));
    set(n, "L2_FeMN", gaitLegs(phase, "B"));
    set(n, "R3_FeMN", gaitLegs(phase, "B"));
    set(n, "L1_TiMN", gaitLegs(phase, "A") * 0.8);
    set(n, "R1_TiMN", gaitLegs(phase, "B") * 0.8);
    return {
      t,
      neurons: n,
      payload: { hud: "walk  DNp09" },
    };
  },
};

export const loomAdapter = {
  id: "loom",
  title: "Loom → jump",
  tick(dt, ctx) {
    const t = ctx.t;
    const cycle = 3.2;
    const u = t % cycle;
    const n = baseNeurons();
    const loom = pulse(u, 0.4, 0.9, 1);
    const jump = pulse(u, 1.1, 0.35, 1);
    set(n, "LC4_L", loom * 0.85);
    set(n, "LC4_R", loom * 0.85);
    set(n, "LPLC2_L", loom);
    set(n, "LPLC2_R", loom);
    set(n, "DNp01", jump);
    set(n, "TTM_L", jump);
    set(n, "TTM_R", jump);
    set(n, "EPG_L", 0.1);
    set(n, "EPG_R", 0.1);
    const hud = jump > 0.4 ? "jump  DNp01" : loom > 0.2 ? "loom  LPLC2" : "idle";
    return { t, neurons: n, payload: { hud } };
  },
};

export const sugarAdapter = {
  id: "sugar",
  title: "Sugar → feed",
  tick(dt, ctx) {
    const t = ctx.t;
    const u = t % 4.0;
    const n = baseNeurons();
    const sugar = hold(u, 0.3, 2.6, 0.9);
    const feed = hold(u, 0.8, 2.4, 0.85);
    set(n, "Gr5a", sugar);
    set(n, "LB3b", sugar * 0.8);
    set(n, "PhG1a", sugar * 0.7);
    set(n, "MN9", feed);
    set(n, "MN8", feed * 0.5);
    return {
      t,
      neurons: n,
      payload: { hud: feed > 0.2 ? "feed  MN9" : sugar > 0.2 ? "sugar  Gr5a" : "idle" },
    };
  },
};

export const turnAdapter = {
  id: "turn",
  title: "Walk + steer",
  tick(dt, ctx) {
    const t = ctx.t;
    const n = baseNeurons();
    const phase = t * 10;
    const side = Math.sin(t * 0.6);
    set(n, "DNp09", 0.55);
    if (side >= 0) {
      set(n, "DNa02_R", 0.2 + 0.7 * side);
      set(n, "DNg13_R", 0.15 + 0.5 * side);
    } else {
      set(n, "DNa02_L", 0.2 + 0.7 * -side);
      set(n, "DNg13_L", 0.15 + 0.5 * -side);
    }
    set(n, "L1_FeMN", gaitLegs(phase, "A"));
    set(n, "R2_FeMN", gaitLegs(phase, "A"));
    set(n, "L3_FeMN", gaitLegs(phase, "A"));
    set(n, "R1_FeMN", gaitLegs(phase, "B"));
    set(n, "L2_FeMN", gaitLegs(phase, "B"));
    set(n, "R3_FeMN", gaitLegs(phase, "B"));
    return {
      t,
      neurons: n,
      payload: { hud: side >= 0 ? "steer right  DNa02" : "steer left  DNa02" },
    };
  },
};

export const cycleAdapter = {
  id: "cycle",
  title: "Demo cycle",
  tick(dt, ctx) {
    const t = ctx.t;
    const period = 16;
    const u = t % period;
    const inner = { t: u, dt };
    if (u < 3.5) return { ...walkAdapter.tick(dt, inner), t };
    if (u < 7) return { ...turnAdapter.tick(dt, inner), t };
    if (u < 10.5) return { ...loomAdapter.tick(dt, inner), t };
    if (u < 14) return { ...sugarAdapter.tick(dt, inner), t };
    return { ...idleAdapter.tick(dt, inner), t };
  },
};

export const ADAPTERS = [
  idleAdapter,
  walkAdapter,
  turnAdapter,
  loomAdapter,
  sugarAdapter,
  cycleAdapter,
];

export function adapterById(id) {
  return ADAPTERS.find((a) => a.id === id) || idleAdapter;
}
