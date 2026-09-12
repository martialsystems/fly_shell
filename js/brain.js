/** Side panel: full MaleCNS soma cloud as one Points draw. Named cells stay pickable. */

import * as THREE from "../vendor/three.module.js";
import { REGIONS } from "./atlas.js";
import {
  parseSomaPack,
  indexByType,
  fillBaseColors,
  litTypesFromNeurons,
  stripSide,
} from "./soma.js";

const IDLE = new THREE.Color(0x1a2430);
const FIRE = new THREE.Color(0xffd76a);
const HOT = new THREE.Color(0xfff4c8);
const SEL = new THREE.Color(0x7ee0ff);
const MAPPED = new THREE.Color(0xff8ad4);

function volumeMesh(geo, color) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    transparent: true,
    opacity: 0.045,
    roughness: 0.4,
    metalness: 0.1,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  return new THREE.Mesh(geo, mat);
}

function fireColor(rate, out) {
  const u = Math.min(1, rate);
  out.copy(IDLE).lerp(FIRE, u);
  if (u > 0.75) out.lerp(HOT, (u - 0.75) / 0.25);
  return out;
}

export class BrainView {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x07080c);
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.05, 40);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.sortObjects = false;

    this.yaw = 0.55;
    this.pitch = 0.22;
    this.dist = 5.4;
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;
    this.selectedId = null;
    this.onPick = null;
    this.nodes = {};
    this.ray = new THREE.Raycaster();
    this.ray.params.Points = { threshold: 0.035 };
    this.pointer = new THREE.Vector2();
    this._tmp = new THREE.Color();
    this.pack = null;
    this.typeIndex = new Map();
    this.baseColors = null;
    this.liveColors = null;
    this._hot = [];
    this.somaCount = 0;
    this.cloud = null;
    this.named = new THREE.Group();

    this.scene.add(new THREE.AmbientLight(0x8899aa, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 0.45);
    key.position.set(2, 4, 3);
    this.scene.add(key);

    this.shell = new THREE.Group();
    this.scene.add(this.shell);
    this.scene.add(this.named);

    this._cnsShell();
    this._bind();
    this.resize();
    this._orbit();
  }

  _cnsShell() {
    const brain = volumeMesh(new THREE.SphereGeometry(0.62, 24, 18), 0x7ee0ff);
    brain.scale.set(1.15, 0.85, 1.05);
    brain.position.set(0, 0.05, 0.28);
    this.shell.add(brain);
    const ol = volumeMesh(new THREE.SphereGeometry(0.38, 18, 14), 0x3ec7ff);
    ol.position.set(-0.92, 0.06, 0.42);
    this.shell.add(ol);
    const or_ = ol.clone();
    or_.position.x *= -1;
    this.shell.add(or_);
    const gng = volumeMesh(new THREE.SphereGeometry(0.28, 14, 12), 0xff8ad4);
    gng.scale.set(1.1, 0.7, 0.8);
    gng.position.set(0, -0.22, 0.08);
    this.shell.add(gng);
    const vnc = volumeMesh(new THREE.CylinderGeometry(0.22, 0.12, 1.7, 14), 0x7ee0ff);
    vnc.position.set(0, -0.08, -1.15);
    vnc.rotation.x = Math.PI / 2;
    this.shell.add(vnc);
  }

  setAtlas(atlas) {
    while (this.named.children.length) {
      const ch = this.named.children[0];
      this.named.remove(ch);
      if (ch.geometry) ch.geometry.dispose();
    }
    this.nodes = {};
    const geo = new THREE.SphereGeometry(0.028, 8, 6);
    for (const n of Object.values(atlas.neurons || {})) {
      const color = new THREE.Color(n.color || (REGIONS[n.region] || {}).color || "#ffd76a");
      const mat = new THREE.MeshBasicMaterial({ color: IDLE });
      const m = new THREE.Mesh(geo, mat);
      const xyz = this._namedXyz(n);
      m.position.set(xyz[0], xyz[1], xyz[2]);
      m.userData.id = n.id;
      m.userData.type = n.type;
      m.userData.base = color;
      this.named.add(m);
      this.nodes[n.id] = m;
    }
  }

  _namedXyz(n) {
    if (this.typeIndex.size && n.type) {
      const idxs = this.typeIndex.get(n.type);
      if (idxs && idxs.length) {
        const wantRight = /_R$/.test(n.id);
        const wantLeft = /_L$/.test(n.id);
        let best = idxs[0];
        if (wantLeft || wantRight) {
          let scored = best;
          let sx = wantRight ? -Infinity : Infinity;
          for (let k = 0; k < idxs.length; k++) {
            const i = idxs[k];
            const x = this.pack.positions[i * 3];
            if (wantRight && x > sx) {
              sx = x;
              scored = i;
            } else if (wantLeft && x < sx) {
              sx = x;
              scored = i;
            }
          }
          best = scored;
        }
        return [
          this.pack.positions[best * 3],
          this.pack.positions[best * 3 + 1],
          this.pack.positions[best * 3 + 2],
        ];
      }
    }
    return n.xyz || [0, 0, 0];
  }

  async loadCloud(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("soma pack HTTP " + res.status);
    const buf = await res.arrayBuffer();
    this.setCloud(parseSomaPack(buf));
  }

  setCloud(pack) {
    if (this.cloud) {
      this.scene.remove(this.cloud);
      this.cloud.geometry.dispose();
      this.cloud.material.dispose();
    }
    this.pack = pack;
    this.somaCount = pack.count;
    this.typeIndex = indexByType(pack);
    this.baseColors = fillBaseColors(pack, new Float32Array(pack.count * 3));
    this.liveColors = new Float32Array(this.baseColors);
    this._hot = [];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pack.positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(this.liveColors, 3));
    geo.computeBoundingSphere();
    const mat = new THREE.PointsMaterial({
      size: 4.4,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });
    this.cloud = new THREE.Points(geo, mat);
    this.cloud.frustumCulled = true;
    this.scene.add(this.cloud);
    this.shell.visible = false;
    for (const n of Object.values(this.nodes)) {
      const rec = { id: n.userData.id, type: n.userData.type, xyz: [n.position.x, n.position.y, n.position.z] };
      const xyz = this._namedXyz(rec);
      n.position.set(xyz[0], xyz[1], xyz[2]);
    }
  }

  apply(neurons, mappedIds, firingOnly) {
    const mapped = mappedIds || new Set();
    if (this.liveColors && this.pack) {
      for (let h = 0; h < this._hot.length; h++) {
        const i = this._hot[h];
        this.liveColors[i * 3] = this.baseColors[i * 3];
        this.liveColors[i * 3 + 1] = this.baseColors[i * 3 + 1];
        this.liveColors[i * 3 + 2] = this.baseColors[i * 3 + 2];
      }
      this._hot.length = 0;
      const lit = litTypesFromNeurons(neurons);
      for (const [key, rate] of lit) {
        const idxs = this.typeIndex.get(key);
        if (!idxs) continue;
        fireColor(rate, this._tmp);
        const r = this._tmp.r;
        const g = this._tmp.g;
        const b = this._tmp.b;
        for (let k = 0; k < idxs.length; k++) {
          const i = idxs[k];
          this.liveColors[i * 3] = r;
          this.liveColors[i * 3 + 1] = g;
          this.liveColors[i * 3 + 2] = b;
          this._hot.push(i);
        }
      }
      if (this.selectedId) {
        const selType = stripSide(this.selectedId);
        const idxs = this.typeIndex.get(selType) || this.typeIndex.get(this.selectedId);
        if (idxs && idxs.length) {
          const i = idxs[0];
          this.liveColors[i * 3] = SEL.r;
          this.liveColors[i * 3 + 1] = SEL.g;
          this.liveColors[i * 3 + 2] = SEL.b;
          this._hot.push(i);
        }
      }
      this.cloud.geometry.attributes.color.needsUpdate = true;
      this.cloud.visible = !firingOnly;
    }

    for (const [id, mesh] of Object.entries(this.nodes)) {
      const rec = neurons[id];
      const rate = rec ? rec.rate : 0;
      const typeRate = neurons[id] ? rate : this._typeRate(neurons, mesh.userData.type);
      const u = Math.max(rate, typeRate);
      mesh.visible = !firingOnly || u >= 0.15 || id === this.selectedId || mapped.has(id) || mapped.has(mesh.userData.type);
      fireColor(u, this._tmp);
      if (mapped.has(id) && u < 0.2) this._tmp.copy(MAPPED);
      if (id === this.selectedId) this._tmp.copy(SEL);
      mesh.material.color.copy(this._tmp);
      mesh.scale.setScalar(0.7 + u * 1.4);
    }
  }

  _typeRate(neurons, type) {
    if (!type) return 0;
    let m = 0;
    for (const rec of Object.values(neurons)) {
      if (rec.type === type || rec.id === type || stripSide(rec.id) === type) {
        if (rec.rate > m) m = rec.rate;
      }
    }
    return m;
  }

  _bind() {
    const el = this.canvas;
    el.addEventListener("pointerdown", (e) => {
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this._moved = 0;
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    });
    el.addEventListener("pointermove", (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this._moved += Math.abs(dx) + Math.abs(dy);
      this.yaw += dx * 0.008;
      this.pitch = Math.max(-0.9, Math.min(1.2, this.pitch + dy * 0.006));
    });
    el.addEventListener("pointerup", (e) => {
      this.dragging = false;
      if (this._moved < 6) this._pick(e);
    });
    el.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.dist = Math.max(2.4, Math.min(12, this.dist + e.deltaY * 0.005));
      },
      { passive: false },
    );
  }

  _pick(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.ray.setFromCamera(this.pointer, this.camera);
    const namedHits = this.ray.intersectObjects(this.named.children, false);
    if (namedHits.length) {
      this.selectedId = namedHits[0].object.userData.id;
      if (this.onPick) this.onPick(this.selectedId);
      return;
    }
    if (this.cloud) {
      const hits = this.ray.intersectObject(this.cloud, false);
      if (hits.length && hits[0].index != null && this.pack) {
        const i = hits[0].index;
        const type = this.pack.types[this.pack.typeIds[i]] || String(i);
        this.selectedId = type;
        if (this.onPick) this.onPick(type);
        return;
      }
    }
    this.selectedId = null;
    if (this.onPick) this.onPick(null);
  }

  _orbit() {
    const x = Math.sin(this.yaw) * Math.cos(this.pitch) * this.dist;
    const y = Math.sin(this.pitch) * this.dist + 0.1;
    const z = Math.cos(this.yaw) * Math.cos(this.pitch) * this.dist;
    this.camera.position.set(x, y, z);
    this.camera.lookAt(0, 0, -0.55);
  }

  resize() {
    const w = Math.max(1, this.canvas.clientWidth);
    const h = Math.max(1, this.canvas.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  render() {
    this._orbit();
    this.renderer.render(this.scene, this.camera);
  }
}
