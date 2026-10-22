import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/* GLITCH LAB — draggable 3D electronics workbench */
const $ = (id) => document.getElementById(id);
const canvas = $("circuitCanvas");
const viewport = $("sceneViewport");
const storageKey = "glitchLab3DCircuit";
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const terminalObjects = [];
const componentObjects = new Map();
const wireObjects = [];
const activeFlowDots = [];
const palette = {
  led: { title: "Светодиод", color: 0xe7777f },
  resistor: { title: "Резистор", color: 0xd9b477 },
  battery: { title: "Батарейка", color: 0x9caee2 },
  switch: { title: "Выключатель", color: 0x9ab8b0 },
  capacitor: { title: "Конденсатор", color: 0x8e9bc1 }
};
let scene, camera, renderer, controls, boardGroup, componentGroup, wireGroup, gridGroup;
let placementType = null;
let selectedPartId = null;
let isPaletteDragging = false;
let palettePointer = null;
let dragGhost = null;
let dragPreviewRenderer = null;
let placementTargets = null;
let showGrid = true;
let voltage = 5;
let resistance = 220;
let solved = false;
let currentActive = false;
let parts = [];
let wires = [];
let nextId = 1;
let pointerDown = null;
let dragCandidate = null;
let draggingPartId = null;
let dragOffset = new THREE.Vector3();
let dragLastWireUpdate = 0;
let ambientParticles = [];

let boardWidth = 12;
let boardDepth = 8;
const BOARD_SIZES = { compact: [12, 8], studio: [15.6, 10.08], xl: [18.48, 12.24] };
const boardBounds = () => ({ minX: -boardWidth / 2 + 0.6, maxX: boardWidth / 2 - 0.6, minZ: -boardDepth / 2 + 0.76, maxZ: boardDepth / 2 - 0.76 });
const terminalRadius = 0.09;

function init() {
  try {
    scene = new THREE.Scene();
    scene.background = new THREE.Color("#f3f5fb");
    scene.fog = new THREE.Fog("#f3f5fb", 16, 31);
    camera = new THREE.PerspectiveCamera(38, viewport.clientWidth / viewport.clientHeight, 0.1, 100);
    camera.position.set(10.5, 11.5, 12.5);
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    renderer.setSize(viewport.clientWidth, viewport.clientHeight, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    const hemi = new THREE.HemisphereLight(0xffffff, 0xd4d8e7, 2.2);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 3.1);
    key.position.set(-5, 13, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -10; key.shadow.camera.right = 10;
    key.shadow.camera.top = 10; key.shadow.camera.bottom = -10;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xd6dcff, 1.2);
    fill.position.set(7, 6, -7);
    scene.add(fill);
    const warm = new THREE.PointLight(0xffd5bd, 0.7, 18);
    warm.position.set(-5, 5, -4);
    scene.add(warm);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: "#f3f5fb", roughness: 0.96 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.68;
    ground.receiveShadow = true;
    scene.add(ground);

    boardGroup = new THREE.Group();
    scene.add(boardGroup);
    componentGroup = new THREE.Group();
    scene.add(componentGroup);
    wireGroup = new THREE.Group();
    scene.add(wireGroup);
    gridGroup = new THREE.Group();
    boardGroup.add(gridGroup);
    buildBoard();
    buildPlacementTargets();
    buildAmbientParticles();
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.065;
    controls.minDistance = 6.2;
    controls.maxDistance = 20;
    controls.maxPolarAngle = Math.PI * 0.47;
    controls.target.set(0, 0, 0);
    controls.update();

    restore();
    rebuildAll();
    bindUI();
    resize();
    $("engineStatus").textContent = "3D-мастерская готова";
    $("engineStatusDot").parentElement.classList.add("ready");
    $("sceneLoading").classList.add("hidden");
    animate();
  } catch (error) {
    console.error("GLITCH LAB 3D initialization failed:", error);
    const detail = error && error.message ? String(error.message) : "Неизвестная ошибка";
    $("sceneLoading").innerHTML = "<strong>Не удалось запустить 3D</strong><small></small>";
    $("sceneLoading").querySelector("small").textContent = "Ошибка: " + detail + ". Проверь загрузку Three.js и обнови страницу.";
    $("engineStatus").textContent = "Ошибка запуска 3D: " + detail;
  }
}

function mat(color, roughness = 0.55, metalness = 0.02) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}
function roundedBox(width, height, depth, radius, material) {
  const shape = new THREE.Shape();
  const x = -width / 2, y = -depth / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + depth - radius);
  shape.quadraticCurveTo(x + width, y + depth, x + width - radius, y + depth);
  shape.lineTo(x + radius, y + depth);
  shape.quadraticCurveTo(x, y + depth, x, y + depth - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.035, bevelThickness: 0.035, curveSegments: 4 });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, height, 0);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
