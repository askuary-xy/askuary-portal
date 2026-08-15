import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import type { Friend, NavStar } from '../types/config';

export type SolarScreenTarget = {
  id: string;
  x: number;
  y: number;
  r: number;
  friendIndex?: number;
  craftIndex?: number;
};

type PlanetSpec = {
  id: string;
  radius: number;
  orbit: number;
  angle: number;
  speed: number;
  texture: string;
  clouds?: string;
  ring?: boolean;
};

type PlanetNode = {
  spec: PlanetSpec;
  anchor: THREE.Group;
  globe: THREE.Mesh<THREE.SphereGeometry, THREE.Material>;
  clouds?: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  moonOrbit?: THREE.Group;
  moon?: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
};

type FriendNode = {
  friend: Friend;
  anchor: THREE.Group;
  orbitRadius: number;
  orbitSpeed: number;
  orbitPhase: number;
  orbitPlane: THREE.Quaternion;
};

type NavigationCraftNode = {
  nav: NavStar;
  anchor: THREE.Group;
  visual: THREE.Group;
  variant: StationVariant;
  modelUrl: string;
  modelRequested: boolean;
  hostId: string;
  orbitRadius: number;
  orbitPlane: THREE.Quaternion;
  speed: number;
  phase: number;
};

type StationVariant = 'hub' | 'spine' | 'ring';

type StationTextureSet = {
  diffuse: THREE.Texture;
  emission: THREE.Texture;
  metalness: THREE.Texture;
  roughness: THREE.Texture;
};

const TEXTURES = '/assets/universe/solar-system/textures/';
const STATIONS = '/assets/universe/solar-system/stations/';
const NEUTRAL_TEXTURE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl1qP4AAAAASUVORK5CYII=';

const NAVIGATION_STATIONS: Record<string, { variant: StationVariant; modelUrl: string }> = {
  blog: { variant: 'hub', modelUrl: `${STATIONS}space-station/station.fbx` },
  // 这一套有 210 万面，只在用户选中“关于站”之后才请求和解析。
  about: { variant: 'spine', modelUrl: `${STATIONS}sci-fi-space-station/station.fbx` },
  friends: { variant: 'ring', modelUrl: `${STATIONS}space-station/station.fbx` },
};

