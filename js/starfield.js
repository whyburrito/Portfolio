/* ============================================================
   starfield.js — sparkle particles + drag-to-spin with inertia
   Loaded as an ES module; Three.js resolved via importmap.
   ============================================================ */

import * as THREE from "three";

const canvas = document.getElementById("bg");
const prefersReduced = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  1,
  1200
);
camera.position.z = 380;
camera.lookAt(0, 0, 0);

let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
} catch (err) {
  // WebGL blocked or unsupported: keep the CSS gradient backdrop and bail out cleanly.
  console.warn("Starfield background disabled — WebGL is unavailable.", err);
  if (canvas) canvas.style.display = "none";
}

/* ---------- Soft sparkle texture (circular glow + cross) ---------- */
function createSparkleTexture() {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  const mid = size / 2;

  const glow = ctx.createRadialGradient(mid, mid, 0, mid, mid, mid);
  glow.addColorStop(0, "rgba(255,255,255,1)");
  glow.addColorStop(0.12, "rgba(255,255,255,0.95)");
  glow.addColorStop(0.35, "rgba(255,255,255,0.35)");
  glow.addColorStop(0.65, "rgba(255,255,255,0.08)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  ctx.globalCompositeOperation = "lighter";
  const spike = ctx.createLinearGradient(mid, 0, mid, size);
  spike.addColorStop(0, "rgba(255,255,255,0)");
  spike.addColorStop(0.45, "rgba(255,255,255,0.55)");
  spike.addColorStop(0.5, "rgba(255,255,255,0.95)");
  spike.addColorStop(0.55, "rgba(255,255,255,0.55)");
  spike.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = spike;
  ctx.fillRect(mid - 1.5, 0, 3, size);

  const spikeH = ctx.createLinearGradient(0, mid, size, mid);
  spikeH.addColorStop(0, "rgba(255,255,255,0)");
  spikeH.addColorStop(0.45, "rgba(255,255,255,0.55)");
  spikeH.addColorStop(0.5, "rgba(255,255,255,0.95)");
  spikeH.addColorStop(0.55, "rgba(255,255,255,0.55)");
  spikeH.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = spikeH;
  ctx.fillRect(0, mid - 1.5, size, 3);

  const texture = new THREE.CanvasTexture(c);
  texture.needsUpdate = true;
  return texture;
}

const sparkleMap = createSparkleTexture();

/* ---------- Build a layer of points ---------- */
function makeStarLayer(count, spread, size, color, opacity) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i++) {
    positions[i] = (Math.random() - 0.5) * spread;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    size,
    color,
    map: sparkleMap,
    transparent: true,
    opacity,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  return new THREE.Points(geometry, material);
}

function makeTrailFrom(source, opacityScale, sizeScale) {
  const material = source.material.clone();
  material.opacity = source.material.opacity * opacityScale;
  material.size = source.material.size * sizeScale;
  return new THREE.Points(source.geometry, material);
}

const whiteStars = makeStarLayer(2600, 1400, 2.2, 0xd8dce8, 0.8);
const goldStars = makeStarLayer(700, 1000, 3.2, 0xc4a574, 0.6);

const whiteBase = { size: 2.2, opacity: 0.8 };
const goldBase = { size: 3.2, opacity: 0.6 };

const starfield = new THREE.Group();
starfield.add(whiteStars);
starfield.add(goldStars);
scene.add(starfield);

/* Ghost trail layers that lag behind during fast spins */
const trailConfigs = [
  { lag: 3.5, opacity: 0.28, size: 0.95 },
  { lag: 7, opacity: 0.14, size: 0.85 },
  { lag: 11, opacity: 0.07, size: 0.75 },
];

