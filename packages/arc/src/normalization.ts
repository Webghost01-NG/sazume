export const NATIVE18_PER_USDC6 = 10n ** 12n;

/** Converts native USDC precision into application USDC6 by truncating sub-micro-USDC remainder. */
export function native18ToUsdc6(gasCostNative18: bigint): bigint {
  if (gasCostNative18 < 0n) throw new Error("Gas cost cannot be negative");
  return gasCostNative18 / NATIVE18_PER_USDC6;
}
