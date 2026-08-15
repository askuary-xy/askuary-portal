import * as THREE from 'three';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function ease(value: number): number {
  const x = clamp(value, 0, 1);
  return x * x * (3 - 2 * x);
}

/**
 * CC BY 4.0 point cloud by Loïc Norgeot, loaded as a separate WebGL layer.
 * The interaction canvas deliberately stays above this layer so labels and planet links remain crisp.
 */
export class GalaxyPointCloud {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  private readonly group = new THREE.Group();
  private readonly solarSystemStar: THREE.Sprite;
  private readonly initialCamera = new THREE.Vector3(0, 0.35, 12.8);
  private readonly abortController = new AbortController();
  private points: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial> | null = null;
  private stellarVeil: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial> | null = null;
  private readonly nebulaMaterials: Array<{ material: THREE.SpriteMaterial; baseOpacity: number }> = [];
  private target = 0;
  private progress = 0;
  private startedAt = performance.now();
  private animationFrameId: number | null = null;
  private destroyed = false;

  private readonly handleResize = (): void => {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.scene.add(this.group);
    this.camera.position.copy(this.initialCamera);

    const starTexture = this.makeStarTexture();
    this.solarSystemStar = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTexture, color: 0xffe4b0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    // 这颗恒星是唯一的跃迁目标。镜头始终向它推进，而不是让整片银河淡出。
    this.solarSystemStar.position.set(0.5, -0.72, 0.14);
    this.solarSystemStar.scale.setScalar(0.078);
    this.group.add(this.solarSystemStar);

    this.handleResize();
    window.addEventListener('resize', this.handleResize);
    void this.load();
    this.render();
  }