function buildBoard() {
  const base = new THREE.Mesh(new THREE.BoxGeometry(boardWidth + 0.5, 0.42, boardDepth + 0.5), mat("#d7dce8", 0.72));
  base.position.y = -0.27; base.castShadow = true; base.receiveShadow = true; boardGroup.add(base);
  const pcb = new THREE.Mesh(new THREE.BoxGeometry(boardWidth, 0.22, boardDepth), mat("#a9c9bb", 0.8));
  pcb.position.y = 0; pcb.castShadow = true; pcb.receiveShadow = true; boardGroup.add(pcb);
  const inset = new THREE.Mesh(new THREE.BoxGeometry(boardWidth - 0.22, 0.018, boardDepth - 0.22), mat("#bad7ca", 0.85));
  inset.position.y = 0.118; boardGroup.add(inset);
  const boardRim = new THREE.Mesh(new THREE.BoxGeometry(boardWidth + 0.08, 0.055, boardDepth + 0.08), mat("#8eafa0", 0.48, 0.08));
  boardRim.position.y = -0.035; boardRim.castShadow = true; boardRim.receiveShadow = true; boardGroup.add(boardRim);
  const powerRailRed = mat("#df9296", 0.58);
  const powerRailBlue = mat("#8ba7dc", 0.58);
  for (const z of [-3.0, 3.0]) {
    const railA = new THREE.Mesh(new THREE.BoxGeometry(boardWidth - 0.5, 0.022, 0.055), powerRailRed);
    railA.position.set(0, 0.151, z - 0.065); boardGroup.add(railA);
    const railB = new THREE.Mesh(new THREE.BoxGeometry(boardWidth - 0.5, 0.022, 0.055), powerRailBlue);
    railB.position.set(0, 0.151, z + 0.065); boardGroup.add(railB);
  }
  const edgeMat = mat("#8db6a4", 0.65);
  for (const x of [-boardWidth / 2 + 0.08, boardWidth / 2 - 0.08]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, boardDepth - 0.5), edgeMat);
    rail.position.set(x, 0.14, 0); boardGroup.add(rail);
  }
  const holeMat = mat("#658b7b", 0.5, 0.08);
  const holeInner = mat("#466e61", 0.72);
  const holePositions = [];
  const bounds = boardBounds();
  for (let x = bounds.minX; x <= bounds.maxX + 0.001; x += 0.36) {
    for (let z = bounds.minZ; z <= bounds.maxZ + 0.001; z += 0.36) holePositions.push([x, z]);
  }
  const ringInstances = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.064, 0.064, 0.018, 12), holeMat, holePositions.length);
  const holeInstances = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.033, 0.033, 0.02, 12), holeInner, holePositions.length);
  const instanceTransform = new THREE.Object3D();
  holePositions.forEach(([x, z], index) => {
    instanceTransform.position.set(x, 0.143, z);
    instanceTransform.updateMatrix();
    ringInstances.setMatrixAt(index, instanceTransform.matrix);
    instanceTransform.position.set(x, 0.154, z);
    instanceTransform.updateMatrix();
    holeInstances.setMatrixAt(index, instanceTransform.matrix);
  });
  ringInstances.instanceMatrix.needsUpdate = true;
  holeInstances.instanceMatrix.needsUpdate = true;
  boardGroup.add(ringInstances, holeInstances);
  const silk = mat("#f1fbf5", 0.7);
  for (let i = 0; i < 10; i++) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.012, 0.2), silk);
    stripe.position.set(-4.4 + i * 0.96, 0.143, -3.78); boardGroup.add(stripe);
  }
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 512; labelCanvas.height = 128;
  const ctx = labelCanvas.getContext("2d");
  ctx.clearRect(0, 0, 512, 128);
  ctx.fillStyle = "#f4fff8"; ctx.font = "700 42px Arial"; ctx.fillText("GLITCH LAB", 10, 52);
  ctx.fillStyle = "#e5f5ec"; ctx.font = "20px Arial"; ctx.fillText("ELECTRONICS · EXPERIMENT BOARD", 12, 88);
  const texture = new THREE.CanvasTexture(labelCanvas); texture.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 0.82), new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide }));
  label.rotation.x = -Math.PI / 2; label.position.set(0, 0.145, 3.52); boardGroup.add(label);
  const gridMaterial = new THREE.LineBasicMaterial({ color: "#f1fff6", transparent: true, opacity: 0.34 });
  const bounds = boardBounds();
  for (let x = bounds.minX; x <= bounds.maxX + 0.001; x += 0.72) {
    const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 0.151, bounds.minZ - 0.16), new THREE.Vector3(x, 0.151, bounds.maxZ + 0.16)]);
    gridGroup.add(new THREE.Line(geometry, gridMaterial));
  }
  for (let z = bounds.minZ; z <= bounds.maxZ + 0.001; z += 0.72) {
    const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(bounds.minX, 0.151, z), new THREE.Vector3(bounds.maxX, 0.151, z)]);
    gridGroup.add(new THREE.Line(geometry, gridMaterial));
  }
  const screwMat = mat("#a9b3c3", 0.25, 0.45);
  for (const x of [-boardWidth / 2 + 0.2, boardWidth / 2 - 0.2]) for (const z of [-boardDepth / 2 + 0.2, boardDepth / 2 - 0.2]) {
    const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.05, 24), screwMat);
    screw.position.set(x, 0.0, z); screw.castShadow = true; boardGroup.add(screw);
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.01, 0.025), mat("#7c8799", 0.4, 0.2));
    slot.position.set(x, 0.031, z); boardGroup.add(slot);
  }
}
function buildPlacementTargets() {
  // Only two contacts are shown: the pair belonging to the component being held.
  // The pair moves with the snapped placement position instead of lighting the whole board.
  placementTargets = new THREE.Group();
  placementTargets.visible = false;
  placementTargets.userData.contactMarkers = [];
  for (let i = 0; i < 2; i++) {
    const marker = new THREE.Group();
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: i === 0 ? "#ff8b67" : "#8978ff",
      transparent: true, opacity: 0.38, depthTest: false, depthWrite: false
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.019, 12, 40), haloMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.205;
    ring.renderOrder = 20;
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: i === 0 ? "#ffb29a" : "#b9b0ff",
      transparent: true, opacity: 0.58, depthTest: false, depthWrite: false
    });
    const core = new THREE.Mesh(new THREE.CircleGeometry(0.055, 28), coreMaterial);
    core.rotation.x = -Math.PI / 2;
    core.position.y = 0.209;
    core.renderOrder = 21;
    marker.add(ring, core);
    marker.userData.ring = ring;
    marker.userData.core = core;
    marker.userData.phase = i * 1.35;
    placementTargets.userData.contactMarkers.push(marker);
    placementTargets.add(marker);
  }
  boardGroup.add(placementTargets);
}
function setPlacementTargets(visible) {
  if (!placementTargets) return;
  placementTargets.visible = Boolean(visible);
}
function updatePlacementTargets(event) {
  if (!placementTargets || !event) return;
  const snapped = hitBoard(event);
  if (!snapped) return;
  placementTargets.position.set(snapped.x, 0, snapped.z);
  placementTargets.userData.contactMarkers.forEach((marker, index) => {
    marker.position.set(index === 0 ? -0.72 : 0.72, 0, 0);
  });
  placementTargets.visible = true;
}

