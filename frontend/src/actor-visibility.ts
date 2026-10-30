import { Frustum, Matrix4, type Camera } from "three";

/** Conservative whole-actor bounds, including weapons, mount and short sun shadow.
 * Only drawing is culled: authoritative state and render interpolation keep advancing.
 */
export class ActorVisibility {
  private frustum = new Frustum();
  private matrix = new Matrix4();

  update(camera: Camera) {
    this.matrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    );
    this.frustum.setFromProjectionMatrix(this.matrix);
  }

  visible(x: number, y: number, z: number, radius = 5) {
    for (const plane of this.frustum.planes) {
      const n = plane.normal;
      if (n.x * x + n.y * y + n.z * z + plane.constant < -radius) return false;
    }
    return true;
  }
}