  setProgress(progress: number): void {
    this.target = clamp(progress, 0, 1);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.abortController.abort();
    if (this.animationFrameId !== null) cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = null;
    window.removeEventListener('resize', this.handleResize);
    document.body.classList.remove('fp-ply-galaxy-ready');
    this.disposeSceneResources();
    this.scene.clear();
    this.points = null;
    this.stellarVeil = null;
    this.nebulaMaterials.length = 0;
    this.renderer.renderLists.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  private async load(): Promise<void> {
    try {
      const response = await fetch('/assets/universe/need-some-space.ply', { signal: this.abortController.signal });
      if (!response.ok) throw new Error(`Galaxy point cloud unavailable (${response.status})`);
      const source = await response.text();
      if (this.destroyed) return;
      const geometry = this.parsePly(source);
      const material = new THREE.PointsMaterial({
        size: 0.072,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: 0.96,
        map: this.makeStarTexture(),
        alphaTest: 0.02,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      this.points = new THREE.Points(geometry, material);
      // 点云原始坐标以近正面视角略微压扁，呈现可辨识的银盘，而不是散乱白点。
      this.points.rotation.set(-0.9, 0.04, -0.1);
      this.addNebulaVeils(this.points);
      this.stellarVeil = this.buildStellarVeil();
      this.points.add(this.stellarVeil);
      this.group.add(this.points);
      document.body.classList.add('fp-ply-galaxy-ready');
    } catch (error) {
      if (this.destroyed || (error instanceof DOMException && error.name === 'AbortError')) return;
      // The existing canvas spiral remains as an offline fallback when the model cannot be fetched.
      console.warn('[ASKUARY] unable to load CC BY galaxy point cloud', error);
    }
  }

  private parsePly(source: string): THREE.BufferGeometry {
    const rows = source.split(/\r?\n/);
    const headerEnd = rows.indexOf('end_header');
    if (headerEnd < 0) throw new Error('Invalid PLY header');
    const countRow = rows.find((row) => row.startsWith('element vertex '));
    const count = Number(countRow?.split(' ')[2]);
    if (!Number.isFinite(count) || count < 1) throw new Error('Invalid PLY vertex count');

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    let index = 0;
    let minX = Infinity; let minY = Infinity; let minZ = Infinity;
    let maxX = -Infinity; let maxY = -Infinity; let maxZ = -Infinity;
    for (let row = headerEnd + 1; row < rows.length && index < count; row++) {
      const values = rows[row].trim().split(/\s+/);
      if (values.length < 6) continue;
      const x = Number(values[0]); const y = Number(values[1]); const z = Number(values[2]);
      if (![x, y, z].every(Number.isFinite)) continue;
      const offset = index * 3;
      positions[offset] = x; positions[offset + 1] = y; positions[offset + 2] = z;
      colors[offset] = Number(values[3]) / 255;
      colors[offset + 1] = Number(values[4]) / 255;
      colors[offset + 2] = Number(values[5]) / 255;
      minX = Math.min(minX, x); minY = Math.min(minY, y); minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); maxZ = Math.max(maxZ, z);
      index++;
    }
    if (index !== count) throw new Error('PLY vertex data is incomplete');

    const centerX = (minX + maxX) * .5;
    const centerY = (minY + maxY) * .5;
    const centerZ = (minZ + maxZ) * .5;
    const scale = 15.2 / Math.max(maxX - minX, maxY - minY, maxZ - minZ);
    for (let point = 0; point < count; point++) {
      const offset = point * 3;
      positions[offset] = (positions[offset] - centerX) * scale;
      positions[offset + 1] = (positions[offset + 1] - centerY) * scale;
      positions[offset + 2] = (positions[offset + 2] - centerZ) * scale;
      const localX = positions[offset];
      const localY = positions[offset + 1];
      const localZ = positions[offset + 2];
      const radius = clamp(Math.hypot(localX, localY * 1.28, localZ) / 8.4, 0, 1);
      const warmth = 1 - radius;
      // 用星盘方位划分不同星族：暖核、青蓝旋臂与少量紫白星云，而不是一层同色白点。
      const armSignal = .5 + .5 * Math.sin(Math.atan2(localY * 1.16, localX) * 2.2 + radius * 6.4);
      const blueArm = (1 - warmth) * (.3 + armSignal * .7);
      const roseCore = Math.pow(warmth, 1.7);
      const violetDust = Math.max(0, Math.sin(localX * 1.7 - localY * 1.2)) * (1 - warmth) * .22;
      colors[offset] = clamp(.14 + roseCore * .86 + violetDust * .35 - blueArm * .1, 0, 1);
      colors[offset + 1] = clamp(.1 + roseCore * .19 + blueArm * .43, 0, 1);
      colors[offset + 2] = clamp(.28 + blueArm * .7 - roseCore * .04 + violetDust * .5, 0, 1);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeBoundingSphere();
    return geometry;
  }

  private render = (): void => {
    if (this.destroyed) return;
    this.progress += (this.target - this.progress) * .075;
    const elapsed = (performance.now() - this.startedAt) * .001;
    if (this.points) {
      // 最后 2.5% 才交接给太阳系。此前恒星持续放大，保持一次完整的飞行镜头。
      // 太阳系由远而近出现时，银河才逐渐退为背景，交接不靠突然切屏。
      const fade = 1 - ease((this.progress - .74) / .08);
      this.points.material.opacity = fade * .98;
      if (this.stellarVeil) this.stellarVeil.material.opacity = fade * .58;
      for (const veil of this.nebulaMaterials) veil.material.opacity = veil.baseOpacity * fade;
      this.points.visible = fade > .012;
      this.group.rotation.y = elapsed * .022;
      this.group.rotation.x = Math.sin(elapsed * .11) * .022;
      this.group.scale.setScalar(1 + this.progress * .035);
      const worldTarget = new THREE.Vector3();
      this.solarSystemStar.getWorldPosition(worldTarget);
      const flight = ease(this.progress / .78);
      const targetCamera = worldTarget.clone().add(new THREE.Vector3(0, -0.022, 0.032));
      this.camera.position.lerpVectors(this.initialCamera, targetCamera, flight);
      this.camera.position.x += Math.sin(elapsed * .09) * .08 * (1 - flight);
      this.camera.fov = 42 - flight * 18;
      this.camera.lookAt(worldTarget);
      this.camera.updateProjectionMatrix();
      const distance = this.camera.position.distanceTo(worldTarget);
      // 到达前是一道受控的暖光，而不是覆盖整屏的白色闪屏。
      const starSize = clamp(.42 / Math.max(distance, .08), .078, 3.6);
      this.solarSystemStar.scale.setScalar(starSize);
      const starFade = 1 - ease((this.progress - .5) / .12);
      (this.solarSystemStar.material as THREE.SpriteMaterial).opacity = fade * starFade;
    }
    this.renderer.render(this.scene, this.camera);
    this.animationFrameId = requestAnimationFrame(this.render);
  };

  private disposeSceneResources(): void {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    this.scene.traverse((object) => {
      const renderable = object as THREE.Object3D & {
        geometry?: THREE.BufferGeometry;
        material?: THREE.Material | THREE.Material[];
      };
      if (renderable.geometry?.isBufferGeometry) geometries.add(renderable.geometry);
      const objectMaterials = renderable.material
        ? (Array.isArray(renderable.material) ? renderable.material : [renderable.material])
        : [];
      for (const material of objectMaterials) {
        materials.add(material);
        for (const value of Object.values(material)) {
          if (value && typeof value === 'object' && 'isTexture' in value && value.isTexture === true) {
            textures.add(value as THREE.Texture);
          }
        }
      }
    });
    for (const texture of textures) texture.dispose();
    for (const material of materials) material.dispose();
    for (const geometry of geometries) geometry.dispose();
  }

  private makeStarTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to create particle texture');
    const glow = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    glow.addColorStop(0, 'rgba(255,255,255,1)');
    glow.addColorStop(.12, 'rgba(255,244,220,.94)');
    glow.addColorStop(.34, 'rgba(160,194,255,.33)');
    glow.addColorStop(1, 'rgba(96,130,255,0)');
    context.fillStyle = glow;
    context.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
  }

  private addNebulaVeils(parent: THREE.Object3D): void {
    const texture = this.makeNebulaTexture();
    const veils = [
      { color: 0xe06679, opacity: .52, position: new THREE.Vector3(.15, -.05, -.24), scale: [5.9, 1.65] },
      { color: 0x249de4, opacity: .43, position: new THREE.Vector3(-2.5, .48, -.38), scale: [7.1, 1.32] },
      { color: 0x7d68dc, opacity: .34, position: new THREE.Vector3(2.65, -.7, -.45), scale: [4.8, 1.15] },
      { color: 0xf0a04a, opacity: .24, position: new THREE.Vector3(-.95, -.7, .06), scale: [3.2, .92] },
    ];
    for (const veil of veils) {
      const material = new THREE.SpriteMaterial({
        map: texture,
        color: veil.color,
        transparent: true,
        opacity: veil.opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      this.nebulaMaterials.push({ material, baseOpacity: veil.opacity });
      const sprite = new THREE.Sprite(material);
      sprite.position.copy(veil.position);
      sprite.scale.set(veil.scale[0], veil.scale[1], 1);
      sprite.renderOrder = -1;
      parent.add(sprite);
    }
  }

  private makeNebulaTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to create nebula texture');
    const glow = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    glow.addColorStop(0, 'rgba(255,255,255,.9)');
    glow.addColorStop(.18, 'rgba(255,255,255,.48)');
    glow.addColorStop(.54, 'rgba(255,255,255,.12)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = glow;
    context.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(canvas);
  }

  private buildStellarVeil(): THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial> {
    // 点云模型本身保留真实结构，额外的细粒子补足银河盘中看不见的恒星和尘埃密度。
    const count = 28000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    let seed = 1779033703;
    const random = (): number => {
      seed = Math.imul(seed ^ (seed >>> 16), 2246822507);
      seed = Math.imul(seed ^ (seed >>> 13), 3266489909);
      return ((seed ^= seed >>> 16) >>> 0) / 4294967296;
    };
    for (let index = 0; index < count; index++) {
      const arm = Math.floor(random() * 4);
      const radius = Math.pow(random(), .56) * 8.5;
      const angle = arm * Math.PI * .5 + radius * .67 + (random() - .5) * (.22 + radius * .09);
      const offset = index * 3;
      positions[offset] = Math.cos(angle) * radius;
      positions[offset + 1] = Math.sin(angle) * radius * .46 + (random() - .5) * .15;
      positions[offset + 2] = (random() - .5) * (.24 + radius * .045);
      const warmth = 1 - clamp(radius / 8.5, 0, 1);
      const isBlue = arm === 1 || arm === 3;
      colors[offset] = clamp(.18 + warmth * .78 + (isBlue ? -.06 : .08), 0, 1);
      colors[offset + 1] = clamp(.25 + warmth * .3 + (isBlue ? .27 : .04), 0, 1);
      colors[offset + 2] = clamp(.48 + (isBlue ? .42 : .14) - warmth * .12, 0, 1);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
      size: .036,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: .76,
      map: this.makeStarTexture(),
      alphaTest: .02,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return new THREE.Points(geometry, material);
  }
}
