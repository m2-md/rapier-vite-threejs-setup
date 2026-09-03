import * as THREE from "three";

export interface Stage {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
}

/**
 * Presentation layer. Independent from physics: no Rapier types used here.
 * "Dark cinematic + neon": ACES tone mapping, PCFShadowMap, emissive neon
 * strips. Heavy post-processing (bloom) omitted — 30 objects, priority is performance.
 */
export function buildScene(): Stage {
  const canvas = document.getElementById("scene") as HTMLCanvasElement;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.shadowMap.enabled = true;
  // PCFSoftShadowMap was deprecated in r185; PCFShadowMap is valid and cheap.
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060b);
  scene.fog = new THREE.Fog(0x05060b, 18, 46);

  const camera = new THREE.PerspectiveCamera(
    46,
    window.innerWidth / window.innerHeight,
    0.1,
    120,
  );
  camera.position.set(7.5, 5.2, 10.5);
  camera.lookAt(0, 1.2, 0);

  // Floor: collider cuboid(12, 0.1, 12) aligned exactly — top surface y = 0.1.
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(24, 0.2, 24),
    new THREE.MeshStandardMaterial({
      color: 0x0a0f1c,
      roughness: 0.55,
      metalness: 0.25,
    }),
  );
  floor.receiveShadow = true;
  scene.add(floor);

  // Neon grid — cheap single LineSegments draw.
  const grid = new THREE.GridHelper(24, 24, 0x22d3ee, 0x14304a);
  grid.position.y = 0.101;
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.28;
  scene.add(grid);

  // Four emissive strips along platform edges: neon look without bloom.
  const stripColors = [0x22d3ee, 0xa78bfa, 0x22d3ee, 0xf472b6];
  const stripGeometry = new THREE.BoxGeometry(24.4, 0.06, 0.12);
  stripColors.forEach((color, i) => {
    const strip = new THREE.Mesh(
      stripGeometry,
      new THREE.MeshStandardMaterial({
        color: 0x0b1020,
        emissive: new THREE.Color(color),
        emissiveIntensity: 2.4,
      }),
    );
    strip.rotation.y = (i * Math.PI) / 2;
    strip.position.set(
      i % 2 === 0 ? 0 : i === 1 ? 12.2 : -12.2,
      0.12,
      i % 2 === 0 ? (i === 0 ? 12.2 : -12.2) : 0,
    );
    scene.add(strip);
  });

  scene.add(new THREE.AmbientLight(0x2b3a5c, 1.1));
  scene.add(new THREE.HemisphereLight(0x9ad8ff, 0x090c14, 0.55));

  const key = new THREE.DirectionalLight(0xdff3ff, 3.1);
  key.position.set(6, 11, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 40;
  key.shadow.camera.left = -10;
  key.shadow.camera.right = 10;
  key.shadow.camera.top = 10;
  key.shadow.camera.bottom = -10;
  key.shadow.bias = -0.0006;
  scene.add(key);

  // Non-shadow-casting dual color rim lights: gives neon contour to box edges.
  const rimA = new THREE.PointLight(0x22d3ee, 55, 26);
  rimA.position.set(-7, 3.6, -6);
  scene.add(rimA);

  const rimB = new THREE.PointLight(0xf472b6, 34, 24);
  rimB.position.set(6.5, 2.4, -7.5);
  scene.add(rimB);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  });

  return { scene, camera, renderer };
}