function buildAmbientParticles() {
  const particleGroup = new THREE.Group();
  const geometry = new THREE.SphereGeometry(0.025, 8, 6);
  const colors = ["#d8cfff", "#f6c7bf", "#c7e8d6", "#c9d7fa"];
  for (let i = 0; i < 26; i++) {
    const material = new THREE.MeshBasicMaterial({ color: colors[i % colors.length], transparent: true, opacity: 0.4 + (i % 3) * 0.12 });
    const particle = new THREE.Mesh(geometry, material);
    particle.position.set((Math.sin(i * 8.17) * 7.1), 0.4 + (i % 6) * 0.42, Math.cos(i * 4.73) * 5.2);
    particle.userData.floatOffset = i * 0.63;
    particle.userData.baseY = particle.position.y;
    particleGroup.add(particle);
    ambientParticles.push(particle);
  }
  scene.add(particleGroup);
}
function makeTerminal(color = "#b8c3d2") {
  const group = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.14, 20), mat("#aeb9c8", 0.2, 0.86));
  stem.position.y = 0.045; group.add(stem);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.068, 28, 18), mat(color, 0.17, 0.42));
  cap.position.y = 0.112; cap.castShadow = true; group.add(cap);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 12), mat("#ffffff", 0.12, 0.2));
  core.position.set(-0.016, 0.135, -0.02); group.add(core);
  return group;
}
function componentMaterials(type) {
  if (type === "led") return { body: mat("#b84c60", 0.24), dark: mat("#783344", 0.3), metal: mat("#c8d1dc", 0.18, 0.9), glass: new THREE.MeshPhysicalMaterial({ color: "#ff737f", roughness: 0.08, metalness: 0, transmission: 0.12, thickness: 0.55, clearcoat: 1, clearcoatRoughness: 0.06, emissive: "#7c1527", emissiveIntensity: 0.18 }) };
  if (type === "resistor") return { body: mat("#e9c995", 0.43), dark: mat("#a77b48", 0.4), metal: mat("#c8d0d9", 0.18, 0.9) };
  if (type === "battery") return { body: mat("#e8edf7", 0.22, 0.12), dark: mat("#566987", 0.25, 0.32), metal: mat("#cbd4df", 0.16, 0.9) };
  if (type === "switch") return { body: mat("#dce5e0", 0.36), dark: mat("#455b56", 0.26), metal: mat("#c5ced7", 0.16, 0.9) };
  return { body: mat("#536d91", 0.25, 0.22), dark: mat("#263c58", 0.24, 0.3), metal: mat("#c5ced8", 0.16, 0.9) };
}
function makePartMesh(part, targetGroup = componentGroup, register = true) {
  // Defensive guard: Array.forEach passes (value, index, array), not our optional arguments.
  if (!targetGroup || typeof targetGroup.add !== "function") targetGroup = componentGroup;
  if (typeof register !== "boolean") register = true;
  const root = new THREE.Group();
  root.userData.partId = part.id;
  const m = componentMaterials(part.type);
  const add = (geometry, material, x, y, z, parent = root) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  const cylinderBetween = (a, b, radius, material) => {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const delta = end.clone().sub(start);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 12), material);
    mesh.position.copy(start.clone().add(end).multiplyScalar(0.5));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    mesh.castShadow = true; root.add(mesh); return mesh;
  };
  // Components sit directly on the workbench: avoid the oversized circular
  // display plinth that made every real component look like a button.
  const terminalX = 0.72;
  const terminals = [
    { id: part.type === "battery" ? "plus" : "a", x: -terminalX, z: 0, label: part.type === "led" ? "A" : part.type === "battery" ? "+" : "1" },
    { id: part.type === "battery" ? "minus" : part.type === "led" ? "k" : "b", x: terminalX, z: 0, label: part.type === "led" ? "K" : part.type === "battery" ? "−" : "2" }
  ];
  if (part.type === "led") {
    // 5 mm through-hole LED: two separate formed leads, molded flange and rounded epoxy lens.
    cylinderBetween([-0.72, 0.16, 0], [-0.61, 0.49, 0], 0.021, m.metal);
    cylinderBetween([0.72, 0.16, 0], [0.61, 0.49, 0], 0.021, m.metal);
    add(new THREE.CylinderGeometry(0.265, 0.29, 0.11, 40), m.dark, 0, 0.54, 0);
    add(new THREE.TorusGeometry(0.27, 0.018, 10, 40), mat("#f6c7c8", 0.22, 0.18), 0, 0.59, 0).rotation.x = Math.PI / 2;
    const dome = add(new THREE.SphereGeometry(0.285, 40, 28), m.glass, 0, 0.78, 0);
    dome.scale.set(0.92, 1.02, 0.92);
    add(new THREE.SphereGeometry(0.055, 16, 12), mat("#fff1f2", 0.12), -0.1, 0.91, -0.16);
    dome.userData.isLedDome = true;
    dome.userData.baseScale = dome.scale.clone();
  } else if (part.type === "resistor") {
    cylinderBetween([-0.72, 0.16, 0], [-0.34, 0.4, 0], 0.032, m.metal);
    cylinderBetween([0.34, 0.4, 0], [0.72, 0.16, 0], 0.032, m.metal);
    add(new THREE.CapsuleGeometry(0.145, 0.42, 6, 24), m.body, 0, 0.43, 0).rotation.z = Math.PI / 2;
    [-0.23, -0.075, 0.08, 0.23].forEach((x, i) => {
      const band = add(new THREE.TorusGeometry(0.137, 0.018, 10, 28), [mat("#6b4b3b"),mat("#c56e4c"),mat("#5c8167"),mat("#b18a43")][i], x, 0.43, 0);
      band.rotation.y = Math.PI / 2;
    });
    add(new THREE.SphereGeometry(0.045, 12, 10), mat("#fff0d9", 0.2), -0.08, 0.54, -0.09);
  } else if (part.type === "battery") {
    // Horizontal 5V cell: the visible end caps match the two electrical terminals.
    const shell = add(new THREE.CylinderGeometry(0.30, 0.30, 1.22, 56, 1, false), m.body, 0, 0.57, 0);
    shell.rotation.z = Math.PI / 2;
    const leftCap = add(new THREE.CylinderGeometry(0.305, 0.305, 0.10, 48), m.dark, -0.64, 0.57, 0);
    leftCap.rotation.z = Math.PI / 2;
    const rightCap = add(new THREE.CylinderGeometry(0.305, 0.305, 0.10, 48), m.dark, 0.64, 0.57, 0);
    rightCap.rotation.z = Math.PI / 2;
    const positive = add(new THREE.CylinderGeometry(0.19, 0.19, 0.09, 32), mat("#d9a19b", 0.22, 0.55), -0.735, 0.57, 0);
    positive.rotation.z = Math.PI / 2;
    const negative = add(new THREE.CylinderGeometry(0.22, 0.22, 0.045, 32), mat("#aab5c8", 0.22, 0.68), 0.725, 0.57, 0);
    negative.rotation.z = Math.PI / 2;
    const rim = add(new THREE.TorusGeometry(0.315, 0.018, 10, 48), mat("#ffffff", 0.22, 0.2), -0.48, 0.57, 0);
    rim.rotation.y = Math.PI / 2;
    const labelCanvas = document.createElement("canvas");
    labelCanvas.width = 320; labelCanvas.height = 160;
    const labelCtx = labelCanvas.getContext("2d");
    labelCtx.clearRect(0, 0, 320, 160);
    const gradient = labelCtx.createLinearGradient(0, 0, 320, 160);
    gradient.addColorStop(0, "#f8f9ff"); gradient.addColorStop(1, "#dfe6fb");
    labelCtx.fillStyle = gradient; labelCtx.beginPath(); labelCtx.roundRect(8, 8, 304, 144, 28); labelCtx.fill();
    labelCtx.fillStyle = "#6c7fba"; labelCtx.font = "800 39px Arial"; labelCtx.textAlign = "center"; labelCtx.fillText("GL / 5V", 160, 69);
    labelCtx.fillStyle = "#9aa8cf"; labelCtx.font = "bold 20px Arial"; labelCtx.fillText("POWER CELL", 160, 105);
    labelCtx.fillStyle = "#c27e7b"; labelCtx.font = "bold 23px Arial"; labelCtx.fillText("+  ───────  −", 160, 135);
    const labelTexture = new THREE.CanvasTexture(labelCanvas); labelTexture.colorSpace = THREE.SRGBColorSpace;
    const labelMesh = add(new THREE.PlaneGeometry(0.78, 0.39), new THREE.MeshBasicMaterial({ map: labelTexture, transparent: true, side: THREE.DoubleSide }), 0, 0.57, 0.345);
    const plusMark = add(new THREE.TorusGeometry(0.095, 0.018, 8, 24), mat("#fff5f2", 0.2), -0.735, 0.57, 0);
    plusMark.rotation.y = Math.PI / 2;
    add(new THREE.BoxGeometry(0.12, 0.018, 0.018), mat("#fff5f2", 0.2), -0.735, 0.57, 0);
    cylinderBetween([-0.72, 0.22, 0], [-0.72, 0.09, 0], 0.028, m.metal);
    cylinderBetween([0.72, 0.22, 0], [0.72, 0.09, 0], 0.028, m.metal);
  } else if (part.type === "switch") {
    add(new THREE.BoxGeometry(0.92, 0.26, 0.68), m.body, 0, 0.34, 0);
    add(new THREE.BoxGeometry(0.78, 0.07, 0.54), m.dark, 0, 0.50, 0);
    // Four tiny screw heads and a metal pivot make the miniature switch feel assembled.
    for (const x of [-0.34, 0.34]) for (const z of [-0.22, 0.22]) {
      const screw = add(new THREE.CylinderGeometry(0.045, 0.045, 0.018, 20), m.metal, x, 0.55, z);
      screw.rotation.x = Math.PI / 2;
      add(new THREE.BoxGeometry(0.045, 0.008, 0.008), m.dark, x, 0.562, z);
    }
    const statusLamp = add(new THREE.SphereGeometry(0.048, 20, 14), mat(part.closed ? "#78dca8" : "#d68d88", 0.18), 0.25, 0.58, 0.17);
    statusLamp.material.emissive = new THREE.Color(part.closed ? "#35d28b" : "#a84b4b");
    statusLamp.material.emissiveIntensity = part.closed ? 1.2 : 0.08;
    const pivot = add(new THREE.CylinderGeometry(0.105, 0.105, 0.1, 28), m.metal, 0, 0.62, 0);
    pivot.rotation.x = Math.PI / 2;
    const lever = add(new THREE.CylinderGeometry(0.075, 0.095, 0.47, 24), mat("#e5eaf1", 0.18, 0.62), part.closed ? 0.06 : -0.05, 0.82, part.closed ? 0.03 : -0.09);
    lever.rotation.z = part.closed ? 0.12 : -0.42;
    add(new THREE.SphereGeometry(0.11, 24, 18), mat("#d8e0ea", 0.16, 0.55), part.closed ? 0.11 : -0.14, 0.99, part.closed ? 0.03 : -0.14);
    cylinderBetween([-0.72, 0.16, 0], [-0.38, 0.32, 0], 0.022, m.metal);
    cylinderBetween([0.38, 0.32, 0], [0.72, 0.16, 0], 0.022, m.metal);
  } else if (part.type === "capacitor") {
    // Aluminum electrolytic can, rolled top rim, vent cross and polarity stripe.
    add(new THREE.CylinderGeometry(0.285, 0.30, 0.84, 48, 1, false), m.body, 0, 0.62, 0);
    add(new THREE.CylinderGeometry(0.30, 0.30, 0.055, 48), m.dark, 0, 1.06, 0);
    add(new THREE.TorusGeometry(0.285, 0.018, 10, 48), mat("#d5dce7", 0.18, 0.8), 0, 1.09, 0);
    add(new THREE.CircleGeometry(0.245, 40), mat("#aab7c9", 0.24, 0.45), 0, 1.091, 0).rotation.x = -Math.PI / 2;
    add(new THREE.BoxGeometry(0.19, 0.012, 0.028), mat("#eef2f7", 0.15, 0.2), 0, 1.105, 0);
    add(new THREE.BoxGeometry(0.028, 0.012, 0.19), mat("#eef2f7", 0.15, 0.2), 0, 1.105, 0);
    // Pale polarity stripe down the sleeve.
    add(new THREE.BoxGeometry(0.055, 0.57, 0.012), mat("#e8edf5", 0.3), -0.16, 0.62, 0.294);
    cylinderBetween([-0.72, 0.16, 0], [-0.27, 0.37, 0], 0.021, m.metal);
    cylinderBetween([0.27, 0.37, 0], [0.72, 0.16, 0], 0.021, m.metal);
  }
  terminals.forEach((terminal) => {
    const t = makeTerminal(terminal.id === "plus" || terminal.id === "a" ? "#e6a09b" : "#91a9d7");
    t.position.set(terminal.x, 0, terminal.z);
    t.userData = { kind: "terminal", partId: part.id, terminalId: terminal.id, terminalLabel: terminal.label };
    root.add(t);
  });
  root.position.set(part.x, 0.16, part.z);
  root.rotation.y = part.rotation || 0;
  root.traverse((obj) => {
    if (obj.isMesh) {
      obj.userData.partId = part.id;
      if (obj.geometry && obj.geometry.type === "SphereGeometry" && obj.parent === root) obj.userData.isComponentBody = true;
    }
  });
  root.userData.partId = part.id;
  targetGroup.add(root);
  if (register) {
    componentObjects.set(part.id, root);
    root.traverse((obj) => { if (obj.userData.kind === "terminal") terminalObjects.push(obj); });
  }
  return root;
}
function snap(value, step = 0.36, origin = 0) { return origin + Math.round((value - origin) / step) * step; }
function rebuildBoardSize(width, depth) {
  boardWidth = width;
  boardDepth = depth;
  const oldChildren = [...boardGroup.children];
  oldChildren.forEach((object) => {
    object.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => {
          if (material.map) material.map.dispose();
          material.dispose();
        });
      }
    });
  });
  boardGroup.clear();
  gridGroup = new THREE.Group();
  boardGroup.add(gridGroup);
  buildBoard();
  buildPlacementTargets();
  gridGroup.visible = showGrid;
  const bounds = boardBounds();
  parts.forEach((part) => {
    part.x = THREE.MathUtils.clamp(part.x, bounds.minX, bounds.maxX);
    part.z = THREE.MathUtils.clamp(part.z, bounds.minZ, bounds.maxZ);
  });
  const maxSize = Math.max(boardWidth, boardDepth);
  camera.position.set(maxSize * 0.88, maxSize * 0.92, maxSize * 1.04);
  controls.target.set(0, 0, 0);
  controls.update();
  rebuildAll();
  save();
}

function getCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  return rect;
}
function hitBoard(event, shouldSnap = true) {
  // Raycasting coordinates must match the actual WebGL canvas, on desktop and touch devices.
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const boardPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.14);
  const hit = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(boardPlane, hit)) return null;
  // A release inside the visible work surface always resolves to the nearest
  // valid board cell rather than silently failing on a perspective edge.
  const bounds = boardBounds();
  hit.x = THREE.MathUtils.clamp(hit.x, bounds.minX, bounds.maxX);
  hit.z = THREE.MathUtils.clamp(hit.z, bounds.minZ, bounds.maxZ);
  return { x: shouldSnap ? snap(hit.x, 0.36, bounds.minX) : hit.x, z: shouldSnap ? snap(hit.z, 0.36, bounds.minZ) : hit.z };
}
function terminalWorldPosition(part, terminalId) {
  const object = componentObjects.get(part.id);
  if (!object) return null;
  const terminal = object.children.find((child) => child.userData.kind === "terminal" && child.userData.terminalId === terminalId);
  if (!terminal) return null;
  const position = new THREE.Vector3();
  terminal.getWorldPosition(position);
  position.y += 0.115;
  return position;
}
function keyFor(partId, terminalId) { return partId + ":" + terminalId; }
function addPart(type, position) {
  if (!palette[type]) return;
  if (parts.filter((part) => part.type === type).length >= 5) {
    result("warning", "Для первого опыта достаточно", "Сейчас можно поставить не больше пяти деталей одного типа. Позже расширим набор компонентов.");
    return;
  }
  const id = type + "-" + nextId++;
  parts.push({ id, type, x: position.x, z: position.z, rotation: 0, closed: false, justPlaced: true });
  selectedPartId = id;
  currentActive = false; solved = false;
  save(); rebuildAll();
  const placedRoot = componentObjects.get(id);
  if (placedRoot) { placedRoot.scale.setScalar(0.72); placedRoot.position.y += 0.72; placedRoot.userData.spawnAt = performance.now(); placedRoot.userData.spawnY = 0.16; }
  updateSelection();
  result("", palette[type].title + " установлен", "Деталь аккуратно поставлена на плату. Нажми на её контакт, а затем на контакт другой детали, чтобы соединить их проводом.");
}
function placePending(event) {
  if (!placementType) return false;
  let position = hitBoard(event);
  // If the perspective ray misses near a canvas edge, still place inside the workbench.
  if (!position) {
    const rect = viewport.getBoundingClientRect();
    const inside = event && event.clientX >= rect.left && event.clientX <= rect.right &&
      event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (inside) position = { x: 0, z: 0 };
    else {
      result("warning", "Поставь деталь на плату", "Отпусти компонент внутри области 3D-платы.");
      return false;
    }
  }
  const type = placementType;
  placementType = null; isPaletteDragging = false;
  $("sceneDropHint").classList.remove("visible");
  setPlacementTargets(false);
  document.querySelectorAll(".component-pick").forEach((button) => button.classList.remove("is-pending"));
  addPart(type, position);
  return true;
}
function disposeComponentPreview() {
  if (dragPreviewRenderer) {
    dragPreviewRenderer.dispose();
    dragPreviewRenderer = null;
  }
}
function createComponentPreview(type) {
  const previewCanvas = document.createElement("canvas");
  previewCanvas.width = 144; previewCanvas.height = 144;
  previewCanvas.className = "component-preview-canvas";
  const previewScene = new THREE.Scene();
  const previewRenderer = new THREE.WebGLRenderer({ canvas: previewCanvas, alpha: true, antialias: true, powerPreference: "low-power" });
  previewRenderer.setPixelRatio(1.5);
  previewRenderer.setSize(144, 144, false);
  previewRenderer.setClearColor(0x000000, 0);
  previewRenderer.outputColorSpace = THREE.SRGBColorSpace;
  previewRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  previewRenderer.toneMappingExposure = 1.15;
  previewScene.add(new THREE.HemisphereLight(0xffffff, 0xd5d9e8, 2.4));
  const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
  keyLight.position.set(-3, 6, 4);
  previewScene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0xd7dcff, 1.6);
  rimLight.position.set(4, 2, -4);
  previewScene.add(rimLight);
  const previewRoot = makePartMesh({ id: "preview-" + type, type, x: 0, z: 0, rotation: -0.18, closed: false }, previewScene, false);
  // Subtle contact glows make the two insertion ends readable while the part is held.
  [-0.72, 0.72].forEach((x, index) => {
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 18, 12),
      new THREE.MeshBasicMaterial({
        color: index === 0 ? "#ffd0b7" : "#d2ccff",
        transparent: true, opacity: 0.82, depthWrite: false
      })
    );
    glow.position.set(x, 0.13, 0);
    glow.renderOrder = 30;
    previewRoot.add(glow);
    const aura = new THREE.Mesh(
      new THREE.SphereGeometry(0.105, 18, 12),
      new THREE.MeshBasicMaterial({
        color: index === 0 ? "#f5b89e" : "#bcb4ff",
        transparent: true, opacity: 0.22, depthWrite: false
      })
    );
    aura.position.copy(glow.position);
    aura.renderOrder = 29;
    previewRoot.add(aura);
  });
  previewRoot.scale.setScalar(type === "battery" || type === "capacitor" ? 0.68 : 0.82);
  const previewCamera = new THREE.PerspectiveCamera(34, 1, 0.1, 30);
  previewCamera.position.set(3.7, 3.1, 4.4);
  previewCamera.lookAt(0, 0.7, 0);
  previewRenderer.render(previewScene, previewCamera);
  previewScene.traverse((obj) => {
    if (obj.isMesh) {
      obj.geometry?.dispose();
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      materials.forEach((material) => { if (material?.map) material.map.dispose(); material?.dispose(); });
    }
  });
  dragPreviewRenderer = previewRenderer;
  return previewCanvas;
}

