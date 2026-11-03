import * as T from "three";
import { fadeDeclarations, fadeDiscard } from "./visibility";

type Clip = { start: number; frames: number; duration: number };
type Field = { offset: number; length: number; size: number };
type Metadata = {
  bones: number;
  frames: number;
  height: number;
  animations: Record<string, Clip>;
  geometries: Record<string, Record<string, Field>>;
};
type Batch = {
  mesh: T.InstancedMesh;
  pose: T.InstancedBufferAttribute;
  count: number;
  visibility: T.InstancedBufferAttribute;
};
type Model = {
  meta: Metadata;
  duelClips: Record<string, Clip>;
  batches: Map<string, Batch>;
  material: T.MeshStandardMaterial;
  duelMaterial?: T.MeshStandardMaterial;
  depth: T.MeshDepthMaterial;
  texture: T.DataTexture;
  atlas: T.Texture;
  scale: number;
};
type Blend = {
  motion: string;
  previous: number;
  frame: number;
  at: number;
  seen: number;
};
export type Character = {
  id: string;
  model: string;
  weapon: string;
  x: number;
  y: number;
  z: number;
  facing: number;
  color: T.Color;
  motion: string;
  phase: number;
  loop: boolean;
  size?: number;
  hit?: number;
  lean?: number;
  visibility?: number;
  focus?: boolean;
};
const matrix = new T.Object3D();
const CAPACITY = 1100;
const versioned = (url: string) => url + "?v=" + import.meta.env.VITE_CHARACTER_REV;

/** Shared GPU pose atlas: three animated bodies, independent equipment and one instance per soldier.
 * The CPU samples one scalar pose per actor; it never updates hundreds of skeletons/mixers.
 */
export class Characters {
  group = new T.Group();
  ready = false;
  count = 0;
  private models = new Map<string, Model>();
  private blends = new Map<string, Blend>();
  private now = 0;
  private disposed = false;
  private eye = new T.Vector3();
  private closeCombat = false;
  private duelTextures: T.Texture[] = [];

