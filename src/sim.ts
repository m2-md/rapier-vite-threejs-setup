import type RAPIER from "@dimforge/rapier3d";

/** İki paketin de karşıladığı ortak yüzey. Kod hangisiyle koştuğunu bilmez. */
export type RapierApi = typeof import("@dimforge/rapier3d").default;

export interface Sim {
  world: RAPIER.World;
  bodies: RAPIER.RigidBody[];
}

/** Zemin + count adet düşen küp. Hiçbir rastgelelik yok: determinizm için. */
export function createSim(R: RapierApi, count = 24): Sim {
  const world = new R.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = 1 / 60;

  // Zemin: fixed (sabit) gövde — kuvvetlerden etkilenmez, yerinden oynamaz.
  const ground = world.createRigidBody(R.RigidBodyDesc.fixed());
  world.createCollider(R.ColliderDesc.cuboid(12, 0.1, 12), ground);

  const bodies: RAPIER.RigidBody[] = [];
  for (let i = 0; i < count; i++) {
    const col = i % 4;
    const row = (i / 4) | 0;

    // dynamic (dinamik) gövde: yerçekimi ve çarpışmalar onu iter.
    const body = world.createRigidBody(
      R.RigidBodyDesc.dynamic()
        .setTranslation(col * 1.1 - 1.65, 3 + row * 1.2, (i % 3) * 0.4 - 0.4)
        .setRotation({ x: 0.1, y: 0.2, z: 0.05, w: 0.973 }),
    );
    // cuboid(hx, hy, hz) YARIM boyut alır: 0.4 → 0.8 birimlik küp.
    world.createCollider(R.ColliderDesc.cuboid(0.4, 0.4, 0.4), body);
    bodies.push(body);
  }
  return { world, bodies };
}
