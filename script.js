/* ============================================================
THE PAPER CUP — script.js
Three.js: GLTFLoader, OrbitControls, освещение,
адаптация под любой масштаб модели, reveal-анимации при скролле
============================================================ */

// Импорты Three.js (подключены в index.html через importmap CDN)
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/* -
КОНФИГУРАЦИЯ
Пути к ассетам — при деплое на GitHub Pages файлы должны
лежать по этим путям относительно index.html.
- */
const ASSETS = {
  glb: "assets/cup.glb",
};

/* -
СЦЕНА, КАМЕРА, РЕНДЕРЕР
- */
const canvas = document.getElementById("three-canvas");
const scene = new THREE.Scene();
scene.background = null; // прозрачный фон — стили задаёт CSS-карточка

// Камера
const camera = new THREE.PerspectiveCamera(
  40, // угол обзора
  1, // aspect (обновится в resize)
  0.1, // near
  1000 // far
);
camera.position.set(4, 2.5, 6); // стартовая позиция

// Рендерер
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true, // прозрачный фон canvas
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // retina без перегруза GPU
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; // мягкий кинематографичный свет
renderer.toneMappingExposure = 1.15;

/* -
2. ОСВЕЩЕНИЕ
GLTF использует PBR-материалы, которые отлично реагируют на физически корректный свет.
- */
// Мягкая базовая заливка — убирает провалы в черноту в тенях
const ambient = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambient);

// Ключевой свет — имитация окон/софтбокса сверху-сбоку
const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
keyLight.position.set(5, 8, 5);
scene.add(keyLight);

// Заполняющий свет с противоположной стороны (слабее и холоднее)
const fillLight = new THREE.DirectionalLight(0xbfd4ff, 0.7);
fillLight.position.set(-6, 3, -4);
scene.add(fillLight);

// Подсветка снизу-сзади — красноватый рим, подчёркивает силуэт
const rimLight = new THREE.DirectionalLight(0xff6b6b, 0.9);
rimLight.position.set(0, -2, -7);
scene.add(rimLight);

/* -
3. ОРБИТАЛЬНОЕ УПРАВЛЕНИЕ (вращение мышкой / пальцем)
- */
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; // плавная инерция вращения
controls.dampingFactor = 0.06;
controls.rotateSpeed = 0.7;
controls.minDistance = 1.5; // ограничения зума
controls.maxDistance = 30;
controls.autoRotate = true; // медленное авто-вращение в фоне
controls.autoRotateSpeed = 1.2;

/* -
4. ЗАГРУЗКА МОДЕЛИ (GLTF/GLB)
GLTFLoader загружает геометрию, материалы, текстуры и цвета
из Blender «как есть», без необходимости раздельной загрузки .mtl.
- */
const loaderOverlay = document.getElementById("viewer-loader");
const loaderText = loaderOverlay.querySelector("p");

/** Автоматически подгоняет камеру и границы вращения под размер
загруженной модели — работает с любым масштабом экспорта из Blender. */
function frameModel(object) {
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  // Центрируем модель в начале координат
  object.position.sub(center);

  // Ставим камеру на расстоянии, с которого модель видна целиком
  const fitDistance = maxDim / Math.tan((camera.fov * Math.PI) / 360) * 1.1;
  camera.position.set(fitDistance * 0.7, fitDistance * 0.45, fitDistance);
  controls.target.set(0, 0, 0);
  controls.update();

  // Границы зума — тоже в масштабе модели
  controls.minDistance = maxDim * 0.6;
  controls.maxDistance = maxDim * 6;
  camera.near = maxDim / 100;
  camera.far = maxDim * 100;
  camera.updateProjectionMatrix();
}

new GLTFLoader().load(
  ASSETS.glb,
  (gltf) => {
    const model = gltf.scene;

    // Настраиваем материалы и тени для всех мешей в модели
    model.traverse((child) => {
      if (child.isMesh) {
        // Включаем тени (опционально, но полезно для PBR)
        child.castShadow = true;
        child.receiveShadow = true;

        // Убеждаемся, что текстуры (если есть) в правильном цветовом пространстве
        if (child.material.map) {
          child.material.map.colorSpace = THREE.SRGBColorSpace;
        }
      }
    });

    scene.add(model);
    frameModel(model);

    // Прячем оверлей загрузки
    loaderOverlay.classList.add("hidden");
  },
  // Прогресс-индикатор
  (xhr) => {
    if (xhr.total) {
      loaderText.textContent =
        "Загрузка модели… " +
        Math.round((xhr.loaded / xhr.total) * 100) + "%";
    }
  },
  // Ошибка
  (err) => {
    console.error("Ошибка загрузки cup.glb:", err);
    loaderText.textContent = "Не удалось загрузить cup.glb";
  }
);

/* -
5. РЕСАЙЗ И ЦИКЛ РЕНДЕРА
- */
function resizeRenderer() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (
    canvas.width === width * renderer.getPixelRatio() &&
    canvas.height === height * renderer.getPixelRatio()
  )
    return;

  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function animate() {
  requestAnimationFrame(animate);
  resizeRenderer(); // canvas «резиновый» — проверяем размер каждый кадр
  controls.update(); // damping + autoRotate требуют update()
  renderer.render(scene, camera);
}
animate();

/* -
6. REVEAL-АНИМАЦИИ ПРИ СКРОЛЛЕ (IntersectionObserver)
- */
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        revealObserver.unobserve(entry.target); // анимируем один раз
      }
    });
  },
  { threshold: 0.12 }
);

document.querySelectorAll(".reveal").forEach((el) => revealObserver.observe(el));

/* -
7. КНОПКА «WATCH ANIMATION» — скролл к видео
- */
document.getElementById("btn-watch").addEventListener("click", () => {
  document.getElementById("animation").scrollIntoView({ behavior: "smooth" });
});
