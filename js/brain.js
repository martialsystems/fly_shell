/** Side panel: schematic CNS neuron map. Click a cell to bind it. */

import * as THREE from "../vendor/three.module.js";
import { REGIONS } from "./atlas.js";

const IDLE = new THREE.Color(0x1a2430);
const FIRE = new THREE.Color(0xffd76a);
const HOT = new THREE.Color(0xfff4c8);
const SEL = new THREE.Color(0x7ee0ff);
const MAPPED = new THREE.Color(0xff8ad4);

function volumeMesh(geo, color) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    transparent: true,
    opacity: 0.09,
    roughness: 0.4,
    metalness: 0.1,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  return new THREE.Mesh(geo, mat);
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

    this.yaw = 0.55;
    this.pitch = 0.25;
    this.dist = 4.6;
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;
    this.selectedId = null;
    this.onPick = null;
    this.nodes = {};
    this.ray = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this._tmp = new THREE.Color();

    this.scene.add(new THREE.AmbientLight(0x8899aa, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(2, 4, 3);
    this.scene.add(key);
    const glow = new THREE.PointLight(0x7ee0ff, 0.8, 8);
    glow.position.set(0, 0.4, 0.2);
    this.scene.add(glow);

    this.shell = new THREE.Group();
    this.scene.add(this.shell);
    this.cloud = new THREE.Group();
    this.scene.add(this.cloud);

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
    for (const z of [-0.55, -0.95, -1.35]) {
      const bulge = volumeMesh(new THREE.SphereGeometry(0.28, 12, 10), 0x7ee0ff);
      bulge.scale.set(1.15, 0.7, 0.7);
      bulge.position.set(0, -0.1, z);
      this.shell.add(bulge);
    }
  }

  setAtlas(atlas) {
    while (this.cloud.children.length) {
      const ch = this.cloud.children[0];
      this.cloud.remove(ch);
      if (ch.geometry) ch.geometry.dispose();
    }
    this.nodes = {};
    const geo = new THREE.SphereGeometry(0.035, 10, 8);
    for (const n of Object.values(atlas.neurons || {})) {
      const color = new THREE.Color(n.color || (REGIONS[n.region] || {}).color || "#ffd76a");
      const mat = new THREE.MeshStandardMaterial({
        color: IDLE,
        emissive: IDLE,
        emissiveIntensity: 0.2,
        roughness: 0.35,
        metalness: 0.1,
      });
      const m = new THREE.Mesh(geo, mat);
      const xyz = n.xyz || [0, 0, 0];
      m.position.set(xyz[0], xyz[1], xyz[2]);
      m.userData.id = n.id;
      m.userData.base = color;
      this.cloud.add(m);
      this.nodes[n.id] = m;
    }
  }

  apply(neurons, mappedIds, firingOnly) {
    const mapped = mappedIds || new Set();
    for (const [id, mesh] of Object.entries(this.nodes)) {
      const rec = neurons[id];
      const rate = rec ? rec.rate : 0;
      mesh.visible = !firingOnly || rate >= 0.15 || id === this.selectedId || mapped.has(id);
      const u = Math.min(1, rate);
      this._tmp.copy(IDLE).lerp(FIRE, u);
      if (u > 0.75) this._tmp.lerp(HOT, (u - 0.75) / 0.25);
      if (mapped.has(id) && u < 0.2) this._tmp.copy(MAPPED);
      if (id === this.selectedId) this._tmp.copy(SEL);
      mesh.material.color.copy(this._tmp);
      mesh.material.emissive.copy(this._tmp);
      mesh.material.emissiveIntensity = 0.25 + u * 1.8;
      const s = 0.85 + u * 1.6;
      mesh.scale.setScalar(s);
    }
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
        this.dist = Math.max(2.2, Math.min(10, this.dist + e.deltaY * 0.005));
      },
      { passive: false },
    );
  }

  _pick(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.ray.setFromCamera(this.pointer, this.camera);
    const hits = this.ray.intersectObjects(this.cloud.children, false);
    const id = hits.length ? hits[0].object.userData.id : null;
    this.selectedId = id;
    if (this.onPick) this.onPick(id);
  }

  _orbit() {
    const x = Math.sin(this.yaw) * Math.cos(this.pitch) * this.dist;
    const y = Math.sin(this.pitch) * this.dist + 0.1;
    const z = Math.cos(this.yaw) * Math.cos(this.pitch) * this.dist;
    this.camera.position.set(x, y, z);
    this.camera.lookAt(0, 0, -0.2);
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
