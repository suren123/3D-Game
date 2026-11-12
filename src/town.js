import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LOCATIONS, findRoute } from './game.js';

/** Procedural town plus a bundled CC0 Kenney car; no runtime third-party requests. */
export function createTown(container, { onLocationTap, onArrival, onFrame } = {}) {
  const scene = new THREE.Scene();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(0xffffff, 0);
  renderer.domElement.className = 'town-renderer';
  renderer.domElement.setAttribute('aria-label', '小车忙忙镇：点击小镇里的建筑，让小车出发');
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
  container.appendChild(renderer.domElement);

  const camera = new THREE.OrthographicCamera(-16, 16, 12, -12, 0.1, 150);
  camera.position.set(25, 30, 35);
  camera.lookAt(0, 0.4, 0);
  scene.add(new THREE.HemisphereLight(0xfff9e9, 0x91aa85, 1.8));
  const sun = new THREE.DirectionalLight(0xfff1d8, 2.5);
  sun.position.set(-12, 24, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, near: 1, far: 65 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.035;
  sun.shadow.radius = 3;
  scene.add(sun);

  const materials = new Map();
  const geometries = new Map();
  const textures = [];
  const interactives = [];
  const rotating = [];
  const balloons = [];
  const mat = (color, extra = {}) => {
    const key = color + JSON.stringify(extra);
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.87, ...extra }));
    return materials.get(key);
  };
  const geom = (key, make) => {
    if (!geometries.has(key)) geometries.set(key, make());
    return geometries.get(key);
  };
  function mesh(geometry, color, x, y, z, parent = scene, materialExtra) {
    const obj = new THREE.Mesh(geometry, mat(color, materialExtra));
    obj.position.set(x, y, z);
    obj.castShadow = true;
    obj.receiveShadow = true;
    parent.add(obj);
    return obj;
  }
  function box(w, h, d, color, x, y, z, parent = scene, round = 0) {
    const key = `box:${w},${h},${d},${round}`;
    return mesh(geom(key, () => round ? new RoundedBoxGeometry(w, h, d, 2, Math.min(round, w / 3, h / 3, d / 3)) : new THREE.BoxGeometry(w, h, d)), color, x, y, z, parent);
  }
  function cylinder(top, bottom, height, color, x, y, z, parent = scene, segments = 12) {
    return mesh(geom(`cyl:${top},${bottom},${height},${segments}`, () => new THREE.CylinderGeometry(top, bottom, height, segments)), color, x, y, z, parent);
  }
  function ball(radius, color, x, y, z, parent = scene, detail = 1) {
    return mesh(geom(`ico:${radius},${detail}`, () => new THREE.IcosahedronGeometry(radius, detail)), color, x, y, z, parent);
  }
  function planeRing(radius, tube, color, x, y, z, parent = scene) {
    const obj = mesh(geom(`torus:${radius},${tube}`, () => new THREE.TorusGeometry(radius, tube, 6, 36)), color, x, y, z, parent);
    obj.rotation.x = -Math.PI / 2;
    return obj;
  }
  function makeGroup(x, z, id) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.userData.locationId = id;
    scene.add(group);
    if (id) interactives.push(group);
    return group;
  }
  function sign(text, x, y, z, color = '#477367', parent = scene, width = 1.7) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff9e9';
    ctx.fillRect(0, 0, 512, 160);
    ctx.fillStyle = color;
    ctx.font = 'bold 75px "Arial", "Noto Sans CJK SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 85);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.push(texture);
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const obj = new THREE.Mesh(geom('signPlane', () => new THREE.PlaneGeometry(1, 1)), material);
    obj.scale.set(width, width * 160 / 512, 1);
    obj.position.set(x, y, z);
    parent.add(obj);
    return obj;
  }

  // Floating toy-board, with a layered, rounded edge.
  box(21.5, 0.72, 19, '#82b99b', 0, -0.50, 0, scene, 0.65);
  box(21.4, 0.20, 18.9, '#c0dca6', 0, -0.04, 0, scene, 0.55);
  box(20.8, 0.075, 18.3, '#b9dba0', 0, 0.10, 0, scene, 0.48);
  const shadowFloor = mesh(new THREE.PlaneGeometry(200, 200), '#ffffff', 0, -0.91, 0, scene);
  shadowFloor.rotation.x = -Math.PI / 2;
  shadowFloor.material = new THREE.ShadowMaterial({ opacity: 0.13 });
  shadowFloor.castShadow = false;
  shadowFloor.receiveShadow = true;

  // Connected road graph: every node is on the same 3 by 3 street grid.
  const roadColor = '#93aaa5';
  for (const value of [-5, 0, 5]) {
    box(1.6, 0.035, 13.1, '#e3ead3', value, 0.16, 0, scene, 0.12);
    box(1.33, 0.035, 13.1, roadColor, value, 0.19, 0, scene, 0.1);
    box(13.1, 0.035, 1.6, '#e3ead3', 0, 0.16, value, scene, 0.12);
    box(13.1, 0.035, 1.33, roadColor, 0, 0.19, value, scene, 0.1);
  }
  for (const row of [-5, 0, 5]) {
    for (const n of [-3.8, -2.7, -1.6, 1.6, 2.7, 3.8]) {
      box(0.48, 0.015, 0.055, '#f5edcd', n, 0.218, row);
      box(0.055, 0.015, 0.48, '#f5edcd', row, 0.218, n);
    }
  }
  for (const [x, z, rotation] of [[-5, -3.8, 0], [1.2, 0, Math.PI / 2], [5, 3.8, 0]]) {
    const crossing = makeGroup(x, z);
    crossing.rotation.y = rotation;
    for (let i = -2; i <= 2; i++) box(0.19, 0.019, 0.66, '#fff7dd', i * 0.25, 0.23, 0, crossing);
  }

  function tree(x, z, scale = 1, color = '#61a77b') {
    const g = makeGroup(x, z);
    g.scale.setScalar(scale);
    cylinder(0.13, 0.19, 1.15, '#ba8d5f', 0, 0.68, 0, g, 7);
    ball(0.85, color, 0, 1.75, 0, g, 0).scale.set(0.9, 1.23, 0.9);
    ball(0.53, '#88be80', -0.38, 1.49, 0.18, g, 0);
    return g;
  }
  function bush(x, z, scale = 1) {
    ball(0.48 * scale, '#79b87b', x, 0.35 * scale, z, scene, 0).scale.y = 0.7;
  }
  function flower(x, z, color = '#f6ac68', parent = scene) {
    cylinder(0.025, 0.025, 0.32, '#6b9c61', x, 0.3, z, parent, 5);
    const head = ball(0.11, color, x, 0.48, z, parent, 0);
    head.scale.y = 0.5;
    ball(0.04, '#ffe8a0', x, 0.53, z, parent, 0);
  }
  function fence(x, z, length, rotation = 0) {
    const g = makeGroup(x, z);
    g.rotation.y = rotation;
    box(length, 0.09, 0.08, '#fff5d7', 0, 0.55, 0, g);
    box(length, 0.09, 0.08, '#fff5d7', 0, 0.30, 0, g);
    for (let n = -length / 2; n <= length / 2 + 0.01; n += 0.45) box(0.13, 0.68, 0.12, '#fff5d7', n, 0.43, 0, g, 0.03);
  }
  function windowAt(x, y, z, parent, w = 0.45, h = 0.5) {
    box(w + 0.14, h + 0.14, 0.08, '#fff5db', x, y, z, parent, 0.06);
    box(w, h, 0.09, '#82c7d1', x, y, z + 0.03, parent, 0.03);
    box(0.035, h, 0.035, '#fff5db', x, y, z + 0.08, parent);
  }
  function roof(width, height, depth, color, parent, y) {
    const geometry = geom(`roof:${width},${height},${depth}`, () => {
      const shape = new THREE.Shape();
      shape.moveTo(-width / 2, 0);
      shape.lineTo(0, height);
      shape.lineTo(width / 2, 0);
      shape.closePath();
      const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1 });
      g.translate(0, 0, -depth / 2);
      return g;
    });
    return mesh(geometry, color, 0, y, 0, parent);
  }
  function groundPad(g, w, d, color = '#eadfc2') {
    box(w, 0.1, d, color, 0, 0.20, 0, g, 0.18);
  }

  const garage = makeGroup(...LOCATIONS.garage.building, 'garage');
  groundPad(garage, 3.1, 3.0);
  box(2.5, 1.65, 2.1, '#72b9a8', 0, 1.02, 0, garage, 0.14);
  roof(2.85, 0.76, 2.5, '#3d9189', garage, 1.85);
  box(1.47, 1.1, 0.1, '#f8e7b9', 0, 0.8, 1.09, garage, 0.11);
  for (let i = 0; i < 5; i++) box(1.35, 0.035, 0.035, '#dfcca1', 0, 0.44 + i * 0.17, 1.16, garage);
  sign('小车之家', 0, 1.64, 1.10, '#37796d', garage, 1.8);
  cylinder(0.12, 0.12, 0.16, '#ffdd88', 1.02, 1.23, 1.16, garage);
  box(1.55, 0.03, 0.55, '#d7d9b9', 0, 0.25, 1.38, garage);

  const bakery = makeGroup(...LOCATIONS.bakery.building, 'bakery');
  groundPad(bakery, 3.4, 3.0, '#f3e2c5');
  box(2.6, 1.75, 2.05, '#ee927d', 0, 1.08, 0, bakery, 0.14);
  roof(2.95, 0.72, 2.48, '#c86c59', bakery, 1.92);
  box(0.66, 1.09, 0.08, '#fce8bc', 0.6, 0.85, 1.06, bakery, 0.05);
  box(0.49, 0.68, 0.09, '#8dc9cc', 0.6, 1.01, 1.11, bakery, 0.03);
  windowAt(-0.55, 0.96, 1.07, bakery, 0.8, 0.62);
  for (let i = 0; i < 8; i++) {
    const awning = box(0.34, 0.12, 0.78, i % 2 ? '#fff4d9' : '#dc7866', -1.19 + i * 0.34, 1.51, 1.37, bakery, 0.035);
    awning.rotation.x = 0.18;
    box(0.34, 0.21, 0.09, i % 2 ? '#fff4d9' : '#dc7866', -1.19 + i * 0.34, 1.39, 1.74, bakery, 0.06);
  }
  sign('面包店', 0, 1.86, 1.04, '#a95541', bakery, 1.75);
  const bread = ball(0.39, '#efb45e', 0, 2.65, 0, bakery, 1);
  bread.scale.set(1.8, 0.78, 0.8);
  for (let i = -1; i <= 1; i++) {
    const slash = box(0.045, 0.04, 0.29, '#ffe1a0', i * 0.27, 2.96, 0.02, bakery);
    slash.rotation.y = -0.4;
  }

  const garden = makeGroup(...LOCATIONS.garden.building, 'garden');
  groundPad(garden, 3.1, 3.15, '#d5e3ae');
  box(2.2, 1.45, 1.95, '#f0c978', 0, 0.95, 0, garden, 0.12);
  roof(2.5, 0.95, 2.3, '#91be9e', garden, 1.71);
  windowAt(-0.5, 0.97, 1.0, garden, 0.5, 0.65);
  box(0.58, 1.13, 0.08, '#fff1ca', 0.45, 0.8, 1.0, garden, 0.04);
  sign('小花房', 0, 1.62, 1.03, '#607c5c', garden, 1.6);
  for (let i = 0; i < 4; i++) {
    cylinder(0.20, 0.15, 0.28, '#cf8b66', -0.9 + i * 0.59, 0.36, 1.35, garden, 7);
    flower(-0.9 + i * 0.59, 1.35, ['#ec8d9d', '#fff0ac', '#bc9cc8', '#f1aa55'][i], garden);
  }

  const station = makeGroup(...LOCATIONS.station.building, 'station');
  groundPad(station, 3.3, 3.5);
  box(2.6, 2.2, 2.4, '#e2856d', 0, 1.35, 0, station, 0.12);
  box(2.9, 0.27, 2.7, '#ba6251', 0, 2.57, 0, station, 0.1);
  box(1.65, 1.24, 0.10, '#fff2d3', 0, 0.91, 1.24, station, 0.08);
  box(1.43, 1.01, 0.12, '#9bbfc0', 0, 0.9, 1.30, station, 0.06);
  for (let i = 0; i < 4; i++) box(1.45, 0.04, 0.05, '#d1e3d7', 0, 0.52 + i * 0.24, 1.38, station);
  sign('消防小站', 0, 2.03, 1.23, '#ae5546', station, 2.0);
  const badge = ball(0.39, '#f5cf7f', 0, 2.97, 0.1, station, 0);
  badge.scale.set(0.9, 1.0, 0.3);
  box(0.07, 1.2, 0.07, '#dfca95', 1.12, 2.92, 0.75, station);
  box(0.56, 0.36, 0.04, '#ffe6a2', 1.38, 3.2, 0.75, station);

  const park = makeGroup(...LOCATIONS.park.building, 'park');
  groundPad(park, 3.9, 3.6, '#99cb8f');
  cylinder(0.87, 0.93, 0.20, '#f0dfbb', -0.3, 0.34, -0.2, park, 20);
  cylinder(0.73, 0.73, 0.05, '#8ac8cc', -0.3, 0.47, -0.2, park, 20);
  cylinder(0.10, 0.15, 0.53, '#f8e9c8', -0.3, 0.68, -0.2, park);
  ball(0.19, '#a1d9d4', -0.3, 0.98, -0.2, park, 1);
  for (let n = 0; n < 4; n++) {
    const t = n * Math.PI / 2;
    ball(0.08, '#d9f4de', -0.3 + Math.cos(t) * 0.34, 0.71, -0.2 + Math.sin(t) * 0.34, park, 1);
  }
  box(1.3, 0.13, 0.45, '#d9a36c', 0.65, 0.56, 1.1, park, 0.04);
  box(1.3, 0.45, 0.10, '#e2b27c', 0.65, 0.85, 1.3, park, 0.04);
  for (const x of [0.16, 1.14]) box(0.10, 0.35, 0.4, '#748e76', x, 0.34, 1.1, park);
  tree(3.5, 1.2, 0.8, '#75ae77');
  tree(1.0, 3.7, 0.65, '#a0bf6e');
  fence(2.25, 4.36, 3.2);
  flower(3.6, 3.6, '#ee9ca1');
  flower(3.3, 3.8, '#f9d780');

  const wash = makeGroup(...LOCATIONS.wash.building, 'wash');
  groundPad(wash, 3.1, 3.3, '#d0e5db');
  box(2.6, 0.38, 2.55, '#76b5ce', 0, 2.0, 0, wash, 0.15);
  for (const x of [-1, 1]) box(0.43, 1.65, 2.1, '#9acdd7', x, 1.0, 0, wash, 0.15);
  box(1.58, 0.08, 2.8, '#93c7c8', 0, 0.32, 0.2, wash, 0.05);
  sign('泡泡洗车', 0, 2.03, 1.3, '#3a90a7', wash, 2.1);
  for (const x of [-0.74, 0.74]) {
    const brush = cylinder(0.23, 0.23, 1.25, '#d8a4bc', x, 1.0, 0.35, wash, 10);
    rotating.push(brush);
    for (let y = 0; y < 5; y++) planeRing(0.24, 0.045, '#efc1d1', x, 0.5 + y * 0.22, 0.35, wash);
  }
  for (const [x, y, z, r] of [[-0.7,2.7,0,0.3],[0.2,2.9,0.1,0.4],[0.8,2.65,0,0.25]]) {
    const bubble = ball(r, '#d9f0e8', x, y, z, wash, 1);
    balloons.push({ mesh: bubble, y, phase: x * 2, scale: 0.07 });
  }

  // A little playground, meadow and decorative edges keep the town inviting.
  const playground = makeGroup(-2.5, 2.5);
  groundPad(playground, 3.3, 3.4, '#c7d99a');
  box(1.8, 0.16, 1.7, '#ead6a2', 0.2, 0.28, 0.2, playground, 0.14);
  const slide = box(0.62, 0.10, 1.65, '#e99174', 0.35, 0.76, 0.1, playground, 0.06);
  slide.rotation.x = -0.6;
  for (const x of [0.05, 0.65]) box(0.09, 1.35, 0.09, '#f4cc72', x, 0.9, -0.65, playground);
  box(0.8, 0.10, 0.6, '#f4cc72', 0.35, 1.4, -0.65, playground);
  for (let n = 0; n < 4; n++) box(0.6, 0.06, 0.08, '#f5d58c', 0.35, 0.55 + n * 0.22, -0.84, playground);
  tree(-3.7, 3.8, 0.62, '#77a77b');
  fence(-2.3, 4.25, 3.2);
  const meadowTrees = [
    [-9,-3,1.05],[-9,3.6,0.94],[-8,7.2,1.1],[-5.8,7.7,0.8],[-2.7,7.6,0.85],
    [0,7.5,0.88],[2.6,7.4,0.68],[8.8,7.3,0.92],[8.7,0.3,0.85],[9.2,-2.8,0.9],
    [-3,-7.6,0.65],[3.1,-8,0.72],[-9,-7.9,0.67],[-2.8,-2.5,0.82],[2.6,-2.7,0.65],
  ];
  meadowTrees.forEach(([x,z,s], i) => tree(x,z,s, ['#76ac7d','#8ab87c','#5d9c79'][i%3]));
  [[-9,0],[-8,5.3],[-6.9,7.8],[3.6,7.2],[8.9,6.1],[8.7,-4.3],[-2.3,-8.2],[2.9,-7.8]].forEach(([x,z]) => bush(x,z));
  for (let i=0;i<18;i++) {
    const side = i < 9 ? -1 : 1;
    const x = side * (7.3 + (i%3)*0.75);
    const z = i < 9 ? 5.6+(i%4)*0.55 : -1.8+(i%4)*0.45;
    flower(x,z,['#fff3bc','#efb0a3','#d4afe0'][i%3]);
  }
  // Tiny delivery parcels make the bakery feel like a place with a purpose.
  for (const [x,z] of [[-1.6,-6.1],[-1.7,-6.6]]) box(0.4,0.4,0.4,'#d8b57c',x,0.4,z,scene,0.04);

  // Friendly toy car. Local +Z is forward.
  const car = makeGroup(...LOCATIONS.garage.node);
  car.position.y = 0.22;
  const carBody = new THREE.Group();
  car.add(carBody);
  box(0.96, 0.37, 1.65, '#f1bc61', 0, 0.46, 0, carBody, 0.16);
  box(0.82, 0.47, 0.82, '#e98368', 0, 0.83, -0.1, carBody, 0.13);
  box(0.65, 0.27, 0.06, '#7cbbc4', 0, 0.88, 0.32, carBody, 0.04);
  box(0.65, 0.25, 0.06, '#7cbbc4', 0, 0.88, -0.53, carBody, 0.04);
  for (const x of [-0.43,0.43]) {
    box(0.04,0.25,0.57,'#9cd0d2',x,0.87,-0.10,carBody,0.03);
    box(0.05,0.30,0.055,'#f6d499',x*1.02,0.87,-0.08,carBody);
  }
  box(0.97,0.12,0.16,'#fff1c9',0,0.30,0.82,carBody,0.05);
  box(0.8,0.12,0.13,'#df8c58',0,0.31,-0.84,carBody,0.03);
  for (const x of [-0.29,0.29]) {
    box(0.20,0.16,0.06,'#fff5b3',x,0.49,0.83,carBody,0.04);
    box(0.16,0.11,0.06,'#c96950',x,0.47,-0.84,carBody,0.02);
  }
  const wheels=[];
  for (const x of [-0.51,0.51]) for (const z of [-0.51,0.51]) {
    const wheel=cylinder(0.24,0.24,0.16,'#46575c',x,0.26,z,carBody,12);
    wheel.rotation.z=Math.PI/2;
    wheels.push(wheel);
    const hub=cylinder(0.115,0.115,0.17,'#fff1cd',x,0.26,z,carBody,10);
    hub.rotation.z=Math.PI/2;
  }
  car.rotation.y = Math.PI / 2;

  // Keep the complete original car as a no-network/no-model fallback.
  const proceduralCar = new THREE.Group();
  [...carBody.children].forEach(child => proceduralCar.add(child));
  carBody.add(proceduralCar);
  const breadCargo = new THREE.Group();
  const flowerCargo = new THREE.Group();
  carBody.add(breadCargo, flowerCargo);
  breadCargo.visible = false;
  flowerCargo.visible = false;
  box(0.75, 0.20, 0.63, '#c6955d', 0, 1.28, -0.13, breadCargo, 0.04);
  for (const x of [-0.22, 0, 0.22]) {
    const loaf = ball(0.17, '#edbd69', x, 1.44, -0.13, breadCargo, 1);
    loaf.scale.set(0.65, 0.75, 1.5);
  }
  box(0.70, 0.20, 0.60, '#d4ad71', 0, 1.28, -0.13, flowerCargo, 0.04);
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 0.23;
    cylinder(0.025, 0.025, 0.37, '#7a9e62', x, 1.54, -0.13, flowerCargo, 5);
    ball(0.15, ['#f5d479', '#e99c9e', '#d3abd6'][i], x, 1.76, -0.13, flowerCargo, 0);
  }

  const picnicReward = new THREE.Group();
  park.add(picnicReward);
  picnicReward.visible = false;
  box(1.0, 0.1, 0.62, '#fff1d0', -0.85, 0.65, 1.0, picnicReward, 0.05);
  for (const x of [-1.17, -0.53]) box(0.09, 0.37, 0.48, '#c4996c', x, 0.43, 1.0, picnicReward);
  for (const x of [-1.1, -0.8, -0.5]) ball(0.15, '#e9b566', x, 0.79, 1.0, picnicReward, 1).scale.set(0.75, 0.55, 1.3);
  const plantedReward = new THREE.Group();
  station.add(plantedReward);
  plantedReward.visible = false;
  box(2.1, 0.24, 0.41, '#ba8c68', 0, 0.32, 1.64, plantedReward, 0.06);
  for (let i = 0; i < 6; i++) flower(-0.85 + i * 0.34, 1.64, ['#f4d274', '#ed999b', '#c9a3d4'][i % 3], plantedReward);

  const washEffect = new THREE.Group();
  scene.add(washEffect);
  const washParticles = [];
  for (let i = 0; i < 16; i++) {
    const bubble = ball(0.13 + (i % 3) * 0.045, ['#d9f2e7', '#aee0e3', '#fff4de'][i % 3], 0, 0, 0, washEffect, 1);
    bubble.castShadow = false;
    bubble.visible = false;
    washParticles.push(bubble);
  }

  const targetRing = planeRing(0.7, 0.075, '#ffda75', 0, 0.26, 0);
  targetRing.castShadow = false;
  targetRing.material = new THREE.MeshBasicMaterial({ color: '#ffdc75', transparent: true, opacity: 0.9 });
  targetRing.visible = false;
  const targetDot = cylinder(0.35,0.35,0.015,'#fff4be',0,0.24,0,scene,24);
  targetDot.visible=false;
  targetDot.castShadow=false;

  const confettiGeometry = geom('confetti',()=>new THREE.BoxGeometry(0.10,0.05,0.18));
  const confetti=[];
  const colors=['#f5c86a','#ec8c77','#92cbb5','#a5bde3','#dfb1d2'];
  for(let i=0;i<36;i++) {
    const part=mesh(confettiGeometry,colors[i%colors.length],0,0,0);
    part.castShadow=false;
    part.visible=false;
    confetti.push({mesh:part, velocity:new THREE.Vector3(), life:0});
  }

  let location='garage';
  let moving=false;
  let paused=false;
  let disposed=false;
  let destination=null;
  let points=[];
  let segment=0;
  let speed=3;
  let time=0;
  let previous=performance.now();
  let frameId=0;
  let width=1,height=1;
  let target=null;
  let model='loading';
  let cargo=null;
  let washTime=0;
  let actionFeedback=null;

  // This also handles late GLTF completion after the town has been disposed.
  function releaseTree(root, disposedGeometry = new Set(), disposedMaterials = new Set(), disposedTextures = new Set()) {
    root.traverse(object => {
      if (object.geometry && !disposedGeometry.has(object.geometry)) {
        object.geometry.dispose();
        disposedGeometry.add(object.geometry);
      }
      const list = Array.isArray(object.material) ? object.material : [object.material];
      list.filter(Boolean).forEach(material => {
        if (disposedMaterials.has(material)) return;
        Object.values(material).forEach(value => {
          if (!value?.isTexture || disposedTextures.has(value)) return;
          value.dispose();
          // GLTFLoader may decode images to ImageBitmaps, which need explicit cleanup.
          value.source?.data?.close?.();
          disposedTextures.add(value);
        });
        material.dispose();
        disposedMaterials.add(material);
      });
    });
  }

  new GLTFLoader().load(`${import.meta.env.BASE_URL}models/kenney-car/taxi.glb`, gltf => {
    if (disposed) { releaseTree(gltf.scene); return; }
    const loaded = gltf.scene;
    const modelWheels = [];
    let meshCount = 0;
    let hasTexture = false;
    loaded.traverse(object => {
      if (object.name.startsWith('wheel-')) modelWheels.push(object);
      if (object.isMesh) {
        meshCount++;
        object.castShadow = true;
        object.receiveShadow = true;
        const list = Array.isArray(object.material) ? object.material : [object.material];
        list.forEach(material => { if (material?.map) hasTexture = true; });
      }
    });
    // A missing external color atlas must not replace the friendly fallback with a blank car.
    if (!meshCount || !hasTexture) {
      releaseTree(loaded);
      model = 'procedural-fallback';
      return;
    }
    loaded.scale.setScalar(0.7);
    loaded.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(loaded);
    loaded.position.y -= bounds.min.y;
    carBody.add(loaded);
    proceduralCar.visible = false;
    wheels.splice(0, wheels.length, ...modelWheels);
    model = 'kenney-taxi';
  }, undefined, () => {
    if (!disposed) model = 'procedural-fallback';
  });

  function clearCargo() {
    breadCargo.visible = false;
    flowerCargo.visible = false;
    cargo = null;
    actionFeedback = null;
    washTime = 0;
    washParticles.forEach(particle => { particle.visible = false; });
  }

  function performAction(missionId, stepIndex) {
    if (disposed || moving || paused || !['bread','flowers','wash'].includes(missionId) || ![0,1].includes(stepIndex)) return false;
    const destinations = { bread:['bakery','park'], flowers:['garden','station'], wash:['wash','garage'] };
    if (location !== destinations[missionId][stepIndex]) return false;
    breadCargo.visible = false;
    flowerCargo.visible = false;
    cargo = null;
    actionFeedback = `${missionId}:${stepIndex}`;
    if (stepIndex === 0 && missionId === 'bread') { breadCargo.visible = true; cargo = 'bread'; }
    if (stepIndex === 0 && missionId === 'flowers') { flowerCargo.visible = true; cargo = 'flowers'; }
    if (stepIndex === 1 && missionId === 'bread') picnicReward.visible = true;
    if (stepIndex === 1 && missionId === 'flowers') plantedReward.visible = true;
    if (stepIndex === 0 && missionId === 'wash') {
      washTime = reducedMotion ? 1.4 : 2.6;
      washEffect.position.copy(car.position);
      washParticles.forEach((particle, i) => {
        const angle = i * Math.PI * 2 / washParticles.length;
        particle.position.set(Math.cos(angle) * 0.9, 0.55 + (i % 4) * 0.22, Math.sin(angle) * 1.1);
        particle.scale.setScalar(1);
        particle.visible = !reducedMotion || i < 6;
      });
    }
    return true;
  }

  function resize() {
    if(disposed) return;
    width=Math.max(1,container.clientWidth);
    height=Math.max(1,container.clientHeight);
    renderer.setSize(width,height,false);
    const aspect=width/height;
    // Fit the complete scene envelope to the fixed camera, without camera controls.
    camera.updateMatrixWorld();
    let maxX=0,maxY=0;
    for(const x of [-11.1,11.1]) for(const z of [-9.8,9.8]) for(const y of [-0.8,4]) {
      const point=new THREE.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse);
      maxX=Math.max(maxX,Math.abs(point.x));
      maxY=Math.max(maxY,Math.abs(point.y));
    }
    const halfHeight=Math.max(maxY,maxX/aspect)*1.025;
    camera.left=-halfHeight*aspect;
    camera.right=halfHeight*aspect;
    camera.top=halfHeight;
    camera.bottom=-halfHeight;
    camera.updateProjectionMatrix();
    renderer.render(scene,camera);
  }
  const resizeObserver=new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();

  const raycaster=new THREE.Raycaster();
  const pointer=new THREE.Vector2();
  let pointerStart=null;
  function pointerDown(event) { pointerStart={x:event.clientX,y:event.clientY}; }
  function pointerUp(event) {
    if(paused || !pointerStart || Math.hypot(event.clientX-pointerStart.x,event.clientY-pointerStart.y)>15) return;
    pointerStart=null;
    const rect=renderer.domElement.getBoundingClientRect();
    pointer.set(((event.clientX-rect.left)/rect.width)*2-1,-((event.clientY-rect.top)/rect.height)*2+1);
    raycaster.setFromCamera(pointer,camera);
    const hits=raycaster.intersectObjects(interactives,true);
    if(hits.length) {
      let object=hits[0].object;
      while(object && !object.userData.locationId) object=object.parent;
      if(object) onLocationTap?.(object.userData.locationId);
    }
  }
  renderer.domElement.addEventListener('pointerdown',pointerDown);
  renderer.domElement.addEventListener('pointerup',pointerUp);

  function projectLocations() {
    camera.updateMatrixWorld();
    const positions={};
    for(const [id, place] of Object.entries(LOCATIONS)) {
      const p=new THREE.Vector3(place.building[0],id==='park'?2.15:3.25,place.building[1]).project(camera);
      positions[id]={x:(p.x+1)*width/2,y:(1-p.y)*height/2};
    }
    return positions;
  }
  function travelTo(id) {
    if(disposed || paused || moving || !LOCATIONS[id]) return false;
    if(id===location) { onArrival?.(id); return true; }
    const route=findRoute(location,id);
    if(!Array.isArray(route) || route.length<2) return false;
    points=route.map(([x,z])=>new THREE.Vector3(x,0.22,z));
    points[0].copy(car.position);
    const distance=points.slice(1).reduce((sum,p,i)=>sum+p.distanceTo(points[i]),0);
    speed=distance/Math.min(6.5,Math.max(2.8,distance/3));
    segment=1;
    destination=id;
    moving=true;
    return true;
  }
  function setTarget(id) {
    target=LOCATIONS[id]?id:null;
    targetRing.visible=!!target;
    targetDot.visible=!!target;
    if(target) {
      targetRing.position.set(LOCATIONS[target].node[0],0.26,LOCATIONS[target].node[1]);
      targetDot.position.set(LOCATIONS[target].node[0],0.24,LOCATIONS[target].node[1]);
    }
  }
  function celebrate() {
    if (reducedMotion) return;
    for(let i=0;i<confetti.length;i++) {
      const particle=confetti[i];
      particle.mesh.position.copy(car.position).add(new THREE.Vector3(0,0.9,0));
      particle.mesh.visible=true;
      const theta=(i/confetti.length)*Math.PI*2;
      particle.velocity.set(Math.cos(theta)*(1+i%3*0.5),3.4+(i%5)*0.35,Math.sin(theta)*(1+i%3*0.5));
      particle.life=2.2;
    }
  }
  function animate(now) {
    if(disposed) return;
    frameId=requestAnimationFrame(animate);
    const dt=Math.min((now-previous)/1000,0.05);
    previous=now;
    if(!paused) {
      time+=dt;
      if(moving) {
        let distance=speed*dt;
        while(moving && distance>0) {
          const delta=points[segment].clone().sub(car.position);
          const remaining=delta.length();
          if(remaining>0.0001) {
            const targetAngle=Math.atan2(delta.x,delta.z);
            const angularDelta=Math.atan2(Math.sin(targetAngle-car.rotation.y),Math.cos(targetAngle-car.rotation.y));
            car.rotation.y+=angularDelta*Math.min(1,dt*12);
          }
          if(remaining<=distance) {
            car.position.copy(points[segment]);
            distance-=remaining;
            segment++;
            if(segment>=points.length) {
              moving=false;
              location=destination;
              carBody.position.y=0;
              onArrival?.(location);
            }
          } else { car.position.addScaledVector(delta.normalize(),distance); distance=0; }
        }
        if(moving && !reducedMotion) carBody.position.y=Math.sin(time*17)*0.015;
        wheels.forEach(w=>{w.rotation.x-=speed*dt*2;});
      } else { carBody.position.y=reducedMotion?0:Math.sin(time*2.5)*0.008; }
      targetRing.scale.setScalar(reducedMotion?1:1+Math.sin(time*3)*0.08);
      targetRing.material.opacity=reducedMotion?0.8:0.72+Math.sin(time*3)*0.15;
      if(!reducedMotion) rotating.forEach(obj=>{obj.rotation.y+=dt*0.7;});
      if(!reducedMotion) balloons.forEach(({mesh,y,phase,scale})=>{mesh.position.y=y+Math.sin(time*1.4+phase)*scale;});
      if (washTime > 0) {
        washTime = Math.max(0, washTime - dt);
        washParticles.forEach((particle, i) => {
          if (!reducedMotion) {
            particle.position.y += dt * (0.35 + (i % 3) * 0.12);
            particle.scale.setScalar(Math.max(0.01, Math.min(1, washTime * 2)));
          }
          if (washTime === 0) particle.visible = false;
        });
      }
      confetti.forEach(p=>{
        if(p.life<=0) return;
        p.life-=dt;
        p.velocity.y-=3*dt;
        p.mesh.position.addScaledVector(p.velocity,dt);
        p.mesh.rotation.x+=dt*3;
        p.mesh.rotation.z+=dt*2;
        if(p.life<=0 || p.mesh.position.y<0.2) p.mesh.visible=false;
      });
    }
    renderer.render(scene,camera);
    onFrame?.();
  }
  frameId=requestAnimationFrame(animate);

  return {
    travelTo, setTarget, projectLocations, resize, celebrate, performAction, clearCargo,
    setPaused(value) { paused=Boolean(value); previous=performance.now(); },
    getState() { return {
      location,moving,paused,target,model,cargo,actionFeedback,
      washing: washTime > 0,
      position:{x:car.position.x,z:car.position.z},
      renderInfo:{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles},
    }; },
    dispose() {
      if(disposed) return;
      disposed=true;
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown',pointerDown);
      renderer.domElement.removeEventListener('pointerup',pointerUp);
      const disposedGeometry=new Set();
      const disposedMaterials=new Set();
      const disposedTextures=new Set();
      releaseTree(scene, disposedGeometry, disposedMaterials, disposedTextures);
      materials.forEach(material=>{if(!disposedMaterials.has(material)) material.dispose();});
      geometries.forEach(geometry=>{if(!disposedGeometry.has(geometry)) geometry.dispose();});
      textures.forEach(texture=>{if(!disposedTextures.has(texture)) texture.dispose();});
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