function bindUI() {
  const fullButton = $("fullViewButton");
  fullButton?.addEventListener("click", () => {
    const layout = document.querySelector(".lab3d-layout");
    const active = layout.classList.toggle("immersive");
    fullButton.setAttribute("aria-pressed", String(active));
    fullButton.innerHTML = active ? "⤢ <span>Обычный вид</span>" : "⛶ <span>На весь экран</span>";
    document.body.classList.toggle("lab-immersive-open", active);
    setTimeout(resize, 80);
  });
  document.querySelectorAll("[data-place]").forEach((button) => {
    button.style.touchAction = "none";
    button.addEventListener("pointerdown", (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      event.preventDefault();
      palettePointer = { type: button.dataset.place, x: event.clientX, y: event.clientY, moved: false, button, pointerId: event.pointerId };
      placementType = button.dataset.place;
      dragGhost = document.createElement("div");
      dragGhost.className = "dragging-component-ghost ghost-" + button.dataset.place;
      dragGhost.style.left = event.clientX + "px";
      dragGhost.style.top = event.clientY + "px";
      dragGhost.setAttribute("aria-hidden", "true");
      // Render the exact same 3D mesh used on the board, not a catalog icon or label.
      const preview = createComponentPreview(button.dataset.place);
      dragGhost.appendChild(preview);
      document.body.appendChild(dragGhost);
      button.classList.add("is-pending");
    });
  });

  window.addEventListener("pointermove", (event) => {
    if (!palettePointer) return;
    const distance = Math.hypot(event.clientX - palettePointer.x, event.clientY - palettePointer.y);
    if (dragGhost) { dragGhost.style.left = event.clientX + "px"; dragGhost.style.top = event.clientY + "px"; }
    if (distance > 7) {
      palettePointer.moved = true;
      isPaletteDragging = true;
      placementType = palettePointer.type;
      const rect = viewport.getBoundingClientRect();
      const overBoard = event.clientX >= rect.left && event.clientX <= rect.right &&
        event.clientY >= rect.top && event.clientY <= rect.bottom;
      if (overBoard) updatePlacementTargets(event);
      setPlacementTargets(overBoard);
      $("sceneDropHint").classList.toggle("visible", false);
      $("sceneHint").textContent = overBoard ? "Два контакта детали совмещаются с подсвеченными точками" : "Перенеси компонент на плату";
      palettePointer.button.classList.add("is-pending");
      canvas.style.cursor = overBoard ? "copy" : "";
    }
  });

  window.addEventListener("pointercancel", () => {
    if (!palettePointer) return;
    palettePointer = null; placementType = null; isPaletteDragging = false;
    dragGhost?.remove(); dragGhost = null;
    disposeComponentPreview();
    $("sceneDropHint").classList.remove("visible");
    setPlacementTargets(false);
    document.querySelectorAll(".component-pick").forEach((button) => button.classList.remove("is-pending"));
    canvas.style.cursor = "";
  });

  window.addEventListener("pointerup", (event) => {
    if (!palettePointer) return;
    const drag = palettePointer;
    palettePointer = null;
    dragGhost?.remove(); dragGhost = null;
    disposeComponentPreview();
    canvas.style.cursor = "";
    $("sceneDropHint").classList.remove("visible");
    setPlacementTargets(false);
    document.querySelectorAll(".component-pick").forEach((button) => button.classList.remove("is-pending"));
    if (drag.moved) {
      const rect = viewport.getBoundingClientRect();
      const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
      if (inside) {
        placementType = drag.type;
        isPaletteDragging = false;
        placePending(event);
      } else {
        placementType = null; isPaletteDragging = false;
        result("warning", "Отпусти деталь над платой", "Перенеси компонент из каталога прямо в область 3D-платы.");
      }
    } else {
      placementType = drag.type; isPaletteDragging = false;
      drag.button.classList.add("is-pending");
      $("sceneHint").textContent = "Теперь нажми на место на плате, чтобы установить деталь";
      result("", "Выбрана деталь: " + palette[placementType].title, "Нажми на плату для установки или перетащи деталь сюда.");
    }
  });
  canvas.addEventListener("pointermove", (event) => {
    if (isPaletteDragging) $("sceneDropHint").classList.add("visible");
    if (!dragCandidate || placementType) return;
    const moved = Math.hypot(event.clientX - dragCandidate.startX, event.clientY - dragCandidate.startY);
    if (!draggingPartId && moved > 6) {
      draggingPartId = dragCandidate.id;
      const part = parts.find((item) => item.id === draggingPartId);
      const position = hitBoard(event);
      if (!part || !position) { draggingPartId = null; return; }
      dragOffset.set(part.x - position.x, 0, part.z - position.z);
      controls.enabled = false;
      selectedPartId = draggingPartId;
      updateSelection();
      canvas.style.cursor = "grabbing";
      $("sceneHint").textContent = "Перемещай деталь по плате — провода последуют за ней";
      const root = componentObjects.get(draggingPartId);
      if (root) root.scale.setScalar(1.06);
    }
    if (draggingPartId) {
      const position = hitBoard(event, false);
      const part = parts.find((item) => item.id === draggingPartId);
      const root = componentObjects.get(draggingPartId);
      if (!position || !part || !root) return;
      part.x = THREE.MathUtils.clamp(position.x + dragOffset.x, -5.0, 5.0);
      part.z = THREE.MathUtils.clamp(position.z + dragOffset.z, -2.85, 2.85);
      root.position.x = part.x;
      root.position.z = part.z;
      const now = performance.now();
      if (now - dragLastWireUpdate > 45) {
        dragLastWireUpdate = now;
        rebuildWires();
      }
    }
  });
  canvas.addEventListener("pointercancel", () => {
    if (draggingPartId) {
      draggingPartId = null; controls.enabled = true; canvas.style.cursor = "";
      rebuildAll();
    }
    dragCandidate = null; pointerDown = null;
  });
  canvas.addEventListener("pointerdown", (event) => {
    pointerDown = { x: event.clientX, y: event.clientY, time: Date.now() };
    dragCandidate = null;
    if (placementType) return;
    getCanvasPoint(event);
    const hits = raycaster.intersectObjects([...componentObjects.values()], true);
    if (!hits.length) return;
    let node = hits[0].object;
    while (node && !node.userData.partId) node = node.parent;
    if (!node?.userData.partId) return;
    const part = parts.find((item) => item.id === node.userData.partId);
    if (!part) return;
    const position = hitBoard(event, false);
    if (!position) return;
    dragCandidate = { id: part.id, startX: event.clientX, startY: event.clientY, offsetX: part.x - position.x, offsetZ: part.z - position.z };
  });
  canvas.addEventListener("pointerup", (event) => {
    if (palettePointer) return;
    if (placementType) {
      placePending(event);
      pointerDown = null; dragCandidate = null;
      return;
    }
    if (draggingPartId) {
      const part = parts.find((item) => item.id === draggingPartId);
      const position = hitBoard(event, false);
      if (part && position) {
        part.x = THREE.MathUtils.clamp(snap(position.x + dragOffset.x), -5.0, 5.0);
        part.z = THREE.MathUtils.clamp(snap(position.z + dragOffset.z), -2.85, 2.85);
      }
      draggingPartId = null; dragCandidate = null; pointerDown = null;
      controls.enabled = true;
      canvas.style.cursor = "";
      save(); rebuildAll(); updateSelection();
      result("", "Деталь перемещена", "Компонент привязан к сетке, а подключённые провода обновлены.");
      return;
    }
    if (pointerDown && Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) > 7) {
      pointerDown = null; dragCandidate = null; return;
    }
    pointerDown = null;
    dragCandidate = null;
    getCanvasPoint(event);
    const terminalsHit = raycaster.intersectObjects(terminalObjects, true);
    if (terminalsHit.length) {
      let terminal = terminalsHit[0].object;
      while (terminal && !terminal.userData.kind) terminal = terminal.parent;
      if (terminal) {
        const key = keyFor(terminal.userData.partId, terminal.userData.terminalId);
        handleTerminalTap(key, terminal.userData.terminalLabel);
      }
      return;
    }
    const wireHits = raycaster.intersectObjects(wireObjects, false);
    if (wireHits.length) {
      const index = wireHits[0].object.userData.wireIndex;
      if (Number.isInteger(index) && wires[index]) {
        wires.splice(index, 1);
        currentActive = false;
        save(); rebuildWires(); updateMetrics();
        result("", "Провод удалён", "Нажми на контакты ещё раз, если хочешь восстановить соединение.");
      }
      return;
    }
    const componentHits = raycaster.intersectObjects([...componentObjects.values()], true);
    if (componentHits.length) {
      let node = componentHits[0].object;
      while (node && !node.userData.partId) node = node.parent;
      if (node && node.userData.partId) {
        selectedPartId = node.userData.partId;
        rebuildWires(); updateSelection();
        const p = parts.find((item) => item.id === selectedPartId);
        result("", palette[p.type].title + " выбрана", "Можно повернуть деталь, удалить её или переключить выключатель. Контакты с цветными наконечниками можно соединять друг с другом.");
        return;
      }
    }
    selectedPartId = null; rebuildWires(); updateSelection();
  });
  $("viewResetButton").addEventListener("click", () => {
    camera.position.set(10.5, 11.5, 12.5); controls.target.set(0, 0, 0); controls.update();
  });
  $("gridToggleButton").addEventListener("click", () => {
    showGrid = !showGrid; gridGroup.visible = showGrid;
    $("gridToggleButton").setAttribute("aria-pressed", String(showGrid));
  });
  const boardSizeControl = $("boardSizeControl");
  if (boardSizeControl) {
    const currentKey = Object.keys(BOARD_SIZES).find((key) => BOARD_SIZES[key][0] === boardWidth && BOARD_SIZES[key][1] === boardDepth) || "compact";
    boardSizeControl.value = currentKey;
    boardSizeControl.addEventListener("change", () => {
      const size = BOARD_SIZES[boardSizeControl.value];
      if (!size) return;
      rebuildBoardSize(size[0], size[1]);
      result("", "Размер платы изменён", "Рабочая область расширена. Установленные детали и провода сохранены, детали у края сдвинуты внутрь платы.");
    });
  }
  $("rotatePartButton").addEventListener("click", () => {
    const part = parts.find((item) => item.id === selectedPartId);
    if (!part) return;
    part.rotation = (part.rotation || 0) + Math.PI / 2;
    save(); rebuildAll(); updateSelection();
  });
  $("removePartButton").addEventListener("click", () => {
    if (!selectedPartId) return;
    parts = parts.filter((part) => part.id !== selectedPartId);
    wires = wires.filter((wire) => !wire.a.startsWith(selectedPartId + ":") && !wire.b.startsWith(selectedPartId + ":"));
    selectedPartId = null; currentActive = false; solved = false;
    save(); rebuildAll(); updateSelection();
    result("", "Компонент удалён", "Связанные с ним провода тоже удалены.");
  });
  $("toggleSwitchButton").addEventListener("click", () => {
    const part = parts.find((item) => item.id === selectedPartId && item.type === "switch");
    if (!part) return;
    part.closed = !part.closed; currentActive = false;
    save(); rebuildAll(); updateSelection();
    result("", part.closed ? "Выключатель замкнут" : "Выключатель разомкнут", part.closed ? "Теперь выключатель проводит ток. Запусти симуляцию." : "Цепь разорвана — ток не идёт.");
  });
  $("voltage3dControl").addEventListener("change", (event) => { voltage = Number(event.target.value); save(); result("", "Напряжение изменено", "Учебный источник теперь настроен на " + voltage + " В."); });
  $("resistance3dControl").addEventListener("change", (event) => { resistance = Number(event.target.value); save(); result("", "Номинал изменён", "Каждый установленный резистор теперь имеет номинал " + resistance + " Ω."); });
  $("simulate3dButton").addEventListener("click", simulate);
  $("clearWires3dButton").addEventListener("click", () => {
    wires = []; currentActive = false; save(); rebuildWires(); updateMetrics();
    result("", "Провода убраны", "Все детали остались на плате. Соедини контакты заново.");
  });
  $("reset3dButton").addEventListener("click", () => {
    parts = []; wires = []; nextId = 1; selectedPartId = null; placementType = null; currentActive = false; solved = false; voltage = 5; resistance = 220;
    $("voltage3dControl").value = "5"; $("resistance3dControl").value = "220";
    save(); rebuildAll(); updateSelection(); result("", "Чистая плата", "Перетащи на неё батарейку, резистор и светодиод — или загрузи рабочий пример.");
  });
  $("autoBuildButton").addEventListener("click", autoBuild);
  window.addEventListener("resize", resize);
  window.addEventListener("pointercancel", () => {
    palettePointer = null; isPaletteDragging = false; dragGhost?.remove(); dragGhost = null;
    $("sceneDropHint").classList.remove("visible");
    document.querySelectorAll(".component-pick").forEach((button) => button.classList.remove("is-pending"));
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      document.querySelector(".lab3d-layout")?.classList.remove("immersive");
      document.body.classList.remove("lab-immersive-open");
      const fullButton = $("fullViewButton");
      if (fullButton) { fullButton.setAttribute("aria-pressed", "false"); fullButton.innerHTML = "⛶ <span>На весь экран</span>"; }
      placementType = null; isPaletteDragging = false; palettePointer = null; dragGhost?.remove(); dragGhost = null; $("sceneDropHint").classList.remove("visible");
      document.querySelectorAll(".component-pick").forEach((button) => button.classList.remove("is-pending"));
    }
    if ((event.key === "Delete" || event.key === "Backspace") && selectedPartId && !["INPUT","TEXTAREA","SELECT"].includes(document.activeElement.tagName)) $("removePartButton").click();
  });
}
function handleTerminalTap(key, label) {
  if (!window._glitchSelectedTerminal) {
    window._glitchSelectedTerminal = key;
    $("sceneHint").textContent = "Контакт " + label + " выбран — нажми на второй контакт";
    result("", "Первый контакт выбран", "Теперь нажми на другой контакт. Между ними появится провод.");
    rebuildWires();
    return;
  }
  if (window._glitchSelectedTerminal === key) {
    window._glitchSelectedTerminal = null;
    $("sceneHint").textContent = "Выбор контакта отменён";
    rebuildWires(); return;
  }
  const first = window._glitchSelectedTerminal;
  if (first.split(":")[0] === key.split(":")[0]) {
    window._glitchSelectedTerminal = key; rebuildWires();
    result("warning", "Выбери другую деталь", "Чтобы провести соединение, выбери контакт на другой детали.");
    return;
  }
  const duplicate = wires.some((wire) => (wire.a === first && wire.b === key) || (wire.a === key && wire.b === first));
  if (!duplicate) wires.push({ a: first, b: key });
  window._glitchSelectedTerminal = null;
  currentActive = false; save(); rebuildWires(); updateMetrics();
  result("", duplicate ? "Провод уже есть" : "Провод подключён", duplicate ? "Эти контакты уже соединены." : "Соединение добавлено. Продолжай сборку или запускай симуляцию.");
}
function clearGroup(group) {
  while (group.children.length) {
    const child = group.children[group.children.length - 1];
    group.remove(child);
    child.traverse?.((obj) => {
      if (obj.geometry && obj.geometry !== undefined) obj.geometry.dispose();
      if (obj.material) {
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        materials.forEach((material) => { if (material.map) material.map.dispose(); material.dispose(); });
      }
    });
  }
}
function rebuildAll() {
  clearGroup(componentGroup); componentObjects.clear(); terminalObjects.length = 0;
  // Do not pass Array.forEach's index/array arguments into makePartMesh's optional parameters.
  parts.forEach((part) => makePartMesh(part, componentGroup, true));
  rebuildWires();
  $("placedCount").textContent = parts.length + " " + (parts.length === 1 ? "деталь" : parts.length < 5 ? "детали" : "деталей");
  updateMetrics();
}
function rebuildWires() {
  clearGroup(wireGroup); wireObjects.length = 0; activeFlowDots.length = 0;
  wires.forEach((wire, index) => {
    const [partA, terminalA] = wire.a.split(":");
    const [partB, terminalB] = wire.b.split(":");
    const aPart = parts.find((part) => part.id === partA), bPart = parts.find((part) => part.id === partB);
    if (!aPart || !bPart) return;
    const start = terminalWorldPosition(aPart, terminalA), end = terminalWorldPosition(bPart, terminalB);
    if (!start || !end) return;
    const raisedStart = start.clone(); raisedStart.y += 0.18;
    const raisedEnd = end.clone(); raisedEnd.y += 0.18;
    const middle = raisedStart.clone().add(raisedEnd).multiplyScalar(0.5); middle.y += 0.4 + Math.min(0.55, start.distanceTo(end) * 0.08);
    const curve = new THREE.CatmullRomCurve3([raisedStart, middle, raisedEnd]);
    const wireMaterial = new THREE.MeshStandardMaterial({ color: index % 2 ? "#8da9e8" : "#e88e83", roughness: 0.35, metalness: 0.15, emissive: currentActive ? (index % 2 ? "#4d6fc2" : "#a94e49") : "#000000", emissiveIntensity: currentActive ? 0.28 : 0 });
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.045, 10, false), wireMaterial);
    mesh.castShadow = true;
    mesh.userData.wireIndex = index;
    wireGroup.add(mesh); wireObjects.push(mesh);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), mat("#fff8d8", 0.22, 0.1));
    dot.userData.flowCurve = curve; dot.userData.flowOffset = (index * 0.23) % 1;
    dot.visible = currentActive; wireGroup.add(dot); activeFlowDots.push(dot);
  });
  const selectedPart = parts.find((part) => part.id === selectedPartId);
  if (selectedPart) {
    const radius = selectedPart.type === "battery" ? 1.2 : selectedPart.type === "capacitor" ? 0.86 : 0.98;
    const halo = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.025, 8, 56), new THREE.MeshBasicMaterial({ color: "#a69ae9", transparent: true, opacity: 0.76 }));
    halo.position.set(selectedPart.x, 0.19, selectedPart.z);
    halo.rotation.x = Math.PI / 2;
    halo.userData.isSelectedHalo = true;
    wireGroup.add(halo);
  }
  if (window._glitchSelectedTerminal) {
    const [id, term] = window._glitchSelectedTerminal.split(":");
    const part = parts.find((item) => item.id === id);
    const pos = part && terminalWorldPosition(part, term);
    if (pos) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.025, 8, 24), mat("#9d91e6", 0.25, 0.1));
      ring.position.copy(pos); ring.rotation.x = Math.PI / 2; ring.userData.isSelectionRing = true; wireGroup.add(ring);
    }
  }
}
function buildGraph(ignoreLedDirection = false) {
  const graph = new Map();
  const edge = (a, b, component, direction = "both") => {
    if (!graph.has(a)) graph.set(a, []);
    if (!graph.has(b)) graph.set(b, []);
    graph.get(a).push({ to: b, component, direction });
    if (direction !== "forward") graph.get(b).push({ to: a, component, direction: "reverse" });
  };
  wires.forEach((wire) => edge(wire.a, wire.b, null));
  parts.forEach((part) => {
    const a = keyFor(part.id, part.type === "battery" ? "plus" : "a");
    const b = keyFor(part.id, part.type === "battery" ? "minus" : part.type === "led" ? "k" : "b");
    if (part.type === "battery") return;
    if (part.type === "switch" && !part.closed) return;
    if (part.type === "led" && !ignoreLedDirection) edge(a, b, part, "forward");
    else edge(a, b, part, "both");
  });
  return graph;
}
function findPath(ignoreLedDirection = false) {
  const graph = buildGraph(ignoreLedDirection);
  const battery = parts.find((part) => part.type === "battery");
  if (!battery) return null;
  const start = keyFor(battery.id, "plus"), finish = keyFor(battery.id, "minus");
  const queue = [{ node: start, path: [], seen: new Set([start]) }];
  while (queue.length) {
    const current = queue.shift();
    if (current.node === finish) return current.path;
    (graph.get(current.node) || []).forEach((edge) => {
      if (current.seen.has(edge.to)) return;
      const seen = new Set(current.seen); seen.add(edge.to);
      queue.push({ node: edge.to, path: edge.component ? current.path.concat(edge.component) : current.path, seen });
    });
  }
  return null;
}
function simulate() {
  parts.forEach((part) => { if (part.type === "led") part.lit = false; });
  currentActive = false;
  const battery = parts.find((part) => part.type === "battery");
  const led = parts.filter((part) => part.type === "led");
  const resistors = parts.filter((part) => part.type === "resistor");
  if (!battery || !led.length || !resistors.length) {
    rebuildAll();
    result("warning", "Не хватает деталей", "Для этого опыта нужны батарейка, резистор и светодиод. Перетащи недостающие компоненты на плату.");
    return;
  }
  const path = findPath(false);
  if (!path) {
    const reverse = findPath(true);
    const reversedLed = reverse && reverse.some((part) => part.type === "led") && reverse.some((part) => part.type === "resistor");
    rebuildAll();
    result(reversedLed ? "error" : "warning", reversedLed ? "Светодиод подключён наоборот" : "Цепь разомкнута", reversedLed ? "Путь существует, но полярность LED обратная. Поменяй местами его контакты A и K." : "Нужен непрерывный путь от плюса батарейки через резистор и светодиод к минусу. Проверь провода и выключатель.");
    return;
  }
  const pathLed = path.find((part) => part.type === "led");
  if (!pathLed) { rebuildAll(); result("warning", "Светодиод вне цепи", "Замкнутый путь не проходит через светодиод. Переставь провода так, чтобы ток шёл через него."); return; }
  if (!path.some((part) => part.type === "resistor")) { rebuildAll(); result("error", "Нет ограничения тока", "Не подключай светодиод напрямую к батарейке. Добавь резистор последовательно."); return; }
  const count = Math.max(1, path.filter((part) => part.type === "resistor").length);
  const current = Math.max(0, (voltage - 2) / (resistance * count) * 1000);
  if (current <= 0) { rebuildAll(); result("warning", "Не хватает напряжения", "В учебной модели светодиоду нужно около 2 В. Увеличь напряжение источника."); return; }
  if (current > 20) { rebuildAll(); $("currentMetric").innerHTML = current.toFixed(1).replace(".", ",") + ' <small>мА</small>'; result("error", "Слишком большой ток", "Расчётный ток — " + current.toFixed(1).replace(".", ",") + " мА. Это выше условного учебного предела 20 мА. Увеличь сопротивление или снизь напряжение."); return; }
  pathLed.lit = true; currentActive = true; solved = true;
  rebuildAll(); updateLedGlow(); updateMetrics(current);
  if (window.GLITCH_LAB && typeof window.GLITCH_LAB.completeLesson === "function") window.GLITCH_LAB.completeLesson("circuit", "first-led-circuit");
  result("success", "Светодиод загорелся!", "Расчётный ток — " + current.toFixed(1).replace(".", ",") + " мА при " + voltage + " В и " + resistance + " Ω. По проводам побежали световые импульсы. Это упрощённая учебная модель.");
}
function updateLedGlow() {
  parts.forEach((part) => {
    const root = componentObjects.get(part.id);
    if (!root || part.type !== "led") return;
    root.traverse((obj) => {
      if (obj.isMesh && obj.userData.isLedDome && obj.material && obj.material.emissive) {
        obj.material.emissive.set(part.lit ? "#ff505d" : "#5c1019");
        obj.material.emissiveIntensity = part.lit ? 1.7 : 0.1;
      }
    });
    if (part.lit) {
      const glow = new THREE.PointLight("#ff6b76", 2.1, 3.2);
      glow.position.set(part.x, 1.1, part.z);
      glow.userData.partGlow = part.id;
      root.add(glow);
    }
  });
}
function updateMetrics(current = null) {
  $("currentMetric").innerHTML = current === null ? "— <small>мА</small>" : current.toFixed(1).replace(".", ",") + " <small>мА</small>";
  $("stateMetric").textContent = currentActive ? "Ток идёт" : "Ожидание";
}
function updateSelection() {
  const part = parts.find((item) => item.id === selectedPartId);
  $("selectedActions").hidden = !part;
  $("selectedPartTitle").textContent = part ? palette[part.type].title : "Ничего не выбрано";
  $("selectedPartDescription").textContent = part ? (part.type === "switch" ? (part.closed ? "Выключатель замкнут — контакты проводят ток." : "Выключатель разомкнут — цепь прервана.") : "Деталь на плате. Поверни её, чтобы изменить направление контактов.") : "Нажми на установленную деталь, чтобы повернуть или удалить её.";
  $("toggleSwitchButton").hidden = !part || part.type !== "switch";
  if (part && part.type === "switch") $("toggleSwitchButton").textContent = part.closed ? "Разомкнуть" : "Замкнуть";
}
function result(kind, title, text) {
  const panel = $("result3dPanel");
  panel.className = "result3d-panel" + (kind ? " " + kind : "");
  $("result3dIcon").textContent = kind === "success" ? "✓" : kind === "error" || kind === "warning" ? "!" : "i";
  $("result3dTitle").textContent = title;
  $("result3dText").textContent = text;
}
function autoBuild() {
  parts = [
    { id: "battery-1", type: "battery", x: -3.7, z: 0.2, rotation: 0, closed: false },
    { id: "resistor-2", type: "resistor", x: -0.9, z: -1.2, rotation: 0, closed: false },
    { id: "led-3", type: "led", x: 2.1, z: 0.1, rotation: 0, closed: false }
  ];
  wires = [
    { a: "battery-1:plus", b: "resistor-2:a" },
    { a: "resistor-2:b", b: "led-3:a" },
    { a: "led-3:k", b: "battery-1:minus" }
  ];
  nextId = 4; selectedPartId = null; voltage = 5; resistance = 220; currentActive = false; solved = false;
  $("voltage3dControl").value = "5"; $("resistance3dControl").value = "220";
  save(); rebuildAll(); updateSelection();
  result("", "Пример установлен", "Готовая цепь уже собрана. Нажми «Запустить схему», чтобы включить светодиод и увидеть движение тока.");
}
function save() {
  try { localStorage.setItem(storageKey, JSON.stringify({ version: 1, parts, wires, nextId, voltage, resistance, boardWidth, boardDepth })); }
  catch (error) { console.warn("GLITCH LAB: не удалось сохранить 3D-схему", error); }
}
function restore() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.parts) || !Array.isArray(data.wires)) return;
    voltage = [3,5,9,12].includes(Number(data.voltage)) ? Number(data.voltage) : 5;
    resistance = [100,220,330,1000].includes(Number(data.resistance)) ? Number(data.resistance) : 220;
    const savedSize = Object.values(BOARD_SIZES).find(([w, d]) => w === Number(data.boardWidth) && d === Number(data.boardDepth));
    if (savedSize) { boardWidth = savedSize[0]; boardDepth = savedSize[1]; }
    parts = data.parts.filter((part) => part && palette[part.type] && typeof part.id === "string").slice(0, 25).map((part) => ({
      id: part.id, type: part.type, x: THREE.MathUtils.clamp(Number(part.x) || 0, boardBounds().minX, boardBounds().maxX), z: THREE.MathUtils.clamp(Number(part.z) || 0, boardBounds().minZ, boardBounds().maxZ),
      rotation: Number(part.rotation) || 0, closed: Boolean(part.closed), lit: false
    }));
    const valid = new Set(parts.flatMap((part) => [keyFor(part.id, part.type === "battery" ? "plus" : "a"), keyFor(part.id, part.type === "battery" ? "minus" : part.type === "led" ? "k" : "b")]));
    wires = data.wires.filter((wire) => wire && valid.has(wire.a) && valid.has(wire.b) && wire.a.split(":")[0] !== wire.b.split(":")[0]).map((wire) => ({ a: wire.a, b: wire.b }));
    nextId = Math.max(Number(data.nextId) || 1, 1);
    $("voltage3dControl").value = String(voltage); $("resistance3dControl").value = String(resistance);
  } catch (error) { console.warn("GLITCH LAB: сохранённая 3D-схема повреждена", error); }
}
function resize() {
  if (!renderer || !camera) return;
  const width = viewport.clientWidth, height = viewport.clientHeight;
  if (!width || !height) return;
  camera.aspect = width / height; camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
}
function animate() {
  requestAnimationFrame(animate);
  if (!renderer || !scene || !camera) return;
  const time = performance.now() * 0.001;
  if (placementTargets?.visible) {
    placementTargets.userData.contactMarkers.forEach((marker) => {
      const pulse = 0.5 + 0.5 * Math.sin(time * 4.2 + marker.userData.phase);
      marker.userData.ring.material.opacity = 0.48 + pulse * 0.48;
      marker.userData.core.material.opacity = 0.68 + pulse * 0.30;
      const scale = 0.92 + pulse * 0.22;
      marker.userData.ring.scale.setScalar(scale);
      marker.userData.core.scale.setScalar(scale);
    });
  }
  if (currentActive) {
    activeFlowDots.forEach((dot) => {
      const curve = dot.userData.flowCurve;
      if (!curve) return;
      const t = (time * 0.42 + dot.userData.flowOffset) % 1;
      dot.position.copy(curve.getPoint(t));
      const pulse = 0.8 + Math.sin(time * 7 + dot.userData.flowOffset * 6) * 0.2;
      dot.scale.setScalar(pulse);
    });
    componentObjects.forEach((root, id) => {
      const part = parts.find((item) => item.id === id);
      if (part?.lit) {
        const light = root.children.find((obj) => obj.isPointLight && obj.userData.partGlow === id);
        if (light) light.intensity = 1.8 + Math.sin(time * 8) * 0.45;
      }
    });
  }
  componentObjects.forEach((root, id) => {
    const part = parts.find((item) => item.id === id);
    root.traverse((obj) => {
      if (!obj.userData.isLedDome || !obj.userData.baseScale) return;
      const pulse = part?.lit ? 1 + (Math.sin(time * 8) + 1) * 0.035 : 1;
      obj.scale.copy(obj.userData.baseScale).multiplyScalar(pulse);
    });
    if (root.userData.spawnAt) {
      const progress = Math.min(1, (performance.now() - root.userData.spawnAt) / 330);
      const eased = 1 - Math.pow(1 - progress, 3);
      root.scale.setScalar(0.72 + 0.28 * eased);
      root.position.y = root.userData.spawnY + 0.72 * (1 - eased) + Math.sin(progress * Math.PI) * 0.09;
      if (progress >= 1) {
        root.position.y = root.userData.spawnY;
        root.scale.setScalar(1);
        delete root.userData.spawnAt;
      }
    }
  });
  ambientParticles.forEach((particle) => {
    particle.position.y = particle.userData.baseY + Math.sin(time * 0.7 + particle.userData.floatOffset) * 0.11;
    particle.position.x += Math.sin(time * 0.22 + particle.userData.floatOffset) * 0.0008;
    particle.material.opacity = 0.25 + (Math.sin(time * 1.4 + particle.userData.floatOffset) + 1) * 0.16;
  });
  wireGroup.children.forEach((obj) => {
    if (obj.userData.isSelectedHalo) {
      obj.rotation.z = Math.sin(time * 0.65) * 0.025;
      const pulse = 1 + Math.sin(time * 2.8) * 0.035;
      obj.scale.set(pulse, pulse, pulse);
      obj.material.opacity = 0.58 + (Math.sin(time * 3) + 1) * 0.12;
    }
  });
  controls?.update();
  renderer.render(scene, camera);
}
init();