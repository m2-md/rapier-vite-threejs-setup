import { createSim, type RapierApi } from "./sim";

/**
 * TLA hatasının ÜÇÜNCÜ çözümü: await'i bir async fonksiyonun içine al.
 * Yalnızca -compat yolunda geçerli — çünkü orada await'i SEN yazıyorsun.
 * Saf ESM yolunda o await eklentinin ürettiği bir bağımlılığın içindedir.
 *
 * Bu dosya demo girişi değil; `npm run bootstrap-async` ile koşar ve testlerle
 * aynı sayıyı basar: y = 0.49872392416000366.
 */
function startGame(R: RapierApi): void {
  const { world, bodies } = createSim(R, 8);
  for (let i = 0; i < 120; i++) world.step();
  console.log("y =", bodies[0].translation().y);
}

async function bootstrap() {
  const RAPIER = await import("@dimforge/rapier3d-compat");
  await RAPIER.init();
  startGame(RAPIER as unknown as RapierApi);
}
void bootstrap();