const trails = trailConfigs.map((cfg) => {
  const group = new THREE.Group();
  const whiteTrail = makeTrailFrom(whiteStars, cfg.opacity, cfg.size);
  const goldTrail = makeTrailFrom(goldStars, cfg.opacity, cfg.size);
  group.add(whiteTrail);
  group.add(goldTrail);
  group.visible = false;
  scene.add(group);
  return {
    group,
    lag: cfg.lag,
    white: whiteTrail,
    gold: goldTrail,
    whiteOpacity: whiteBase.opacity * cfg.opacity,
    goldOpacity: goldBase.opacity * cfg.opacity,
  };
});

/* ---------- Ambient drift + drag inertia ---------- */
/* Very slow idle drift so the field feels calm by default */
const AMBIENT = { x: 0.00018, y: 0.00042 };
const FRICTION = 0.991;
const MAX_VEL = 0.12;
const DRAG_SCALE = 0.0045;

const rotVel = { x: AMBIENT.x, y: AMBIENT.y };
let dragging = false;
let lastPointer = { x: 0, y: 0 };

function isInteractiveTarget(target) {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      "a, button, input, textarea, select, label, [download], .nav, .btn, .nav__toggle"
    )
  );
}

function clampVel(v) {
  return Math.max(-MAX_VEL, Math.min(MAX_VEL, v));
}

if (!prefersReduced) {
  window.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    if (isInteractiveTarget(e.target)) return;
    dragging = true;
    lastPointer.x = e.clientX;
    lastPointer.y = e.clientY;
    document.body.classList.add("is-dragging-stars");
  });

  window.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastPointer.x;
    const dy = e.clientY - lastPointer.y;
    lastPointer.x = e.clientX;
    lastPointer.y = e.clientY;

    rotVel.y = clampVel(dx * DRAG_SCALE);
    rotVel.x = clampVel(dy * DRAG_SCALE);

    starfield.rotation.y += rotVel.y;
    starfield.rotation.x += rotVel.x;
  });

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    document.body.classList.remove("is-dragging-stars");
  }

  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);
}

/* ---------- Animation loop ---------- */
function animate() {
  requestAnimationFrame(animate);

  if (!dragging) {
    if (!prefersReduced) {
      rotVel.x = rotVel.x * FRICTION + AMBIENT.x * (1 - FRICTION);
      rotVel.y = rotVel.y * FRICTION + AMBIENT.y * (1 - FRICTION);
    } else {
      rotVel.x = AMBIENT.x * 0.35;
      rotVel.y = AMBIENT.y * 0.35;
    }

    starfield.rotation.x += rotVel.x;
    starfield.rotation.y += rotVel.y;
  }

  const speed = Math.hypot(rotVel.x, rotVel.y);
  const bloom = Math.min(1, speed / (MAX_VEL * 0.55));
  const trailStrength = Math.min(1, Math.max(0, (speed - 0.004) / 0.035));

  whiteStars.material.size = whiteBase.size * (1 + bloom * 1.35);
  whiteStars.material.opacity = whiteBase.opacity * (1 + bloom * 0.45);
  goldStars.material.size = goldBase.size * (1 + bloom * 1.6);
  goldStars.material.opacity = goldBase.opacity * (1 + bloom * 0.55);

  // Motion trails: lag behind main rotation, visible only when spinning
  trails.forEach((trail) => {
    const show = !prefersReduced && trailStrength > 0.02;
    trail.group.visible = show;
    if (!show) return;

    trail.group.rotation.x = starfield.rotation.x - rotVel.x * trail.lag;
    trail.group.rotation.y = starfield.rotation.y - rotVel.y * trail.lag;

    trail.white.material.opacity = trail.whiteOpacity * trailStrength;
    trail.gold.material.opacity = trail.goldOpacity * trailStrength;
    trail.white.material.size = whiteStars.material.size * 0.9;
    trail.gold.material.size = goldStars.material.size * 0.9;
  });

  renderer.render(scene, camera);
}
if (renderer) animate();

/* ---------- Resize ---------- */
window.addEventListener("resize", () => {
  if (!renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});
