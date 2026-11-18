import * as THREE from "three";

/**
 * Turn the visitor on the spot, in one step. A turn in one step is the
 * comfortable kind; a slow spin of the whole view makes people ill. It is also
 * the only way to face the other way for someone seated who can't turn round.
 */
export function turnVisitor(rig: THREE.Object3D, camera: THREE.Camera, degrees: number): void {
  const head = camera.getWorldPosition(new THREE.Vector3());
  const a = THREE.MathUtils.degToRad(degrees);
  const dx = rig.position.x - head.x;
  const dz = rig.position.z - head.z;
  // Swing the rig round the head, so the head stays where it is.
  rig.position.x = head.x + dx * Math.cos(a) + dz * Math.sin(a);
  rig.position.z = head.z - dx * Math.sin(a) + dz * Math.cos(a);
  rig.rotation.y += a;
}