const PLANETS: PlanetSpec[] = [
  { id: 'signals', radius: .22, orbit: 2.55, angle: 2.35, speed: .048, texture: '2k_mercury.jpg' },
  { id: 'home', radius: .44, orbit: 4.05, angle: -.7, speed: .032, texture: '2k_earth_daymap.jpg', clouds: '2k_earth_clouds.jpg' },
  { id: 'articles', radius: .29, orbit: 5.85, angle: .6, speed: .026, texture: '2k_mars.jpg' },
  { id: 'photos', radius: .37, orbit: 7.3, angle: -2.05, speed: .022, texture: '2k_venus_surface.jpg', clouds: '2k_venus_atmosphere.jpg' },
  { id: 'library', radius: .77, orbit: 9.2, angle: 2.8, speed: .016, texture: '2k_jupiter.jpg' },
  // 让最外层土星完整保留在首屏可点击区域，不用轨道线也能作为明确的远端锚点。
  { id: 'archive', radius: .61, orbit: 11.4, angle: .55, speed: .012, texture: '2k_saturn.jpg', ring: true },
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function ease(value: number): number {
  const x = clamp(value, 0, 1);
  return x * x * (3 - 2 * x);
}

/**
 * 太阳系阶段独立使用真实 Three.js 几何。行星纹理随着球体网格旋转，
 * 不再通过 2D 画布横向推移贴图，因此不会产生平面滑动的错觉。
 */
export class SolarSystemScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(38, 1, .1, 140);
  private readonly textureLoader = new THREE.TextureLoader();
  private readonly stationLoadingManager = new THREE.LoadingManager();
  private readonly fbxLoader = new FBXLoader(this.stationLoadingManager);
  private readonly stationModelCache = new Map<string, Promise<THREE.Group>>();
  private stationTexturePromise?: Promise<StationTextureSet>;
  private readonly system = new THREE.Group();
  private sun?: THREE.Mesh;
  private readonly orbitLines = new THREE.Group();
  private readonly nodes = new Map<string, PlanetNode>();
  private readonly friendNodes: FriendNode[] = [];
  private readonly navigationCraftNodes: NavigationCraftNode[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly starMaterials: THREE.PointsMaterial[] = [];
  private readonly orbitMaterials: THREE.LineBasicMaterial[] = [];
  private readonly spaceMaterial: THREE.ShaderMaterial;
  private readonly targets = new Map<string, SolarScreenTarget>();
  private target = 0;
  private progress = 0;
  private departureTarget = 0;
  private departure = 0;
  private focusId = '';
  private focusTarget = 0;
  private focus = 0;
  private startedAt = performance.now();
  private lastFrameAt = this.startedAt;
  private raf = 0;
  private destroyed = false;
  private readonly origin = new THREE.Vector3();
  private readonly baseCamera = new THREE.Vector3(0, 8.7, 25.5);
  private readonly focusWorld = new THREE.Vector3();
  private readonly focusCamera = new THREE.Vector3();
  private readonly lookTarget = new THREE.Vector3();
  private readonly projected = new THREE.Vector3();
  private readonly targetWorld = new THREE.Vector3();
  private readonly targetScale = new THREE.Vector3();
  private readonly orbitPosition = new THREE.Vector3();
  private readonly craftPoint = new THREE.Vector3();
  private readonly resizeHandler = (): void => this.resize();

  constructor(canvas: HTMLCanvasElement) {
    // 原始 FBX 引用了作者电脑上的绝对贴图路径。先把这些请求导向 1px 中性图，
    // 加载完成后再换成项目内的压缩 PBR 贴图，避免几十个 404 和百 MB 纹理流量。
    this.stationLoadingManager.setURLModifier((url) => (
      /\.(?:png|jpe?g|webp|tga|bmp)(?:[?#].*)?$/i.test(url) ? NEUTRAL_TEXTURE : url
    ));
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.camera.position.set(0, 8.7, 25.5);
    this.scene.add(new THREE.AmbientLight(0x8db7df, 1.15));
    const key = new THREE.PointLight(0xffdf9c, 180, 36, 1.6);
    key.position.set(0, 0, 0);
    this.scene.add(key);
    // 太阳系主景保留高密度银河底图；下载的天空盒素材会留给后续登陆星球场景。
    this.spaceMaterial = this.makeProceduralSpaceMaterial();
    this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(82, 32, 20), this.spaceMaterial));
    this.scene.add(this.makeProceduralStarField());
    this.scene.add(this.system);
    this.system.add(this.orbitLines);
    this.buildSystem();
    this.resize();
    window.addEventListener('resize', this.resizeHandler);
    this.render();
  }

  setProgress(value: number): void {
    this.target = clamp(value, 0, 1);
  }

  setFocus(id: string | null): void {
    if (id) {
      this.focusId = id;
      this.focusTarget = 1;
      return;
    }
    // 返航时保留最后一个焦点。镜头位置与朝向会沿同一条曲线回到全景，
    // 等返航结束后再清空 id，避免观察点先跳回太阳导致一帧式折返。
    this.focusTarget = 0;
  }

  setDeparture(value: number): void {
    this.departureTarget = clamp(value, 0, 1);
  }

  setFriends(friends: Friend[]): void {
    if (this.friendNodes.length || !friends.length) return;
    const earth = this.nodes.get('home');
    if (!earth) return;
    friends.forEach((friend, index) => {
      const orbit = new THREE.Group();
      orbit.add(this.makeFriendSatellite(index));
      earth.anchor.add(orbit);
      this.friendNodes.push({
        friend,
        anchor: orbit,
        orbitRadius: .98 + index * .13,
        orbitSpeed: .31 + index * .041,
        orbitPhase: index * 2.1,
        orbitPlane: new THREE.Quaternion().setFromEuler(new THREE.Euler(
          .34 + (index % 3) * .23,
          index * 1.17,
          -.28 + (index % 2) * .22,
        )),
      });
    });
  }

  /** 博客、关于、友联入口各自使用一座绕行星巡航的太空站。 */
  setNavigationCraft(navStars: NavStar[]): void {
    if (this.navigationCraftNodes.length) return;
    const entries = navStars.filter((nav) => nav.enabled !== false && ['blog', 'about', 'friends'].includes(nav.id));
    entries.forEach((nav, index) => {
      const station = NAVIGATION_STATIONS[nav.id];
      if (!station) return;
      const hostId = ['articles', 'library', 'photos'][index % 3];
      const host = this.nodes.get(hostId);
      if (!host) return;
      const anchor = new THREE.Group();
      const visual = this.makeNavigationStationFallback(index, station.variant);
      anchor.add(visual);
      host.anchor.add(anchor);
      const node: NavigationCraftNode = {
        nav,
        anchor,
        visual,
        variant: station.variant,
        modelUrl: station.modelUrl,
        modelRequested: false,
        hostId,
        orbitRadius: host.spec.radius * 2.7 + .52 + index * .08,
        orbitPlane: new THREE.Quaternion().setFromEuler(new THREE.Euler(.42 + index * .19, index * .76, -.18 + index * .14)),
        speed: .105 + index * .018,
        phase: index * 2.05 + .4,
      };
      this.navigationCraftNodes.push(node);
    });
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resizeHandler);
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Sprite)) return;
      if ('geometry' in object && object.geometry instanceof THREE.BufferGeometry) geometries.add(object.geometry);
      const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
      objectMaterials.forEach((material) => {
        if (!(material instanceof THREE.Material)) return;
        materials.add(material);
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
      });
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    textures.forEach((texture) => texture.dispose());
    this.renderer.dispose();
    this.targets.clear();
  }

  getTargets(): ReadonlyMap<string, SolarScreenTarget> {
    return this.targets;
  }

  private makeFriendSatellite(index: number): THREE.Group {
    const satellite = new THREE.Group();
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: index % 2 ? 0xd8eef8 : 0xf0f8ff,
      emissive: 0x123d59,
      emissiveIntensity: 1.15,
      roughness: .38,
      metalness: .58,
    });
    const panelMaterial = new THREE.MeshStandardMaterial({
      color: index % 2 ? 0x2f80aa : 0x3b91b8,
      emissive: 0x0b3350,
      emissiveIntensity: .72,
      roughness: .5,
      metalness: .28,
    });
    const antennaMaterial = new THREE.MeshStandardMaterial({
      color: 0xd8e7ec,
      emissive: 0x204a5f,
      emissiveIntensity: .45,
      roughness: .32,
      metalness: .72,
      side: THREE.DoubleSide,
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(.11, .075, .08), bodyMaterial);
    const panelGeometry = new THREE.BoxGeometry(.19, .008, .068);
    const leftPanel = new THREE.Mesh(panelGeometry, panelMaterial);
    const rightPanel = new THREE.Mesh(panelGeometry, panelMaterial);
    leftPanel.position.x = -.17;
    rightPanel.position.x = .17;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, .095, 8), antennaMaterial);
    mast.rotation.x = Math.PI * .5;
    mast.position.z = .085;
    const dish = new THREE.Mesh(new THREE.ConeGeometry(.052, .024, 16, 1, true), antennaMaterial);
    dish.rotation.x = Math.PI * .5;
    dish.position.z = .135;
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(.012, 10, 8),
      new THREE.MeshBasicMaterial({ color: index % 2 ? 0xffd99a : 0x87e7ff }),
    );
    beacon.position.set(0, .05, -.035);
    satellite.add(body, leftPanel, rightPanel, mast, dish, beacon);
    this.materials.push(bodyMaterial, panelMaterial, antennaMaterial, beacon.material);
    return satellite;
  }

  private makeNavigationStationFallback(index: number, variant: StationVariant): THREE.Group {
    const station = new THREE.Group();
    const hullMaterial = new THREE.MeshStandardMaterial({
      color: index === 1 ? 0xb8cbd4 : 0xdce7eb,
      emissive: index === 2 ? 0x18344a : 0x153342,
      emissiveIntensity: .72,
      roughness: .31,
      metalness: .78,
    });
    const darkMaterial = new THREE.MeshStandardMaterial({
      color: index === 1 ? 0x435762 : 0x315260,
      emissive: index === 1 ? 0x112e3c : 0x0a3345,
      emissiveIntensity: .88,
      roughness: .38,
      metalness: .68,
    });
    const lightMaterial = new THREE.MeshBasicMaterial({
      color: index === 1 ? 0xffca7a : 0x82e5ff,
      transparent: true,
      opacity: .88,
    });
    const core = new THREE.Mesh(new THREE.SphereGeometry(.13, 16, 12), hullMaterial);
    const axialHub = new THREE.Mesh(new THREE.CylinderGeometry(.105, .105, .34, 16), darkMaterial);
    axialHub.rotation.x = Math.PI * .5;
    const dockingGeometry = new THREE.TorusGeometry(.125, .018, 8, 28);
    const dockingRingA = new THREE.Mesh(dockingGeometry, lightMaterial);
    const dockingRingB = new THREE.Mesh(dockingGeometry, lightMaterial);
    dockingRingA.position.z = .18;
    dockingRingB.position.z = -.18;
    station.add(core, axialHub, dockingRingA, dockingRingB);

    const podGeometry = new THREE.CylinderGeometry(.065, .065, .2, 12);
    const windowGeometry = new THREE.CylinderGeometry(.067, .067, .035, 12);
    const makePod = (x: number, y: number, z: number, scale = 1): THREE.Group => {
      const pod = new THREE.Group();
      const shell = new THREE.Mesh(podGeometry, hullMaterial);
      const windowBand = new THREE.Mesh(windowGeometry, lightMaterial);
      shell.rotation.z = Math.PI * .5;
      windowBand.rotation.z = Math.PI * .5;
      pod.add(shell, windowBand);
      pod.position.set(x, y, z);
      pod.scale.setScalar(scale);
      return pod;
    };

    if (variant === 'hub') {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.31, .025, 10, 48), darkMaterial);
      const crossX = new THREE.Mesh(new THREE.BoxGeometry(.72, .028, .035), hullMaterial);
      const crossY = new THREE.Mesh(new THREE.BoxGeometry(.028, .56, .035), hullMaterial);
      station.add(ring, crossX, crossY);
      station.add(makePod(-.39, 0, 0), makePod(.39, 0, 0), makePod(0, -.3, 0, .9), makePod(0, .3, 0, .9));
    } else if (variant === 'spine') {
      const spine = new THREE.Mesh(new THREE.CylinderGeometry(.035, .05, .78, 12), hullMaterial);
      const upperRing = new THREE.Mesh(new THREE.TorusGeometry(.24, .02, 9, 42), darkMaterial);
      const lowerRing = upperRing.clone();
      upperRing.rotation.x = Math.PI * .5;
      lowerRing.rotation.x = Math.PI * .5;
      upperRing.position.y = .23;
      lowerRing.position.y = -.23;
      station.add(spine, upperRing, lowerRing);
      station.add(makePod(-.27, .23, 0, .88), makePod(.27, .23, 0, .88), makePod(-.27, -.23, 0, .88), makePod(.27, -.23, 0, .88));
    } else {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.36, .035, 12, 56), hullMaterial);
      const innerRing = new THREE.Mesh(new THREE.TorusGeometry(.27, .012, 8, 48), lightMaterial);
      const braceX = new THREE.Mesh(new THREE.BoxGeometry(.68, .026, .03), darkMaterial);
      const braceY = new THREE.Mesh(new THREE.BoxGeometry(.026, .68, .03), darkMaterial);
      ring.rotation.x = .18;
      innerRing.rotation.x = .18;
      station.add(ring, innerRing, braceX, braceY);
      station.add(makePod(-.4, 0, 0, .92), makePod(.4, 0, 0, .92), makePod(0, -.4, 0, .92), makePod(0, .4, 0, .92));
    }
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(.035, 12, 8), lightMaterial);
    beacon.position.z = .24;
    station.add(beacon);
    station.scale.setScalar(1.08);
    this.materials.push(hullMaterial, darkMaterial, lightMaterial);
    return station;
  }

  private scheduleStationModels(arrival: number, selected?: NavigationCraftNode): void {
    // 太阳系全景用辨识度更高、开销更小的轮廓站。作者原模型只在选中后加载，
    // 避免 2M+ 面模型在远景中缩成一条亮线，也避免首屏解析造成点击卡顿。
    if (arrival < .58 || this.destroyed || !selected || selected.modelRequested) return;
    selected.modelRequested = true;
    setTimeout(() => {
      if (this.destroyed) return;
      void this.loadNavigationStationModel(selected);
    }, 180);
  }

  private loadStationSource(url: string): Promise<THREE.Group> {
    const cached = this.stationModelCache.get(url);
    if (cached) return cached;
    const pending = this.fbxLoader.loadAsync(url).then((model) => model as THREE.Group);
    this.stationModelCache.set(url, pending);
    return pending;
  }

  private async getStationTextures(): Promise<StationTextureSet> {
    if (this.stationTexturePromise) return this.stationTexturePromise;
    const root = `${STATIONS}space-station/`;
    this.stationTexturePromise = Promise.all([
      this.textureLoader.loadAsync(`${root}diffuse.webp`),
      this.textureLoader.loadAsync(`${root}emission.webp`),
      this.textureLoader.loadAsync(`${root}metalness.webp`),
      this.textureLoader.loadAsync(`${root}roughness.webp`),
    ]).then(([diffuse, emission, metalness, roughness]) => {
      diffuse.colorSpace = THREE.SRGBColorSpace;
      emission.colorSpace = THREE.SRGBColorSpace;
      metalness.colorSpace = THREE.NoColorSpace;
      roughness.colorSpace = THREE.NoColorSpace;
      const anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
      [diffuse, emission, metalness, roughness].forEach((texture) => {
        texture.anisotropy = anisotropy;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
      });
      return { diffuse, emission, metalness, roughness };
    });
    return this.stationTexturePromise;
  }

  private async applyStationMaterials(model: THREE.Group, variant: StationVariant): Promise<void> {
    const baked = variant === 'spine' ? null : await this.getStationTextures();
    let meshIndex = 0;
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.frustumCulled = true;
      const sources = Array.isArray(object.material) ? object.material : [object.material];
      const replacements = sources.map((_source, materialIndex) => {
        const paletteIndex = (meshIndex * 7 + materialIndex * 3) % 11;
        const material = baked
          ? new THREE.MeshStandardMaterial({
              map: baked.diffuse,
              emissiveMap: baked.emission,
              metalnessMap: baked.metalness,
              roughnessMap: baked.roughness,
              color: variant === 'ring' ? 0x9fc5d1 : 0xffffff,
              emissive: variant === 'ring' ? 0x123e54 : 0x283541,
              emissiveIntensity: variant === 'ring' ? 1.35 : .82,
              metalness: .78,
              roughness: .42,
            })
          : new THREE.MeshStandardMaterial({
              color: paletteIndex < 2 ? 0x89b7c7 : paletteIndex < 6 ? 0x52616c : 0xaab4bb,
              emissive: paletteIndex < 2 ? 0x16536a : 0x0b1c27,
              emissiveIntensity: paletteIndex < 2 ? 1.25 : .42,
              metalness: .82,
              roughness: paletteIndex < 2 ? .26 : .44,
            });
        this.materials.push(material);
        return material;
      });
      object.material = Array.isArray(object.material) ? replacements : replacements[0];
      meshIndex += 1;
    });
  }

  private async loadNavigationStationModel(node: NavigationCraftNode): Promise<void> {
    try {
      const source = await this.loadStationSource(node.modelUrl);
      if (this.destroyed) return;
      const model = source.clone(true) as THREE.Group;
      await this.applyStationMaterials(model, node.variant);
      if (this.destroyed) return;
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const maxDimension = Math.max(size.x, size.y, size.z, .001);
      model.position.sub(center);
      model.scale.setScalar((node.variant === 'spine' ? .76 : .84) / maxDimension);
      // FBXLoader 已完成坐标系转换。额外旋转 90° 会把空间站宽面转成侧面，
      // 远景只剩一条亮线；这里保持作者正面，仅用少量 roll 区分三个入口。
      model.rotation.set(0, 0, node.variant === 'hub' ? -.18 : node.variant === 'ring' ? .42 : .12);
      const assembled = new THREE.Group();
      assembled.add(model);
      if (node.variant === 'ring') {
        const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x78dff2, transparent: true, opacity: .72, blending: THREE.AdditiveBlending, depthWrite: false });
        const outer = new THREE.Mesh(new THREE.TorusGeometry(.48, .012, 8, 64), ringMaterial);
        const inner = new THREE.Mesh(new THREE.TorusGeometry(.39, .008, 8, 56), ringMaterial.clone());
        outer.rotation.z = -.12;
        inner.rotation.set(.12, .18, .24);
        assembled.add(outer, inner);
        this.materials.push(ringMaterial, inner.material);
      } else if (node.variant === 'spine') {
        const spineMaterial = new THREE.MeshStandardMaterial({
          color: 0x9db4bf,
          emissive: 0x164a60,
          emissiveIntensity: 1.05,
          metalness: .84,
          roughness: .3,
        });
        const lightMaterial = new THREE.MeshBasicMaterial({ color: 0x8ce8ff, transparent: true, opacity: .68, blending: THREE.AdditiveBlending, depthWrite: false });
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(.018, .026, .92, 12), spineMaterial);
        const halo = new THREE.Mesh(new THREE.TorusGeometry(.33, .012, 8, 56), lightMaterial);
        const crown = new THREE.Mesh(new THREE.ConeGeometry(.11, .1, 20, 1, true), spineMaterial);
        halo.rotation.y = Math.PI * .5;
        crown.position.y = .49;
        assembled.add(mast, halo, crown);
        this.materials.push(spineMaterial, lightMaterial);
      }
      node.visual.clear();
      node.visual.add(assembled);
    } catch {
      // 程序化太空站会继续巡航，资源失败不影响入口点击和聚焦。
    }
  }

  private resize(): void {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private loadTexture(name: string): THREE.Texture {
    const texture = this.textureLoader.load(`${TEXTURES}${name}`);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  /**
   * 太阳系不再把全景照片贴到天空球上。星点在 GPU 中逐颗绘制，既没有拉伸，
   * 也不会因 2D 贴图缩放而变糊；两层不同密度的恒星构成可辨认的银河尘带。
   */
  private makeProceduralStarField(): THREE.Group {
    const group = new THREE.Group();
    const sprite = this.makeStarSprite();
    const createLayer = (count: number, radius: number, size: number, band: boolean): void => {
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      const cool = new THREE.Color(0xa8d9ff);
      const white = new THREE.Color(0xf5fbff);
      const warm = new THREE.Color(0xffd19a);
      for (let index = 0; index < count; index += 1) {
        const azimuth = Math.random() * Math.PI * 2;
        const vertical = band
          ? (Math.random() - .5) * .38 + Math.sin(azimuth * 2.3) * .08
          : Math.asin(Math.random() * 2 - 1);
        const r = radius + (Math.random() - .5) * 3.4;
        const x = Math.cos(vertical) * Math.cos(azimuth) * r;
        const y = Math.sin(vertical) * r;
        const z = Math.cos(vertical) * Math.sin(azimuth) * r;
        positions[index * 3] = x;
        positions[index * 3 + 1] = y;
        positions[index * 3 + 2] = z;
        const roll = Math.random();
        const color = roll > .965 ? warm : roll > .68 ? white : cool;
        colors[index * 3] = color.r;
        colors[index * 3 + 1] = color.g;
        colors[index * 3 + 2] = color.b;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const material = new THREE.PointsMaterial({
        map: sprite,
        size,
        transparent: true,
        opacity: 0,
        vertexColors: true,
        depthWrite: false,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending,
      });
      this.starMaterials.push(material);
      group.add(new THREE.Points(geometry, material));
    };
    // 大量微星提供深度，尘带保持低亮度，亮星只作为空间锚点而非装饰性光斑。
    createLayer(18000, 57, .086, false);
    createLayer(11500, 55, .105, true);
    createLayer(260, 48, .29, false);
    return group;
  }

  private makeProceduralSpaceMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: { opacity: { value: 0 } },
      vertexShader: `
        varying vec3 vDirection;
        void main() {
          vDirection = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float opacity;
        varying vec3 vDirection;
        const float PI = 3.14159265359;
        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 345.45));
          p += dot(p, p + 34.345);
          return fract(p.x * p.y);
        }
        float starLayer(vec2 uv, float scale, float threshold, float radius) {
          vec2 p = uv * vec2(scale * 1.88, scale);
          vec2 id = floor(p);
          vec2 cell = fract(p) - .5;
          float seed = hash21(id);
          if (seed < threshold) return 0.0;
          vec2 offset = vec2(hash21(id + 17.1), hash21(id + 49.7)) * .62 - .31;
          float d = length(cell - offset);
          float core = smoothstep(radius, 0.0, d);
          float flare = smoothstep(radius * 3.6, 0.0, d) * .13;
          return (core + flare) * mix(.44, 1.0, seed);
        }
        void main() {
          vec3 direction = normalize(vDirection);
          vec2 uv = vec2(atan(direction.z, direction.x) / (2.0 * PI) + .5, asin(direction.y) / PI + .5);
          float lane = exp(-pow((uv.y - .53) + sin(uv.x * 8.0) * .045, 2.0) * 185.0);
          vec3 color = vec3(.0012, .0036, .0085) + vec3(.004, .018, .042) * lane;
          float star = 0.0;
          star += starLayer(uv, 125.0, .88, .042);
          star += starLayer(uv + .193, 265.0, .935, .031);
          star += starLayer(uv + .497, 540.0, .973, .024);
          vec3 starColor = mix(vec3(.50, .72, 1.0), vec3(1.0, .86, .61), hash21(floor(uv * 125.0) + 8.4));
          color += starColor * star;
          gl_FragColor = vec4(color, opacity);
        }
      `,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
  }

  private makeStarSprite(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 32;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to create star sprite');
    const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(.16, 'rgba(232,246,255,.98)');
    gradient.addColorStop(.46, 'rgba(170,219,255,.34)');
    gradient.addColorStop(1, 'rgba(125,194,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(canvas);
  }

  private buildSystem(): void {
    const sunTexture = this.loadTexture('2k_sun.jpg');
    const sunMaterial = new THREE.MeshBasicMaterial({ map: sunTexture, color: 0xffe2a3 });
    const sun = new THREE.Mesh(new THREE.SphereGeometry(.94, 48, 32), sunMaterial);
    this.sun = sun;
    this.system.add(sun);
    this.materials.push(sunMaterial);
    const corona = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffa54b, transparent: true, opacity: .54, map: this.makeGlowTexture(), depthWrite: false, blending: THREE.AdditiveBlending }));
    corona.scale.setScalar(4.1);
    sun.add(corona);

    for (const spec of PLANETS) {
      const spread = spec.orbit * 1.12;
      const points = Array.from({ length: 160 }, (_, index) => {
        const angle = (index / 160) * Math.PI * 2;
        return new THREE.Vector3(
          Math.cos(angle) * spread,
          Math.sin(angle) * spread * .055,
          Math.sin(angle) * spread * .7,
        );
      });
      const material = new THREE.LineBasicMaterial({
        color: 0x82b7d0,
        transparent: true,
        opacity: .055,
        depthWrite: false,
      });
      this.orbitLines.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), material));
      this.orbitMaterials.push(material);
    }

    for (const spec of PLANETS) {
      const anchor = new THREE.Group();
      const globeMaterial: THREE.Material = spec.id === 'home'
        ? this.makeEarthMaterial()
        : new THREE.MeshStandardMaterial({ map: this.loadTexture(spec.texture), roughness: .88, metalness: 0 });
      const globe = new THREE.Mesh(new THREE.SphereGeometry(spec.radius, 48, 32), globeMaterial);
      anchor.add(globe);
      this.materials.push(globeMaterial);
      let clouds: PlanetNode['clouds'];
      if (spec.clouds) {
        // 云图本身是黑白遮罩：黑色必须作为透明区域处理，不能覆盖成一层灰雾。
        const cloudMap = this.loadTexture(spec.clouds);
        const cloudMaterial = new THREE.MeshBasicMaterial({
          map: cloudMap,
          alphaMap: cloudMap,
          color: spec.id === 'home' ? 0xcceeff : 0xf0d7b2,
          transparent: true,
          opacity: spec.id === 'home' ? .42 : .19,
          depthWrite: false,
          blending: THREE.NormalBlending,
        });
        clouds = new THREE.Mesh(new THREE.SphereGeometry(spec.radius * 1.015, 48, 32), cloudMaterial);
        anchor.add(clouds);
        this.materials.push(cloudMaterial);
      }
      if (spec.ring) {
        const ringTexture = this.loadTexture('2k_saturn_ring_alpha.png');
        const ringMaterial = new THREE.MeshBasicMaterial({ map: ringTexture, alphaMap: ringTexture, transparent: true, opacity: .96, side: THREE.DoubleSide, depthWrite: false, color: 0xffe2ae });
        const ring = new THREE.Mesh(new THREE.RingGeometry(spec.radius * 1.3, spec.radius * 2.48, 128, 1), ringMaterial);
        ring.rotation.x = Math.PI * .5;
        ring.rotation.z = -.14;
        anchor.add(ring);
        this.materials.push(ringMaterial);
        const ringBandMaterial = new THREE.MeshBasicMaterial({ color: 0xe6c98f, transparent: true, opacity: .28, side: THREE.DoubleSide, depthWrite: false });
        const ringBand = new THREE.Mesh(new THREE.RingGeometry(spec.radius * 1.38, spec.radius * 2.32, 128, 1), ringBandMaterial);
        ringBand.rotation.copy(ring.rotation);
        anchor.add(ringBand);
        this.materials.push(ringBandMaterial);
      }
      let moonOrbit: PlanetNode['moonOrbit'];
      let moon: PlanetNode['moon'];
      if (spec.id === 'home') {
        moonOrbit = new THREE.Group();
        const moonMaterial = new THREE.MeshStandardMaterial({ map: this.loadTexture('2k_moon.jpg'), roughness: 1, metalness: 0 });
        moon = new THREE.Mesh(new THREE.SphereGeometry(.115, 32, 24), moonMaterial);
        // 与地球保持明显的安全距离，并让轨道倾斜，避免投影上像是穿过地球。
        moon.position.set(spec.radius * 3.45, .08, 0);
        moonOrbit.add(moon);
        moonOrbit.rotation.set(.52, 0, -.32);
        anchor.add(moonOrbit);
        this.materials.push(moonMaterial);
      }
      this.system.add(anchor);
      this.nodes.set(spec.id, { spec, anchor, globe, clouds, moonOrbit, moon });
    }
  }

  private makeEarthMaterial(): THREE.ShaderMaterial {
    const dayMap = this.loadTexture('2k_earth_daymap.jpg');
    const nightMap = this.loadTexture('2k_earth_nightmap.jpg');
    return new THREE.ShaderMaterial({
      uniforms: { dayMap: { value: dayMap }, nightMap: { value: nightMap } },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldPosition;
        varying vec3 vWorldNormal;
        void main() {
          vUv = uv;
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D dayMap;
        uniform sampler2D nightMap;
        varying vec2 vUv;
        varying vec3 vWorldPosition;
        varying vec3 vWorldNormal;
        void main() {
          vec3 lightDirection = normalize(-vWorldPosition);
          float illumination = max(dot(normalize(vWorldNormal), lightDirection), 0.0);
          float dayAmount = smoothstep(0.02, 0.34, illumination);
          vec3 day = texture2D(dayMap, vUv).rgb * (0.42 + illumination * 0.94);
          vec3 night = texture2D(nightMap, vUv).rgb * vec3(0.58, 0.83, 1.42) * 2.05;
          vec3 color = mix(night, day, dayAmount);
          float rim = pow(1.0 - max(dot(normalize(vWorldNormal), normalize(cameraPosition - vWorldPosition)), 0.0), 3.0);
          color += vec3(0.035, 0.13, 0.24) * rim;
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
  }

  private makeGlowTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to create solar glow');
    const glow = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    glow.addColorStop(0, 'rgba(255,248,205,.92)');
    glow.addColorStop(.22, 'rgba(255,192,74,.48)');
    glow.addColorStop(.58, 'rgba(255,116,39,.14)');
    glow.addColorStop(1, 'rgba(255,81,29,0)');
    context.fillStyle = glow;
    context.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(canvas);
  }

  private render = (): void => {
    if (this.destroyed) return;
    const now = performance.now();
    const deltaTime = clamp((now - this.lastFrameAt) * .001, 1 / 240, .05);
    this.lastFrameAt = now;
    const sceneDamping = 1 - Math.exp(-4.8 * deltaTime);
    const focusDamping = 1 - Math.exp(-4.15 * deltaTime);
    this.progress += (this.target - this.progress) * sceneDamping;
    this.departure += (this.departureTarget - this.departure) * sceneDamping;
    this.focus += (this.focusTarget - this.focus) * focusDamping;
    if (this.focusTarget === 0 && this.focus < .003) {
      this.focus = 0;
      this.focusId = '';
    }
    const elapsed = (now - this.startedAt) * .001;
    const arrival = ease((this.progress - .75) / .21);
    const departureEase = ease(this.departure);
    // 离开阶段把整个太阳系真正压回遥远光点，再彻底隐藏；不能维持七成尺寸后瞬间消失。
    const systemScale = (.028 + arrival * .972) * THREE.MathUtils.lerp(1, .028, departureEase);
    this.system.scale.setScalar(systemScale);
    this.system.visible = arrival > .006 && departureEase < .995;
    const starOpacity = ease((this.progress - .72) / .14);
    this.spaceMaterial.uniforms.opacity.value = starOpacity * (1 - departureEase);
    this.starMaterials.forEach((material, index) => {
      material.opacity = starOpacity * (1 - departureEase) * (index === 0 ? .92 : index === 1 ? .72 : 1);
    });
    const focusEase = ease(this.focus);
    if (this.sun) {
      // 聚焦行星、月球、友链卫星或太空站时隔离观察目标；太阳不应在近景里
      // 与目标穿插。返航沿相同缓动恢复，避免突然闪现。
      const sunScale = Math.max(.001, 1 - focusEase);
      this.sun.scale.setScalar(sunScale);
      this.sun.visible = sunScale > .01;
    }
    this.orbitLines.visible = focusEase < .985;
    this.orbitMaterials.forEach((material) => {
      material.opacity = .055 * arrival * (1 - departureEase) * (1 - focusEase);
    });
    const isMoonView = this.focusId === 'moon';
    const selectedCraft = this.navigationCraftNodes.find((craft) => `craft-${craft.nav.id}` === this.focusId);
    this.scheduleStationModels(arrival, selectedCraft);
    const focusPlanet = selectedCraft?.hostId || (isMoonView ? 'home' : this.focusId);
    for (const node of this.nodes.values()) {
      const spec = node.spec;
      const a = spec.angle + elapsed * spec.speed;
      const spread = spec.orbit * 1.12;
      node.anchor.position.set(
        Math.cos(a) * spread,
        Math.sin(a) * spread * .055,
        Math.sin(a) * spread * .7,
      );
      node.globe.rotation.y = elapsed * (.34 + spec.speed * .58);
      if (node.clouds) node.clouds.rotation.y = elapsed * (.56 + spec.speed * .7);
      if (node.moonOrbit) node.moonOrbit.rotation.set(.52, elapsed * .16, -.32);
      const isFocused = spec.id === focusPlanet;
      const scale = isFocused ? 1 + focusEase * .1 : Math.max(.001, 1 - focusEase * .995);
      node.anchor.scale.setScalar(scale);
      node.anchor.visible = !this.focusId || isFocused || focusEase < .985;
      if (spec.id === 'home') {
        const earthBodyScale = isMoonView ? Math.max(.001, 1 - focusEase) : 1;
        node.globe.scale.setScalar(earthBodyScale);
        node.globe.visible = earthBodyScale > .01;
        if (node.clouds) {
          node.clouds.scale.setScalar(earthBodyScale);
          node.clouds.visible = earthBodyScale > .01;
        }
        if (node.moonOrbit && node.moon) {
          const moonScale = isMoonView
            ? 1
            : this.focusId
            ? Math.max(.001, 1 - focusEase)
            : 1;
          node.moon.scale.setScalar(moonScale);
          node.moonOrbit.visible = moonScale > .01;
        }
      }
    }
    for (let index = 0; index < this.friendNodes.length; index += 1) {
      const friendNode = this.friendNodes[index];
      const phase = elapsed * friendNode.orbitSpeed + friendNode.orbitPhase;
      this.orbitPosition.set(
        Math.cos(phase) * friendNode.orbitRadius,
        0,
        Math.sin(phase) * friendNode.orbitRadius,
      ).applyQuaternion(friendNode.orbitPlane);
      friendNode.anchor.position.copy(this.orbitPosition);
      friendNode.anchor.rotation.set(.42 + Math.sin(phase) * .12, -phase, -.34);
      const friendScale = .5 * (!this.focusId || this.focusId === 'home' ? 1 : Math.max(.001, 1 - focusEase));
      friendNode.anchor.scale.setScalar(friendScale);
      friendNode.anchor.visible = friendScale > .01;
    }

    for (const craft of this.navigationCraftNodes) {
      const phase = craft.phase + elapsed * craft.speed;
      this.craftPoint.set(Math.cos(phase) * craft.orbitRadius, 0, Math.sin(phase) * craft.orbitRadius).applyQuaternion(craft.orbitPlane);
      craft.anchor.position.copy(this.craftPoint);
      // 太空站保持宽阔轮廓朝向镜头，只做缓慢姿态漂移；沿切线完全转向会让环站
      // 在大部分轨道位置只剩一条细线，既难看也难以点击。
      craft.anchor.rotation.set(
        .12 + Math.sin(elapsed * .11 + craft.phase) * .08,
        Math.sin(elapsed * .09 + craft.phase * 1.7) * .18,
        phase * .12 + Math.sin(elapsed * .17 + craft.phase * 11) * .06,
      );
      const isSelectedCraft = selectedCraft === craft;
      const craftScale = !this.focusId
        ? 1
        : isSelectedCraft
        ? 1 + focusEase * .72
        : Math.max(.001, 1 - focusEase);
      craft.anchor.scale.setScalar(craftScale);
      craft.anchor.visible = craftScale > .01;
    }

    const focusNode = this.nodes.get(selectedCraft?.hostId || (this.focusId === 'moon' ? 'home' : this.focusId));
    this.focusWorld.set(0, 0, 0);
    if (selectedCraft) selectedCraft.anchor.getWorldPosition(this.focusWorld);
    else if (this.focusId === 'moon' && focusNode?.moon) focusNode.moon.getWorldPosition(this.focusWorld);
    else focusNode?.anchor.getWorldPosition(this.focusWorld);
    const focusRadius = selectedCraft ? .48 : this.focusId === 'moon' ? .115 : focusNode?.spec.radius ?? .44;
    const focusDistance = selectedCraft
      ? 3.05
      : this.focusId === 'moon'
      ? 1.75
      : this.focusId === 'home'
      ? 5.35
      : focusNode?.spec.ring
      ? 5.25
      : Math.max(3.1, focusRadius * 6.2);
    this.focusCamera.copy(this.focusWorld);
    this.focusCamera.y += this.focusId === 'moon' ? .12 : Math.max(.55, focusRadius * 1.15);
    this.focusCamera.z += focusDistance;
    this.camera.position.lerpVectors(this.baseCamera, this.focusCamera, focusEase);
    this.lookTarget.lerpVectors(this.origin, this.focusWorld, focusEase);
    this.camera.lookAt(this.lookTarget);
    this.camera.updateMatrixWorld();
    this.updateTargets();
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.render);
  };

  private updateTargets(): void {
    const width = Math.max(1, this.renderer.domElement.clientWidth);
    const height = Math.max(1, this.renderer.domElement.clientHeight);
    this.targets.clear();
    if (!this.system.visible) return;
    for (const node of this.nodes.values()) {
      if (!node.anchor.visible) continue;
      // 月球先写入 Map，让它在与地球命中范围接近时拥有更高优先级。
      if (node.moonOrbit?.visible && node.moon?.visible) {
        this.setProjectedTarget('moon', node.moon, .115, 14, width, height);
      }
      if (node.globe.visible) {
        this.setProjectedTarget(node.spec.id, node.globe, node.spec.radius, 8, width, height);
      }
    }
    for (let index = 0; index < this.friendNodes.length; index += 1) {
      const friendNode = this.friendNodes[index];
      if (!friendNode.anchor.visible) continue;
      this.setProjectedTarget(`friend-${index}`, friendNode.anchor, .11, 15, width, height, { friendIndex: index });
    }
    for (let index = 0; index < this.navigationCraftNodes.length; index += 1) {
      const craft = this.navigationCraftNodes[index];
      if (!craft.anchor.visible) continue;
      // 远景站会持续绕行，命中区略大于发光轮廓，避免必须点中一条细舱壁。
      this.setProjectedTarget(`craft-${craft.nav.id}`, craft.anchor, .54, 28, width, height, { craftIndex: index });
    }
  }

  private setProjectedTarget(
    id: string,
    object: THREE.Object3D,
    radius: number,
    minimumRadius: number,
    width: number,
    height: number,
    extra: Pick<SolarScreenTarget, 'friendIndex' | 'craftIndex'> = {},
  ): void {
    object.getWorldPosition(this.targetWorld);
    object.getWorldScale(this.targetScale);
    const distance = this.camera.position.distanceTo(this.targetWorld);
    this.projected.copy(this.targetWorld).project(this.camera);
    if (this.projected.z < -1 || this.projected.z > 1) return;
    const scale = Math.max(this.targetScale.x, this.targetScale.y, this.targetScale.z);
    const projectedRadius = Math.max(minimumRadius, (radius * scale * height) / Math.max(.1, distance * 1.28));
    this.targets.set(id, {
      id,
      x: (this.projected.x * .5 + .5) * width,
      y: (-this.projected.y * .5 + .5) * height,
      r: projectedRadius,
      ...extra,
    });
  }
}
