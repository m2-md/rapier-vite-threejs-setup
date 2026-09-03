import type * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d";

/** Rapier gövdesinin transform'unu bir three.js nesnesine yazar. */
export function syncBodyToObject(
  body: RAPIER.RigidBody,
  object: THREE.Object3D,
): void {
  const t = body.translation(); // {x, y, z}
  const r = body.rotation(); // {x, y, z, w} — quaternion

  object.position.set(t.x, t.y, t.z);
  object.quaternion.set(r.x, r.y, r.z, r.w);
}