  async load() {
    const loader = new T.TextureLoader();
    const [color, finish, normal] = await Promise.all(
      ["color", "finish", "normal"].map((kind) =>
        loader.loadAsync(versioned(`/assets/characters/duel-${kind}.png`)),
      ),
    );
    this.duelTextures = [color, finish, normal];
    for (const texture of this.duelTextures) texture.flipY = false;
    color.colorSpace = T.SRGBColorSpace;
    await Promise.all(
      ["knight", "viking", "ranger"].map(async (name) => {
        const prefix = `/assets/characters/${name}`;
        const get = async (url: string) => {
          const response = await fetch(versioned(url));
          if (!response.ok)
            throw new Error(`Character asset ${response.status}: ${url}`);
          return response;
        };
        const [meta, data, poses, atlas] = await Promise.all([
          get(prefix + ".json").then((r) => r.json()) as Promise<Metadata>,
          get(prefix + "-mesh.bin").then((r) => r.arrayBuffer()),
          get(prefix + "-poses.bin").then((r) => r.arrayBuffer()),
          loader.loadAsync(versioned(prefix + ".png")),
        ]);
        atlas.colorSpace = T.SRGBColorSpace;
        atlas.flipY = false;
        if (poses.byteLength !== meta.bones * meta.frames * 32)
          throw new Error(`Pose atlas size mismatch for ${name}`);
        const texture = new T.DataTexture(
          new Uint16Array(poses),
          meta.bones * 4,
          meta.frames,
          T.RGBAFormat,
          T.HalfFloatType,
        );
        texture.minFilter = texture.magFilter = T.LinearFilter;
        texture.generateMipmaps = false;
        texture.needsUpdate = true;
        const material = new T.MeshStandardMaterial({
          map: atlas,
          roughness: 0.72,
          metalness: 0.12,
        });
        const depth = new T.MeshDepthMaterial({
          depthPacking: T.RGBADepthPacking,
        });
        const inject = (
          shader: Parameters<T.Material["onBeforeCompile"]>[0],
          surface: boolean,
          duel = false,
        ) => {
          shader.uniforms.poseAtlas = { value: texture };
          shader.uniforms.poseSize = {
            value: new T.Vector2(meta.bones * 4, meta.frames),
          };
          shader.vertexShader = shader.vertexShader.replace(
            "#include <common>",
            `#include <common>
          uniform sampler2D poseAtlas;
          uniform vec2 poseSize;
          attribute vec4 skinIndex;
          attribute vec4 skinWeight;
          attribute vec4 pose;
          attribute vec4 paint;
          attribute float visibility;
          ${fadeDeclarations}
          varying vec4 vPaint;
          varying float vHit;
          mat4 poseBone(float joint, float frame) {
            float x = joint * 4.0;
            float y = (frame + 0.5) / poseSize.y;
            return mat4(texture2D(poseAtlas,vec2((x+.5)/poseSize.x,y)),
              texture2D(poseAtlas,vec2((x+1.5)/poseSize.x,y)),
              texture2D(poseAtlas,vec2((x+2.5)/poseSize.x,y)),
              texture2D(poseAtlas,vec2((x+3.5)/poseSize.x,y)));
          }
          mat4 poseSkin(float frame) {
            mat4 m = poseBone(skinIndex.x,frame) * skinWeight.x;
            if(skinWeight.y > 0.001) m += poseBone(skinIndex.y,frame) * skinWeight.y;
            if(skinWeight.z > 0.001) m += poseBone(skinIndex.z,frame) * skinWeight.z;
            if(skinWeight.w > 0.001) m += poseBone(skinIndex.w,frame) * skinWeight.w;
            return m;
          }
        `,
          );
          shader.vertexShader = shader.vertexShader.replace(
            "void main() {",
            `void main() {
          mat4 actorSkin = poseSkin(pose.x);
          if(pose.z < .999) actorSkin = actorSkin * pose.z + poseSkin(pose.y) * (1.0-pose.z);
          vPaint = paint;
          vHit = pose.w;
          vVisibility = visibility;
        `,
          );
          shader.vertexShader = shader.vertexShader.replace(
            "#include <beginnormal_vertex>",
            `#include <beginnormal_vertex>
          objectNormal = mat3(actorSkin) * objectNormal;
        `,
          );
          shader.vertexShader = shader.vertexShader.replace(
            "#include <begin_vertex>",
            "vec3 transformed = (actorSkin * vec4(position,1.0)).xyz;",
          );
          shader.fragmentShader = shader.fragmentShader
            .replace(
              "#include <common>",
              "#include <common>\n" + fadeDeclarations,
            )
            .replace(
              "#include <clipping_planes_fragment>",
              "#include <clipping_planes_fragment>\n" + fadeDiscard,
            );
          if (surface) {
            shader.fragmentShader = shader.fragmentShader.replace(
              "#include <common>",
              "#include <common>\nvarying vec4 vPaint;\nvarying float vHit;",
            );
            shader.fragmentShader = shader.fragmentShader.replace(
              "#include <color_fragment>",
              duel ? `diffuseColor.rgb *= vPaint.rgb;
                diffuseColor.rgb = mix(diffuseColor.rgb,vec3(1.0,.75,.38),vHit*.45);` : `
            if(vPaint.a > .5 && vPaint.a < 1.5) diffuseColor.rgb = vPaint.rgb;
            #ifdef USE_COLOR
              bool coloredCloth = (diffuseColor.g > diffuseColor.r*1.2 && diffuseColor.g > diffuseColor.b*1.2) ||
                (diffuseColor.b > diffuseColor.r*1.25 && diffuseColor.b > diffuseColor.g*1.08) ||
                (diffuseColor.r > diffuseColor.g*2.4 && diffuseColor.r > diffuseColor.b*2.5);
              // Hood and skin share the source Head mesh. Recolor its green texels only.
              bool greenHood = vPaint.a < .5 && diffuseColor.g > diffuseColor.r*1.2 && diffuseColor.g > diffuseColor.b*1.2;
              if((vPaint.a > 1.5 && vPaint.a < 2.5) || (vPaint.a > 2.5 && coloredCloth) || greenHood) diffuseColor.rgb = vColor * (.55 + dot(diffuseColor.rgb, vec3(.3,.59,.11)) * .65);
            #endif
            diffuseColor.rgb = mix(diffuseColor.rgb,vec3(1.0,.75,.38),vHit*.45);
          `,
            );
          }
        };
        material.onBeforeCompile = (s) => inject(s, true);
        depth.onBeforeCompile = (s) => inject(s, false);
        material.customProgramCacheKey = () => "ironfront-rigged-surface-v1";
        depth.customProgramCacheKey = () => "ironfront-rigged-shadow-v1";
        let duelMaterial: T.MeshStandardMaterial | undefined;
        if (meta.geometries.duelBody) {
          duelMaterial = new T.MeshStandardMaterial({
            map: color, roughnessMap: finish, metalnessMap: finish,
            roughness: 1, metalness: 1, normalMap: normal,
            normalScale: new T.Vector2(.55, .55),
          });
          duelMaterial.onBeforeCompile = (s) => inject(s, true, true);
          duelMaterial.customProgramCacheKey = () => "ironfront-duel-surface-v1";
        }
        const model: Model = {
          meta,
          duelClips: Object.fromEntries(
            Object.entries(meta.animations)
              .filter(([key]) => key.startsWith("duel_"))
              .map(([key, clip]) => [key.slice(5), clip]),
          ),
          batches: new Map(),
          material,
          duelMaterial,
          depth,
          texture,
          atlas,
          scale: 2.15 / meta.height,
        };
        for (const [kind, fields] of Object.entries(meta.geometries)) {
          const geo = new T.BufferGeometry();
          for (const [attr, field] of Object.entries(fields)) {
            if (attr === "index")
              geo.setIndex(
                new T.BufferAttribute(
                  new Uint32Array(
                    new Float32Array(data, field.offset, field.length),
                  ),
                  1,
                ),
              );
            else
              geo.setAttribute(
                attr,
                new T.BufferAttribute(
                  new Float32Array(data, field.offset, field.length),
                  field.size,
                ),
              );
          }
          const pose = new T.InstancedBufferAttribute(
            new Float32Array(CAPACITY * 4),
            4,
          ).setUsage(T.DynamicDrawUsage);
          geo.setAttribute("pose", pose);
          const visibility = new T.InstancedBufferAttribute(
            new Float32Array(CAPACITY).fill(1),
            1,
          ).setUsage(T.DynamicDrawUsage);
          geo.setAttribute("visibility", visibility);
          const surface = kind === "duelBody" || kind === "duelSword" ? duelMaterial! : material;
          const mesh = new T.InstancedMesh(geo, surface, CAPACITY);
          mesh.name = `soldiers-${name}-${kind}`;
          mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
          mesh.instanceColor = new T.InstancedBufferAttribute(
            new Float32Array(CAPACITY * 3),
            3,
          ).setUsage(T.DynamicDrawUsage);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.customDepthMaterial = depth;
          mesh.frustumCulled = false;
          mesh.count = 0;
          model.batches.set(kind, { mesh, pose, visibility, count: 0 });
          this.group.add(mesh);
        }
        this.models.set(name, model);
      }),
    );
    if (this.disposed) {
      this.dispose();
      return;
    }
    this.ready = true;
  }

