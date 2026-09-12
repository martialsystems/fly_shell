/** Left box: 3D Drosophila on a grid. Driven by mapped controls or imported pose. */

import * as THREE from "../vendor/three.module.js";

const BODY = 0xc4a36a;
const BODY_D = 0x8a6a3e;
const EYE = 0xc41e3a;
const EYE_IN = 0x3a0508;
const LEG = 0x4a3428;
const WING = 0xa8d2e0;
const STRIPE = 0x5a3a22;

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.55,
    metalness: opts.metalness ?? 0.05,
    transparent: Boolean(opts.transparent),
    opacity: opts.opacity ?? 1,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    side: opts.side ?? THREE.FrontSide,
  });
}

function mesh(geo, material) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = false;
  m.receiveShadow = false;
  return m;
}

export class FlyView {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x07080c);
    this.scene.fog = new THREE.Fog(0x07080c, 8, 22);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.05, 80);
    this.camera.position.set(3.4, 2.6, 4.6);
    this.look = new THREE.Vector3(0, 0.35, 0);
    this.camera.lookAt(this.look);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.yaw = 0;
    this.pitch = 0.35;
    this.dist = 6.2;
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;
    this._bindOrbit();

    this.clock = { gait: "idle", x: 0, z: 0, yaw: 0, vy: 0, y: 0, phase: 0, airborne: false };
    this.markers = [];
    this.path = null;
    this._pathLine = null;

    this._lights();
    this._grid();
    this.rig = new THREE.Group();
    this.scene.add(this.rig);
    this.joints = {};
    this._buildFly();
    this.resize();
  }

  _bindOrbit() {
    const el = this.canvas;
    el.addEventListener("pointerdown", (e) => {
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    });
    el.addEventListener("pointerup", () => { this.dragging = false; });
    el.addEventListener("pointerleave", () => { this.dragging = false; });
    el.addEventListener("pointermove", (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.yaw -= dx * 0.008;
      this.pitch = Math.max(-0.1, Math.min(1.2, this.pitch + dy * 0.006));
    });
    el.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.dist = Math.max(3.2, Math.min(14, this.dist + e.deltaY * 0.006));
      },
      { passive: false },
    );
  }

  _lights() {
    this.scene.add(new THREE.AmbientLight(0x6a7a88, 0.55));
    const key = new THREE.DirectionalLight(0xfff2d8, 1.15);
    key.position.set(4, 8, 3);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x4a88ff, 0.35);
    fill.position.set(-5, 2, -2);
    this.scene.add(fill);
    const rim = new THREE.PointLight(0x7ee0ff, 0.55, 16);
    rim.position.set(0, 1.4, 0);
    this.scene.add(rim);
  }

  _grid() {
    const grid = new THREE.GridHelper(16, 32, 0x1e4a5c, 0x13202a);
    grid.position.y = 0;
    this.scene.add(grid);
    const floor = mesh(
      new THREE.CircleGeometry(9, 48),
      mat(0x0b1016, { roughness: 1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.012;
    this.scene.add(floor);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(7.6, 7.72, 64),
      new THREE.MeshBasicMaterial({ color: 0x1a3a48, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.001;
    this.scene.add(ring);
  }

  _buildFly() {
    const bodyMat = mat(BODY, { roughness: 0.48 });
    const darkMat = mat(BODY_D, { roughness: 0.5 });
    const stripeMat = mat(STRIPE, { roughness: 0.55 });
    const eyeMat = mat(EYE, { roughness: 0.25, metalness: 0.15, emissive: 0x4a0008, emissiveIntensity: 0.25 });
    const eyeIn = mat(EYE_IN, { roughness: 0.4 });
    const legMat = mat(LEG, { roughness: 0.7 });
    const wingMat = mat(WING, { transparent: true, opacity: 0.28, roughness: 0.2, side: THREE.DoubleSide });

    const head = new THREE.Group();
    head.position.set(0, 0.22, 0.55);
    const skull = mesh(new THREE.SphereGeometry(0.16, 18, 14), bodyMat);
    skull.scale.set(1.15, 0.95, 1.0);
    head.add(skull);
    const eyeL = mesh(new THREE.SphereGeometry(0.125, 16, 12), eyeMat);
    eyeL.position.set(-0.13, 0.02, 0.04);
    eyeL.scale.set(0.85, 1.05, 1.15);
    head.add(eyeL);
    const eyeR = eyeL.clone();
    eyeR.position.x *= -1;
    head.add(eyeR);
    const pupilL = mesh(new THREE.SphereGeometry(0.04, 8, 8), eyeIn);
    pupilL.position.set(-0.16, 0.02, 0.12);
    head.add(pupilL);
    const pupilR = pupilL.clone();
    pupilR.position.x *= -1;
    head.add(pupilR);

    const ant = (side) => {
      const g = new THREE.Group();
      const a1 = mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.14, 6), darkMat);
      a1.rotation.z = side * 0.7;
      a1.rotation.x = 0.4;
      a1.position.set(side * 0.06, 0.14, 0.08);
      g.add(a1);
      const arista = mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.16, 5), darkMat);
      arista.position.set(side * 0.12, 0.24, 0.02);
      arista.rotation.z = side * 0.9;
      g.add(arista);
      return g;
    };
    head.add(ant(-1));
    head.add(ant(1));

    const prob = new THREE.Group();
    const beak = mesh(new THREE.CylinderGeometry(0.025, 0.018, 0.18, 8), darkMat);
    beak.rotation.x = 1.15;
    beak.position.set(0, -0.12, 0.08);
    prob.add(beak);
    head.add(prob);
    this.joints.proboscis = prob;
    this.joints.head = head;

    const thorax = new THREE.Group();
    thorax.position.set(0, 0.28, 0.18);
    const th = mesh(new THREE.SphereGeometry(0.22, 18, 14), bodyMat);
    th.scale.set(0.95, 0.85, 1.15);
    thorax.add(th);
    const scut = mesh(new THREE.SphereGeometry(0.08, 10, 8), darkMat);
    scut.position.set(0, 0.12, -0.12);
    thorax.add(scut);

    const abdomen = new THREE.Group();
    abdomen.position.set(0, 0.22, -0.18);
    for (let i = 0; i < 5; i++) {
      const seg = mesh(
        new THREE.SphereGeometry(0.16 - i * 0.018, 12, 10),
        i % 2 === 0 ? bodyMat : stripeMat,
      );
      seg.scale.set(0.9, 0.75, 1.05);
      seg.position.set(0, -0.02 * i, -0.16 * i - 0.08);
      abdomen.add(seg);
    }
    this.joints.abdomen = abdomen;

    const mkLeg = (side, station, name) => {
      const root = new THREE.Group();
      const attachZ = [0.28, 0.12, -0.02][station];
      const attachY = 0.12;
      const attachX = side * 0.16;
      root.position.set(attachX, attachY, attachZ);
      const coxa = new THREE.Group();
      const coxaM = mesh(new THREE.CylinderGeometry(0.028, 0.022, 0.1, 6), legMat);
      coxaM.rotation.z = side * Math.PI / 2;
      coxa.add(coxaM);
      const femur = new THREE.Group();
      femur.position.set(side * 0.1, -0.02, 0);
      const femurM = mesh(new THREE.CylinderGeometry(0.018, 0.016, 0.32, 6), legMat);
      femurM.position.y = -0.16;
      femur.add(femurM);
      const tibia = new THREE.Group();
      tibia.position.set(0, -0.32, 0);
      const tibiaM = mesh(new THREE.CylinderGeometry(0.014, 0.01, 0.3, 6), legMat);
      tibiaM.position.y = -0.15;
      tibia.add(tibiaM);
      const tarsus = new THREE.Group();
      tarsus.position.set(0, -0.3, 0);
      const tarsusM = mesh(new THREE.CylinderGeometry(0.008, 0.006, 0.16, 5), legMat);
      tarsusM.position.y = -0.08;
      tarsus.add(tarsusM);
      tibia.add(tarsus);
      femur.add(tibia);
      coxa.add(femur);
      root.add(coxa);
      thorax.add(root);
      this.joints[name] = { root, coxa, femur, tibia, tarsus, side, station };
      return this.joints[name];
    };

    mkLeg(-1, 0, "L1");
    mkLeg(1, 0, "R1");
    mkLeg(-1, 1, "L2");
    mkLeg(1, 1, "R2");
    mkLeg(-1, 2, "L3");
    mkLeg(1, 2, "R3");

    const mkWing = (side) => {
      const g = new THREE.Group();
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.bezierCurveTo(0.15, 0.35, 0.7, 0.45, 0.95, 0.05);
      shape.bezierCurveTo(0.7, -0.12, 0.2, -0.08, 0, 0);
      const geo = new THREE.ShapeGeometry(shape);
      const w = mesh(geo, wingMat);
      w.rotation.z = 0.32;
      w.rotation.x = -0.18;
      w.position.set(0.07, 0, 0);
      g.position.set(0, 0.16, 0.04);
      g.scale.x = side;
      g.add(w);
      thorax.add(g);
      return g;
    };
    this.joints.wing_L = mkWing(-1);
    this.joints.wing_R = mkWing(1);

    const mkHalt = (side) => {
      const h = mesh(new THREE.SphereGeometry(0.03, 8, 8), darkMat);
      const stem = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 5), darkMat);
      stem.position.set(side * 0.1, 0.12, -0.08);
      stem.rotation.z = side * 0.6;
      h.position.set(side * 0.16, 0.18, -0.1);
      thorax.add(stem);
      thorax.add(h);
    };
    mkHalt(-1);
    mkHalt(1);

    this.rig.add(abdomen);
    this.rig.add(thorax);
    this.rig.add(head);
    this.joints.thorax = thorax;

    this._restPose();
  }

  _restPose() {
    for (const name of ["L1", "R1", "L2", "R2", "L3", "R3"]) {
      this._setLeg(name, { lift: 0, reach: 0, splay: 0.55 });
    }
    this.joints.proboscis.rotation.x = 0;
    this.joints.wing_L.rotation.x = 0;
    this.joints.wing_R.rotation.x = 0;
    this.joints.head.rotation.set(0, 0, 0);
    this.joints.abdomen.rotation.set(0, 0, 0);
  }

  _setLeg(name, { lift, reach, splay }) {
    const leg = this.joints[name];
    if (!leg) return;
    const side = leg.side;
    const station = leg.station;
    const baseSplay = 0.35 + station * 0.12;
    const baseReach = station === 0 ? 0.35 : station === 1 ? 0 : -0.4;
    leg.coxa.rotation.z = side * (baseSplay + splay * 0.25);
    leg.coxa.rotation.y = side * 0.05;
    leg.coxa.rotation.x = baseReach + reach;
    leg.femur.rotation.x = -0.85 - lift;
    leg.femur.rotation.z = 0;
    leg.tibia.rotation.x = 1.25 + lift * 0.45;
    leg.tarsus.rotation.x = 0.35;
  }

  _applyImportedJoints(joints) {
    for (const [name, val] of Object.entries(joints || {})) {
      if (name === "head" && this.joints.head) {
        this.joints.head.rotation.y = val.yaw || 0;
        this.joints.head.rotation.x = val.pitch || 0;
        continue;
      }
      if (name === "abdomen" && this.joints.abdomen) {
        this.joints.abdomen.rotation.x = val.pitch || val.value || 0;
        continue;
      }
      if (name === "proboscis" && this.joints.proboscis) {
        this.joints.proboscis.rotation.x = val.value || val.pitch || 0;
        continue;
      }
      if ((name === "wing_L" || name === "wing_R") && this.joints[name]) {
        this.joints[name].rotation.x = val.value || 0;
        continue;
      }
      const leg = this.joints[name];
      if (leg && leg.coxa) {
        if (val.coxa != null) leg.coxa.rotation.x = val.coxa;
        if (val.femur != null) leg.femur.rotation.x = val.femur;
        if (val.tibia != null) leg.tibia.rotation.x = val.tibia;
        if (val.tarsus != null) leg.tarsus.rotation.x = val.tarsus;
      }
    }
  }

  _tripod(phase, speed) {
    const A = Math.sin(phase);
    const B = Math.sin(phase + Math.PI);
    const reachA = A * 0.45 * Math.max(0.35, speed);
    const reachB = B * 0.45 * Math.max(0.35, speed);
    const liftA = Math.max(0, A) * 0.55;
    const liftB = Math.max(0, B) * 0.55;
    this._setLeg("L1", { lift: liftA, reach: reachA, splay: 0.5 });
    this._setLeg("R2", { lift: liftA, reach: reachA, splay: 0.5 });
    this._setLeg("L3", { lift: liftA, reach: reachA * 0.8, splay: 0.6 });
    this._setLeg("R1", { lift: liftB, reach: reachB, splay: 0.5 });
    this._setLeg("L2", { lift: liftB, reach: reachB, splay: 0.5 });
    this._setLeg("R3", { lift: liftB, reach: reachB * 0.8, splay: 0.6 });
  }

  apply(frame, controls, dt) {
    const c = this.clock;
    const body = frame.body || {};
    const importedJoints = body.joints && Object.keys(body.joints).length > 0;

    let gait = body.gait || c.gait || "idle";
    const walk = controls.walk_fwd || 0;
    const back = controls.walk_back || 0;
    const jump = controls.jump || 0;
    const halt = controls.halt || 0;
    const feed = controls.feed || 0;
    const flight = controls.flight || 0;
    const steer = (controls.steer_r || 0) - (controls.steer_l || 0);

    if (!body.gait) {
      if (c.airborne) gait = "jump";
      else if (halt > 0.4) gait = "idle";
      else if (jump > 0.4 && !c.airborne) gait = "jump";
      else if (flight > 0.3) gait = "flight";
      else if (feed > 0.25 && walk < 0.2) gait = "feed";
      else if (back > walk && back > 0.15) gait = "retreat";
      else if (walk > 0.12) gait = "walk";
      else gait = "idle";
    }
    c.gait = gait;

    if (body.position) {
      c.x = body.position[0];
      c.y = body.position[1];
      c.z = body.position[2];
    } else {
      const speed = gait === "retreat" ? -back * 1.6 : gait === "walk" ? walk * 1.8 : 0;
      c.yaw += steer * dt * 2.2;
      if (gait === "walk" || gait === "retreat") {
        c.x += Math.sin(c.yaw) * speed * dt;
        c.z += Math.cos(c.yaw) * speed * dt;
        const lim = 6.5;
        c.x = Math.max(-lim, Math.min(lim, c.x));
        c.z = Math.max(-lim, Math.min(lim, c.z));
      }
      if (gait === "jump" && !c.airborne && jump > 0.4) {
        c.vy = 4.2;
        c.airborne = true;
      }
      if (c.airborne) {
        c.vy -= 18 * dt;
        c.y += c.vy * dt;
        if (c.y <= 0) {
          c.y = 0;
          c.vy = 0;
          c.airborne = false;
        }
      } else if (gait === "flight") {
        c.y = 0.55 + 0.08 * Math.sin(frame.t * 8);
      } else if (c.y > 0 && !c.airborne) {
        c.y = Math.max(0, c.y - 4 * dt);
      }
    }
    if (body.yaw != null) c.yaw = body.yaw;
    else if (body.rotation) c.yaw = body.rotation[1] ?? body.rotation[0] ?? c.yaw;

    this.rig.position.set(c.x, c.y, c.z);
    this.rig.rotation.y = c.yaw;

    if (importedJoints) {
      this._applyImportedJoints(body.joints);
    } else {
      this._restPose();
      if (gait === "walk" || gait === "retreat") {
        const spd = Math.max(walk, back, 0.2);
        c.phase += dt * (8 + 10 * spd);
        this._tripod(c.phase, spd);
        this.joints.head.rotation.x = 0.08;
      } else if (gait === "jump") {
        const crouch = c.airborne ? 0.2 : 0.7;
        for (const name of ["L1", "R1", "L2", "R2", "L3", "R3"]) {
          this._setLeg(name, { lift: -crouch * 0.4, reach: 0, splay: 0.7 });
        }
        this.joints.abdomen.rotation.x = c.airborne ? -0.4 : 0.25;
        this.joints.wing_L.rotation.x = c.airborne ? 0.8 : 0;
        this.joints.wing_R.rotation.x = c.airborne ? 0.8 : 0;
      } else if (gait === "feed") {
        this.joints.proboscis.rotation.x = 0.9;
        this.joints.head.rotation.x = 0.35;
        this.joints.abdomen.rotation.x = 0.15;
      } else if (gait === "flight") {
        const flap = Math.sin(frame.t * 60) * 0.7;
        this.joints.wing_L.rotation.x = flap;
        this.joints.wing_R.rotation.x = -flap;
        this.joints.abdomen.rotation.x = -0.25;
      } else {
        const breathe = 0.04 * Math.sin(frame.t * 2.2);
        this.joints.abdomen.rotation.x = breathe;
      }
    }

    if (body.wings) {
      if (body.wings.L != null) this.joints.wing_L.rotation.x = (body.wings.L - 0.5) * 1.6;
      if (body.wings.R != null) this.joints.wing_R.rotation.x = (body.wings.R - 0.5) * 1.6;
    }

    this._syncPayload(frame.payload);
    this._orbitFollow();
  }

  _syncPayload(payload) {
    for (const m of this.markers) this.scene.remove(m);
    this.markers = [];
    if (this._pathLine) {
      this.scene.remove(this._pathLine);
      this._pathLine = null;
    }
    if (!payload) return;
    for (const mk of payload.markers || []) {
      const dot = mesh(
        new THREE.SphereGeometry(0.06, 10, 8),
        new THREE.MeshBasicMaterial({ color: mk.color || "#7ee0ff" }),
      );
      dot.position.set(mk.x, 0.06, mk.z);
      this.scene.add(dot);
      this.markers.push(dot);
    }
    if (payload.path && payload.path.length > 1) {
      const pts = payload.path.map((p) => new THREE.Vector3(p[0], 0.02, p[1]));
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      this._pathLine = new THREE.Line(
        geo,
        new THREE.LineBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.7 }),
      );
      this.scene.add(this._pathLine);
    }
  }

  _orbitFollow() {
    const cx = this.rig.position.x;
    const cz = this.rig.position.z;
    this.look.set(cx, 0.35 + this.clock.y * 0.3, cz);
    const x = this.look.x + Math.sin(this.yaw) * Math.cos(this.pitch) * this.dist;
    const y = this.look.y + Math.sin(this.pitch) * this.dist;
    const z = this.look.z + Math.cos(this.yaw) * Math.cos(this.pitch) * this.dist;
    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.look);
  }

  resize() {
    const w = Math.max(1, this.canvas.clientWidth);
    const h = Math.max(1, this.canvas.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
