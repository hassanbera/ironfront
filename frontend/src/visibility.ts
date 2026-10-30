import type * as T from "three";
// Screen-door fade keeps opaque depth sorting and instancing. No extra render pass.
export const fadeDeclarations = "varying float vVisibility;";
export const fadeDiscard =
  "if (vVisibility < fract(dot(floor(gl_FragCoord.xy), vec2(.75487766,.56984029)))) discard;";
export function addInstanceFade(material: T.Material) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute float visibility;\n" + fadeDeclarations,
      )
      .replace("void main() {", "void main() {\nvVisibility = visibility;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\n" + fadeDeclarations)
      .replace(
        "#include <clipping_planes_fragment>",
        "#include <clipping_planes_fragment>\n" + fadeDiscard,
      );
  };
  material.customProgramCacheKey = () => "ironfront-instance-fade-v1";
}

/** Camera-to-hero capsule. Only foreground bodies that hide the hero fade. */
export function crowdVisibility(
  x: number,
  y: number,
  z: number,
  radius: number,
  eye: { x: number; y: number; z: number },
  hero: { x: number; y: number; z: number },
) {
  const dx = hero.x - eye.x,
    dy = hero.y - eye.y,
    dz = hero.z - eye.z;
  const length2 = dx * dx + dy * dy + dz * dz;
  if (length2 < 0.1) return 1;
  // A body enclosing the near plane must disappear completely, including
  // when its centre is slightly behind the camera.
  if (Math.hypot(x - eye.x, y - eye.y, z - eye.z) < radius + 1.1) return 0;
  const t = ((x - eye.x) * dx + (y - eye.y) * dy + (z - eye.z) * dz) / length2;
  if (t < -0.05 || t > 0.96) return 1;
  const distance = Math.hypot(
    x - eye.x - dx * t,
    y - eye.y - dy * t,
    z - eye.z - dz * t,
  );
  const inner = radius + 0.65,
    outer = inner + 0.65;
  const blend = Math.max(0, Math.min(1, (distance - inner) / (outer - inner)));
  return 0.08 + 0.92 * blend * blend * (3 - 2 * blend);
}