  begin(time: number, eye?: T.Vector3, closeCombat = false) {
    this.now = time;
    if (eye) this.eye.copy(eye);
    this.count = 0;
    this.closeCombat = closeCombat;
    for (const model of this.models.values())
      for (const batch of model.batches.values()) batch.count = 0;
  }

  duration(model: string, motion: string) {
    return this.models.get(model)?.meta.animations[motion]?.duration || 1;
  }

  draw(actor: Character) {
    const model = this.models.get(actor.model);
    if (!model) return;
    const clip =
      (actor.weapon === "duelSword" && model.duelClips[actor.motion]) ||
      model.meta.animations[actor.motion] || model.meta.animations.idle;
    const duration = Math.max(clip.duration, 1 / 24);
    const phase = actor.loop
      ? ((actor.phase % duration) + duration) % duration
      : T.MathUtils.clamp(actor.phase, 0, duration);
    const frame = clip.start + (phase / duration) * (clip.frames - 1);
    let blend = this.blends.get(actor.id);
    if (!blend) {
      blend = {
        motion: actor.motion,
        previous: frame,
        frame,
        at: -10,
        seen: this.now,
      };
      this.blends.set(actor.id, blend);
    }
    if (blend.motion !== actor.motion) {
      blend.previous = blend.frame;
      blend.motion = actor.motion;
      blend.at = this.now;
    }
    blend.frame = frame;
    blend.seen = this.now;
    const mix = T.MathUtils.clamp((this.now - blend.at) / 0.12, 0, 1);
    matrix.position.set(actor.x, actor.y, actor.z);
    matrix.rotation.set(actor.lean || 0, actor.facing, 0, "YXZ");
    const scale = model.scale * (actor.size || 1);
    matrix.scale.set(scale * 0.92, scale * 1.16, scale * 0.95);
    matrix.updateMatrix();
    const distance =
      (actor.x - this.eye.x) ** 2 +
      (actor.y - this.eye.y) ** 2 +
      (actor.z - this.eye.z) ** 2;
    const detail = actor.focus
      ? "body"
      : distance > (this.closeCombat ? 900 : 2025)
        ? "bodyFar"
        : distance > (this.closeCombat ? 144 : 625)
          ? "bodyMid"
          : "body";
    const body = actor.weapon === "duelSword" && detail === "body" ? "duelBody" : detail;
    for (const kind of [body, actor.weapon]) {
      const batch =
        model.batches.get(kind) ||
        (kind.startsWith("body") ? model.batches.get("body") : undefined);
      if (!batch || batch.count >= CAPACITY) continue;
      const i = batch.count++;
      batch.mesh.setMatrixAt(i, matrix.matrix);
      batch.mesh.setColorAt(i, actor.color);
      batch.pose.setXYZW(i, frame, blend.previous, mix, actor.hit || 0);
      batch.visibility.setX(i, actor.visibility ?? 1);
    }
    this.count++;
  }

