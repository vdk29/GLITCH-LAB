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
let suppressPaletteClick = false;
let showGrid = true;
let voltage = 5;
let resistance = 220;
let solved = false;
let currentActive = false;
let parts = [];
let wires = [];
let nextId = 1;
let pointerDown = null;

const boardWidth = 12;
const boardDepth = 8;
const terminalRadius = 0.115;

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
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.065;
    controls.minDistance = 8;
    controls.maxDistance = 23;
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
    $("sceneLoading").innerHTML = "<strong>Не удалось запустить 3D</strong><small>Проверь подключение к интернету и обнови страницу.</small>";
    $("engineStatus").textContent = "Не удалось запустить 3D";
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
  const edgeMat = mat("#8db6a4", 0.65);
  for (const x of [-boardWidth / 2 + 0.08, boardWidth / 2 - 0.08]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, boardDepth - 0.5), edgeMat);
    rail.position.set(x, 0.14, 0); boardGroup.add(rail);
  }
  const holeMat = mat("#658b7b", 0.5, 0.08);
  const holeInner = mat("#466e61", 0.72);
  for (let x = -5.4; x <= 5.401; x += 0.36) {
    for (let z = -3.35; z <= 3.351; z += 0.36) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.064, 0.018, 12), holeMat);
      ring.position.set(x, 0.143, z); boardGroup.add(ring);
      const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.02, 12), holeInner);
      hole.position.set(x, 0.154, z); boardGroup.add(hole);
    }
  }
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
  for (let x = -5.4; x <= 5.401; x += 0.72) {
    const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 0.151, -3.4), new THREE.Vector3(x, 0.151, 3.4)]);
    gridGroup.add(new THREE.Line(geometry, gridMaterial));
  }
  for (let z = -3.35; z <= 3.351; z += 0.72) {
    const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-5.4, 0.151, z), new THREE.Vector3(5.4, 0.151, z)]);
    gridGroup.add(new THREE.Line(geometry, gridMaterial));
  }
  const screwMat = mat("#a9b3c3", 0.25, 0.45);
  for (const x of [-5.8, 5.8]) for (const z of [-3.8, 3.8]) {
    const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.05, 24), screwMat);
    screw.position.set(x, 0.0, z); screw.castShadow = true; boardGroup.add(screw);
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.01, 0.025), mat("#7c8799", 0.4, 0.2));
    slot.position.set(x, 0.031, z); boardGroup.add(slot);
  }
}
function makeTerminal(color = "#b8c3d2") {
  const group = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.2, 12), mat("#9ba9b7", 0.28, 0.55));
  stem.position.y = 0.12; group.add(stem);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(terminalRadius, 18, 12), mat(color, 0.24, 0.25));
  cap.position.y = 0.23; cap.castShadow = true; group.add(cap);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), mat("#f8fbff", 0.2, 0.15));
  core.position.y = 0.31; group.add(core);
  return group;
}
function componentMaterials(type) {
  if (type === "led") return { body: mat("#e77b83", 0.22), dark: mat("#bd5d69", 0.3), metal: mat("#b9c2ce", 0.24, 0.72), glass: new THREE.MeshPhysicalMaterial({ color: "#ff8c92", roughness: 0.13, metalness: 0, transmission: 0.16, thickness: 0.35, clearcoat: 1, clearcoatRoughness: 0.1, emissive: "#5c1019", emissiveIntensity: 0.1 }) };
  if (type === "resistor") return { body: mat("#e7c995", 0.34), dark: mat("#c69b66", 0.4), metal: mat("#b9c2ce", 0.25, 0.7) };
  if (type === "battery") return { body: mat("#e9edf8", 0.3, 0.15), dark: mat("#98a9d7", 0.3, 0.1), metal: mat("#c3ccd8", 0.23, 0.75) };
  if (type === "switch") return { body: mat("#dfe7e4", 0.4), dark: mat("#7f9e94", 0.35), metal: mat("#b8c2ce", 0.23, 0.65) };
  return { body: mat("#9eafd2", 0.24, 0.12), dark: mat("#7186b5", 0.3), metal: mat("#b9c2ce", 0.23, 0.7) };
}
function makePartMesh(part) {
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
  const terminalX = part.type === "battery" ? 0.85 : part.type === "capacitor" ? 0.5 : 0.66;
  const terminals = [
    { id: part.type === "battery" ? "plus" : "a", x: -terminalX, z: 0, label: part.type === "led" ? "A" : part.type === "battery" ? "+" : "1" },
    { id: part.type === "battery" ? "minus" : part.type === "led" ? "k" : "b", x: terminalX, z: 0, label: part.type === "led" ? "K" : part.type === "battery" ? "−" : "2" }
  ];
  if (part.type === "led") {
    cylinderBetween([-0.58, 0.31, 0], [-0.5, 0.58, 0], 0.038, m.metal);
    cylinderBetween([0.58, 0.31, 0], [0.5, 0.58, 0], 0.038, m.metal);
    const dome = add(new THREE.SphereGeometry(0.37, 32, 24), m.glass, 0, 0.82, 0);
    dome.scale.set(0.78, 1.04, 0.78);
    add(new THREE.CylinderGeometry(0.3, 0.34, 0.2, 32), m.dark, 0, 0.58, 0);
    add(new THREE.TorusGeometry(0.29, 0.025, 8, 32), mat("#f6c7c8", 0.24), 0, 0.7, 0).rotation.x = Math.PI / 2;
    add(new THREE.SphereGeometry(0.07, 12, 8), mat("#fff2f2", 0.18), -0.12, 0.99, -0.15);
    dome.userData.isLedDome = true;
  } else if (part.type === "resistor") {
    cylinderBetween([-0.78, 0.26, 0], [-0.34, 0.4, 0], 0.035, m.metal);
    cylinderBetween([0.34, 0.4, 0], [0.78, 0.26, 0], 0.035, m.metal);
    add(new THREE.CapsuleGeometry(0.22, 0.42, 5, 16), m.body, 0, 0.43, 0).rotation.z = Math.PI / 2;
    [-0.2, -0.065, 0.07, 0.2].forEach((x, i) => add(new THREE.CylinderGeometry(0.225, 0.225, 0.055, 24), [mat("#8e6b58"),mat("#c77a56"),mat("#708d72"),mat("#bd9655")][i], x, 0.43, 0).rotation.z = Math.PI / 2);
  } else if (part.type === "battery") {
    add(new THREE.CylinderGeometry(0.34, 0.34, 1.2, 32), m.body, 0, 0.76, 0);
    add(new THREE.CylinderGeometry(0.345, 0.345, 0.12, 32), m.dark, 0, 1.35, 0);
    add(new THREE.CylinderGeometry(0.14, 0.14, 0.12, 24), mat("#d1a7a0", 0.25, 0.5), -0.18, 1.47, 0);
    add(new THREE.CylinderGeometry(0.14, 0.14, 0.12, 24), mat("#9ca8c0", 0.25, 0.5), 0.18, 1.47, 0);
    cylinderBetween([-0.85, 0.26, 0], [-0.18, 0.55, 0], 0.04, m.metal);
    cylinderBetween([0.85, 0.26, 0], [0.18, 0.55, 0], 0.04, m.metal);
    const plus = add(new THREE.TorusGeometry(0.11, 0.018, 6, 20), mat("#c9867d"), -0.18, 1.55, 0); plus.rotation.x = Math.PI / 2;
  } else if (part.type === "switch") {
    add(new THREE.BoxGeometry(1.0, 0.3, 0.72), m.body, 0, 0.34, 0);
    add(new THREE.BoxGeometry(0.86, 0.09, 0.58), m.dark, 0, 0.51, 0);
    const lever = add(new THREE.BoxGeometry(0.54, 0.11, 0.14), m.metal, part.closed ? 0.08 : 0, 0.7, part.closed ? 0 : -0.12);
    lever.rotation.z = part.closed ? 0 : -0.38;
    cylinderBetween([-0.68, 0.25, 0], [-0.43, 0.35, 0], 0.035, m.metal);
    cylinderBetween([0.68, 0.25, 0], [0.43, 0.35, 0], 0.035, m.metal);
  } else if (part.type === "capacitor") {
    add(new THREE.CylinderGeometry(0.34, 0.34, 0.9, 32), m.body, 0, 0.59, 0);
    add(new THREE.CylinderGeometry(0.35, 0.35, 0.09, 32), m.dark, 0, 1.05, 0);
    add(new THREE.CircleGeometry(0.25, 24), mat("#e4eafa", 0.25), 0, 1.101, 0).rotation.x = -Math.PI / 2;
    cylinderBetween([-0.5, 0.23, 0], [-0.25, 0.4, 0], 0.035, m.metal);
    cylinderBetween([0.5, 0.23, 0], [0.25, 0.4, 0], 0.035, m.metal);
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
  componentGroup.add(root);
  componentObjects.set(part.id, root);
  root.traverse((obj) => { if (obj.userData.kind === "terminal") terminalObjects.push(obj); });
  return root;
}
function snap(value, step = 0.36) { return Math.round(value / step) * step; }
function getCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  return rect;
}
function hitBoard(event) {
  getCanvasPoint(event);
  const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.14);
  const hit = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(floor, hit)) return null;
  if (Math.abs(hit.x) > 5.35 || Math.abs(hit.z) > 3.35) return null;
  return { x: snap(hit.x), z: snap(hit.z) };
}
function terminalWorldPosition(part, terminalId) {
  const object = componentObjects.get(part.id);
  if (!object) return null;
  const terminal = object.children.find((child) => child.userData.kind === "terminal" && child.userData.terminalId === terminalId);
  if (!terminal) return null;
  const position = new THREE.Vector3();
  terminal.getWorldPosition(position);
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
  parts.push({ id, type, x: position.x, z: position.z, rotation: 0, closed: false });
  selectedPartId = id;
  currentActive = false; solved = false;
  save(); rebuildAll(); updateSelection();
  result("", palette[type].title + " установлен", "Деталь аккуратно поставлена на плату. Нажми на её контакт, а затем на контакт другой детали, чтобы соединить их проводом.");
}
function placePending(event) {
  if (!placementType) return false;
  const position = hitBoard(event);
  if (!position) {
    result("warning", "Поставь деталь на плату", "Перенеси компонент внутрь зелёной макетной платы.");
    return false;
  }
  const type = placementType;
  placementType = null; isPaletteDragging = false;
  $("sceneDropHint").classList.remove("visible");
  document.querySelectorAll(".component-pick").forEach((button) => button.classList.remove("is-pending"));
  addPart(type, position);
  return true;
}
function bindUI() {
  document.querySelectorAll("[data-place]").forEach((button) => {
    button.addEventListener("pointerdown", (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      placementType = button.dataset.place;
      isPaletteDragging = true;
      $("sceneDropHint").classList.add("visible");
      $("sceneHint").textContent = "Отпусти компонент над платой, чтобы установить его";
      button.classList.add("is-pending");
    });
    button.addEventListener("click", () => {
      if (suppressPaletteClick) { suppressPaletteClick = false; return; }
      placementType = button.dataset.place;
      isPaletteDragging = false;
      document.querySelectorAll(".component-pick").forEach((item) => item.classList.toggle("is-pending", item === button));
      $("sceneHint").textContent = "Теперь коснись свободного места на плате";
      result("", "Выбрана деталь: " + palette[placementType].title, "Нажми на свободное место платы, чтобы поставить компонент. Можно также перетащить его прямо на плату.");
    });
  });
  window.addEventListener("pointerup", (event) => {
    if (!placementType || !isPaletteDragging) return;
    const rect = canvas.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    isPaletteDragging = false;
    if (inside) {
      suppressPaletteClick = true;
      placePending(event);
    } else {
      $("sceneDropHint").classList.remove("visible");
    }
  });
  canvas.addEventListener("pointermove", (event) => {
    if (isPaletteDragging) $("sceneDropHint").classList.add("visible");
  });
  canvas.addEventListener("pointerdown", (event) => {
    pointerDown = { x: event.clientX, y: event.clientY, time: Date.now() };
  });
  canvas.addEventListener("pointerup", (event) => {
    if (placementType) {
      if (isPaletteDragging) suppressPaletteClick = true;
      placePending(event);
      return;
    }
    if (pointerDown && Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) > 7) return;
    pointerDown = null;
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
    const componentHits = raycaster.intersectObjects([...componentObjects.values()], true);
    if (componentHits.length) {
      let node = componentHits[0].object;
      while (node && !node.userData.partId) node = node.parent;
      if (node && node.userData.partId) {
        selectedPartId = node.userData.partId;
        updateSelection();
        const p = parts.find((item) => item.id === selectedPartId);
        result("", palette[p.type].title + " выбрана", "Можно повернуть деталь, удалить её или переключить выключатель. Контакты с цветными наконечниками можно соединять друг с другом.");
        return;
      }
    }
    selectedPartId = null; updateSelection();
  });
  $("viewResetButton").addEventListener("click", () => {
    camera.position.set(10.5, 11.5, 12.5); controls.target.set(0, 0, 0); controls.update();
  });
  $("gridToggleButton").addEventListener("click", () => {
    showGrid = !showGrid; gridGroup.visible = showGrid;
    $("gridToggleButton").setAttribute("aria-pressed", String(showGrid));
  });
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
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      placementType = null; isPaletteDragging = false; $("sceneDropHint").classList.remove("visible");
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
  parts.forEach(makePartMesh);
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
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 28, 0.035, 8, false), wireMaterial);
    mesh.castShadow = true; wireGroup.add(mesh); wireObjects.push(mesh);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), mat("#fff8d8", 0.22, 0.1));
    dot.userData.flowCurve = curve; dot.userData.flowOffset = (index * 0.23) % 1;
    dot.visible = currentActive; wireGroup.add(dot); activeFlowDots.push(dot);
  });
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
  try { localStorage.setItem(storageKey, JSON.stringify({ version: 1, parts, wires, nextId, voltage, resistance })); }
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
    parts = data.parts.filter((part) => part && palette[part.type] && typeof part.id === "string").slice(0, 25).map((part) => ({
      id: part.id, type: part.type, x: THREE.MathUtils.clamp(Number(part.x) || 0, -5.2, 5.2), z: THREE.MathUtils.clamp(Number(part.z) || 0, -3.1, 3.1),
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
  controls?.update();
  renderer.render(scene, camera);
}
init();