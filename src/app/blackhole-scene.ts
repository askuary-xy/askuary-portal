import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export type BlackholeScreenTarget = { x: number; y: number; r: number };

const FINAL_CAMERA_Z = 14.5;
const FAR_CAMERA_Z = 62;
const WARP_CAMERA_Z = 9.8;
// 官方演示是严格的正视锁定镜头：盘与事件视界共用同一水平中线。
// 只保留近乎不可察觉的高度，避免透视把真实吸积盘错看成一张分离的横向贴片。
const CAMERA_ELEVATION = .1;
const ASSET_ROOT = '/assets/universe/blackhole';

type BlackholeTextures = {
  ring: THREE.Texture;
  ringAlpha: THREE.Texture;
  skin: THREE.Texture;
  skinInner: THREE.Texture;
};

/**
 * 太阳系之后的黑洞目的地。
 *
 * FBX 的发光壳贴图以黑色代表“无光”，但 FBXLoader 会把它们还原成普通不透明
 * Phong 材质，结果便会成为一颗金色实心球。这里保留原模型、网格和 Take 001
 * 动画，只按模型语义重建合成顺序：发光透镜层 -> 黑色事件视界 -> 水平吸积盘。
 */
export class BlackholeScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly composer: EffectComposer;
  private readonly bloomPass: UnrealBloomPass;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(38, 1, .1, 120);
  private readonly root = new THREE.Group();
  private readonly target = { x: 0, y: 0, r: 0 };
  private readonly clock = new THREE.Clock();
  private model: THREE.Group | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private readonly modelSize = new THREE.Vector3();
  private readonly loadedTextures = new Set<THREE.Texture>();
  private animationFrameId: number | null = null;
  private destroyed = false;
  private travelTarget = 0;
  private travel = 0;
  private warpTarget = 0;
  private warp = 0;
  private readonly resizeHandler = (): void => this.resize();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), .4, .36, .52);
    this.composer.addPass(this.bloomPass);
    this.camera.position.set(0, CAMERA_ELEVATION, FAR_CAMERA_Z);

    this.scene.add(this.root);
    void this.loadModel();
    this.resize();
    window.addEventListener('resize', this.resizeHandler);
    this.render();
  }

  setProgress(value: number): void {
    this.travelTarget = THREE.MathUtils.clamp(value, 0, 1);
  }

  getTarget(): BlackholeScreenTarget | null {
    return this.travel > .1 ? this.target : null;
  }

  activateWarp(): void {
    this.warpTarget = 1;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.animationFrameId !== null) cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = null;
    window.removeEventListener('resize', this.resizeHandler);
    this.mixer?.stopAllAction();
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Sprite)) return;
      if ('geometry' in object && object.geometry instanceof THREE.BufferGeometry) geometries.add(object.geometry);
      const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
      objectMaterials.forEach((material) => {
        if (material instanceof THREE.Material) materials.add(material);
      });
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    this.loadedTextures.forEach((texture) => texture.dispose());
    this.loadedTextures.clear();
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  private resize(): void {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    this.fitModel();
  }

  /** 将模型构图约束为：吸积盘接近满宽、引力透镜占画面高度约一半。 */
  private fitModel(): void {
    if (!this.model || this.modelSize.x <= 0 || this.modelSize.y <= 0) return;
    const visibleHeight = 2 * FINAL_CAMERA_Z * Math.tan(THREE.MathUtils.degToRad(this.camera.fov * .5));
    const visibleWidth = visibleHeight * this.camera.aspect;
    const widthScale = (visibleWidth * .98) / this.modelSize.x;
    const heightScale = (visibleHeight * .56) / this.modelSize.y;
    this.model.scale.setScalar(Math.min(widthScale, heightScale));
  }

  private async loadModel(): Promise<void> {
    const textureLoader = new THREE.TextureLoader();
    const fbxLoader = new FBXLoader();

    try {
      const [fbx, ring, ringAlpha, skin, skinInner] = await Promise.all([
        fbxLoader.loadAsync(`${ASSET_ROOT}/blackhole.fbx`),
        textureLoader.loadAsync(`${ASSET_ROOT}/ring_diff_B.jpg`),
        textureLoader.loadAsync(`${ASSET_ROOT}/ring_opa.jpg`),
        textureLoader.loadAsync(`${ASSET_ROOT}/skin_diff_B.jpg`),
        textureLoader.loadAsync(`${ASSET_ROOT}/skin_inner_diff_B.jpg`),
      ]);
      const textures: BlackholeTextures = { ring, ringAlpha, skin, skinInner };
      Object.values(textures).forEach((texture) => this.loadedTextures.add(texture));
      this.prepareTextures(textures);

      fbx.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(fbx);
      bounds.getSize(this.modelSize);
      if (!Number.isFinite(this.modelSize.x) || this.modelSize.x <= 0) return;

      const center = bounds.getCenter(new THREE.Vector3());
      fbx.position.sub(center);
      fbx.rotation.set(0, 0, 0);

      const discardedMaterials = new Set<THREE.Material>();
      let meshIndex = 0;
      fbx.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        node.castShadow = false;
        node.receiveShadow = false;
        const previous = Array.isArray(node.material) ? node.material : [node.material];
        previous.forEach((material) => discardedMaterials.add(material));
        this.configureMesh(node, textures, meshIndex);
        meshIndex += 1;
      });
      discardedMaterials.forEach((material) => material.dispose());

      this.model = fbx;
      this.root.add(fbx);
      this.fitModel();

      const clip = fbx.animations.find((item) => item.name === 'Take 001') ?? fbx.animations[0];
      if (clip) {
        this.mixer = new THREE.AnimationMixer(fbx);
        this.mixer.clipAction(clip).setLoop(THREE.LoopRepeat, Infinity).play();
      }
    } catch (error) {
      // 模型是唯一正式画面；载入失败时不以通用白圈冒充原模型。
      console.error('[blackhole] Failed to load the original FBX model', error);
    }
  }

  private prepareTextures(textures: BlackholeTextures): void {
    const anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    for (const texture of Object.values(textures)) {
      texture.anisotropy = anisotropy;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.needsUpdate = true;
    }
    textures.ring.colorSpace = THREE.SRGBColorSpace;
    textures.skin.colorSpace = THREE.SRGBColorSpace;
    textures.skinInner.colorSpace = THREE.SRGBColorSpace;
    // 遮罩保持线性，避免把柔软的盘缘压成一块硬质斜布。
    textures.ringAlpha.colorSpace = THREE.NoColorSpace;
  }

  private configureMesh(mesh: THREE.Mesh, textures: BlackholeTextures, layerIndex: number): void {
    const nodeName = mesh.name.toLowerCase();
    const previous = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const materialName = previous?.name.toLowerCase() ?? '';
    const isWideDisk = nodeName === 'blackhole_ring';
    const isLensSkin = materialName === 'blackhole_skin';
    const isInnerSkin = materialName === 'blackhole_skin_inner';
    const isSecondaryRing = materialName === 'blackhole_ring2';
    const isCore = materialName === 'blackhole_core';
    const isEventHorizon = nodeName === 'blackhole_core';

    if (isWideDisk) {
      mesh.material = this.makeGlowMaterial(textures.ring, 1, textures.ringAlpha);
      mesh.renderOrder = 100;
      return;
    }

    if (isLensSkin || isInnerSkin || isSecondaryRing) {
      const map = isLensSkin ? textures.skin : isInnerSkin ? textures.skinInner : textures.ring;
      const opacityByLayer: Record<string, number> = {
        blackhole_skin_001: .15,
        blackhole_skin_003: .21,
        blackhole_skin_005: .18,
        blackhole_skin_006: .135,
        blackhole_skin_008: .105,
        blackhole_skin_009: .135,
        blackhole_skin_010: .15,
        blackhole_skin_012: .18,
        blackhole_skin_013: .105,
        blackhole_core002: .068,
      };
      const opacity = opacityByLayer[nodeName] ?? (isLensSkin ? .15 : isInnerSkin ? .12 : .075);
      mesh.material = this.makeLensMaterial(map, opacity);
      mesh.renderOrder = 10 + layerIndex;
      return;
    }

    if (isCore) {
      if (nodeName.startsWith('blackhole_skin_')) {
        // 这些网格是 FBX 内部用来逐层裁切的黑壳。WebGL 的透明排序无法像
        // 原查看器那样稳定交替合成，因此只保留真实发光 skin 壳与核心球。
        mesh.visible = false;
        return;
      }
      mesh.material = new THREE.MeshBasicMaterial({
        color: 0x000000,
        side: THREE.FrontSide,
        // 与发光层进入同一透明渲染队列，renderOrder 才能保证黑色遮罩后绘制。
        transparent: true,
        opacity: 1,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });
      // 核心球先绘制；基于 Fresnel 的真实 skin 壳随后只在轮廓处发光，
      // 因而中心始终保持纯黑，不再依靠末尾黑壳把所有光层一起压掉。
      mesh.renderOrder = isEventHorizon ? 2 : 3;
      return;
    }

    mesh.visible = false;
  }

  private makeGlowMaterial(map: THREE.Texture, opacity: number, alphaMap: THREE.Texture | null = null): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({
      map,
      alphaMap,
      color: 0xffffed,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      toneMapped: true,
    });
  }

  private makeLensMaterial(map: THREE.Texture, opacity: number): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        map: { value: map },
        opacity: { value: opacity },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormalView;
        varying vec3 vViewPosition;

        void main() {
          vUv = uv;
          vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
          vNormalView = normalize(normalMatrix * normal);
          vViewPosition = -viewPosition.xyz;
          gl_Position = projectionMatrix * viewPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D map;
        uniform float opacity;
        varying vec2 vUv;
        varying vec3 vNormalView;
        varying vec3 vViewPosition;

        void main() {
          vec3 viewDirection = normalize(vViewPosition);
          float facing = abs(dot(normalize(vNormalView), viewDirection));
          float fresnel = pow(1.0 - clamp(facing, 0.0, 1.0), 2.4);
          float lens = smoothstep(0.26, 0.91, fresnel);
          vec3 textureColor = texture2D(map, vUv).rgb;
          float luminance = dot(textureColor, vec3(0.2126, 0.7152, 0.0722));
          float textureMask = smoothstep(0.08, 0.72, luminance);
          float textureDetail = mix(0.42, 1.32, smoothstep(0.16, 0.86, luminance));
          float upperHemisphere = smoothstep(-0.12, 0.12, normalize(vNormalView).y);
          float hemisphereGain = mix(0.78, 1.18, upperHemisphere);
          vec3 amber = vec3(1.02, 0.43, 0.08);
          vec3 whiteHot = vec3(1.34, 1.08, 0.72);
          vec3 glow = mix(amber, whiteHot, smoothstep(0.36, 1.0, fresnel)) * textureDetail;
          gl_FragColor = vec4(glow * hemisphereGain, lens * opacity * mix(0.35, 1.0, textureMask));
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
  }

  private render = (): void => {
    if (this.destroyed) return;
    const delta = Math.min(this.clock.getDelta(), .05);
    this.travel += (this.travelTarget - this.travel) * .072;
    this.warp += (this.warpTarget - this.warp) * .11;
    const arrival = this.travel * this.travel * (3 - 2 * this.travel);
    const visible = arrival > .002 || this.warp > .002;

    this.root.visible = visible;
    this.root.position.set(0, 0, 0);
    this.root.rotation.set(0, 0, 0);
    if (this.mixer && visible) this.mixer.update(delta);

    const approachZ = THREE.MathUtils.lerp(FAR_CAMERA_Z, FINAL_CAMERA_Z, arrival);
    const cameraZ = THREE.MathUtils.lerp(approachZ, WARP_CAMERA_Z, this.warp);
    // 相机锁在模型正前方；吸积盘和事件视界来自同一个 FBX 根节点，不再人为错开。
    this.camera.position.set(0, CAMERA_ELEVATION, cameraZ);
    this.camera.lookAt(0, 0, 0);

    const width = Math.max(1, this.renderer.domElement.clientWidth);
    const height = Math.max(1, this.renderer.domElement.clientHeight);
    this.target.x = width * .5;
    this.target.y = height * .5;
    this.target.r = Math.min(width, height) * THREE.MathUtils.lerp(.07, .27, arrival);

    // 到达黑洞前后都只向纯黑收束，不叠加太阳系星空或额外星点。
    const blackness = THREE.MathUtils.smoothstep(arrival, .015, .18);
    this.renderer.domElement.style.opacity = visible ? '1' : '0';
    this.renderer.setClearColor(0x000000, blackness);
    this.composer.render();
    this.animationFrameId = requestAnimationFrame(this.render);
  };
}