  end() {
    for (const model of this.models.values())
      for (const batch of model.batches.values()) {
        batch.mesh.count = batch.count;
        if (!batch.count) continue;
        for (const [attribute, size] of [
          [batch.mesh.instanceMatrix, 16],
          [batch.mesh.instanceColor, 3],
          [batch.pose, 4],
          [batch.visibility, 1],
        ] as const) {
          if (!attribute) continue;
          attribute.clearUpdateRanges();
          attribute.addUpdateRange(0, batch.count * size);
          attribute.needsUpdate = true;
        }
      }
    for (const [id, blend] of this.blends)
      if (this.now - blend.seen > 8) this.blends.delete(id);
  }

  dispose() {
    this.disposed = true;
    for (const model of this.models.values()) {
      for (const batch of model.batches.values()) {
        batch.mesh.geometry.dispose();
        batch.mesh.dispose();
      }
      model.material.dispose();
      model.duelMaterial?.dispose();
      model.depth.dispose();
      model.texture.dispose();
      model.atlas.dispose();
    }
    this.models.clear();
    for (const texture of this.duelTextures) texture.dispose();
    this.duelTextures = [];
    this.blends.clear();
    this.group.clear();
  }
}

export function outfit(owner: number, kind: string, heroClass = -1) {
  const ranged = kind === "archer" || kind === "horseArcher" || heroClass === 2;
  const duelSword = kind === "sword" && ((owner === 3 && heroClass === 0) || (owner === 0 && heroClass < 0));
  return {
    model:
      kind === "axe" || kind === "berserker"
        ? "viking"
        : ranged
          ? owner === 1
            ? "viking"
            : "ranger"
          : owner === 0
            ? "knight"
            : owner === 1
              ? "viking"
              : "ranger",
    weapon: duelSword ? "duelSword" : ranged
      ? "bow"
      : kind === "berserker"
        ? "dual"
        : kind === "axe"
          ? "axe"
          : kind === "javelin"
            ? "javelin"
            : ["spear", "lancer", "camel"].includes(kind)
              ? "spear"
              : "sword",
    attack: ranged
      ? "shoot"
      : kind === "berserker"
        ? "dual"
        : kind === "axe"
          ? "chop"
          : kind === "javelin"
            ? "throw"
            : ["spear", "lancer", "camel"].includes(kind)
              ? "stab"
              : "slash",
  };
}
