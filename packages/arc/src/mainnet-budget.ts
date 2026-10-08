/**
 * Conservative, fixed limits for the proposed two-fixture Mainnet hero test.
 * This module only calculates a plan. It has no RPC, wallet, signing, or send
 * code and is not an authorization to execute the plan.
 */
export const ARC_MAINNET_MAX_FEE_PER_GAS_WEI = 40_000_000_000n;
export const ARC_MAINNET_MAX_TRANSACTIONS = 8;
export const ARC_MAINNET_QUALIFICATION_AMOUNT_USDC6 = 10_000n;
export const ARC_MAINNET_UNSAFE_ALLOWANCE_USDC6 = ARC_MAINNET_QUALIFICATION_AMOUNT_USDC6 * 2n;
export const ARC_MAINNET_IDEMPOTENT_ALLOWANCE_USDC6 = ARC_MAINNET_QUALIFICATION_AMOUNT_USDC6;

export const ARC_MAINNET_GAS_LIMITS = {
  unsafeDeployment: 600_000n,
  idempotentDeployment: 650_000n,
  unsafeApproval: 75_000n,
  idempotentApproval: 75_000n,
  unsafeSettlementFirst: 300_000n,
  unsafeSettlementRetry: 300_000n,
  idempotentSettlementFirst: 300_000n,
  idempotentDuplicateRevert: 300_000n,
} as const;

// Exact token allowances cap maximum transfer principal even if an observed
// implementation behaves unexpectedly: 2*A to Unsafe, A to Idempotent.
export const ARC_MAINNET_PRINCIPAL_USDC6 = ARC_MAINNET_UNSAFE_ALLOWANCE_USDC6 + ARC_MAINNET_IDEMPOTENT_ALLOWANCE_USDC6;
export const ARC_MAINNET_WALLET_FLOOR_USDC6 = 150_000n;

export interface ArcMainnetBudget {
  transactionCount: number;
  gasLimitTotal: bigint;
  maxFeePerGasWei: bigint;
  maximumGasCostNative18: bigint;
  maximumGasCostUsdc6: bigint;
  principalUsdc6: bigint;
  qualificationAmountUsdc6: bigint;
  unsafeAllowanceUsdc6: bigint;
  idempotentAllowanceUsdc6: bigint;
  maximumTotalExposureUsdc6: bigint;
  recommendedWalletFloorUsdc6: bigint;
  headroomAboveCapUsdc6: bigint;
}

export function calculateArcMainnetBudget(): ArcMainnetBudget {
  const gasLimits = Object.values(ARC_MAINNET_GAS_LIMITS);
  if (gasLimits.length !== ARC_MAINNET_MAX_TRANSACTIONS || gasLimits.some((limit) => limit <= 0n)) {
    throw new Error("Mainnet budget requires exactly eight positive transaction gas limits");
  }
  const gasLimitTotal = gasLimits.reduce((sum, limit) => sum + limit, 0n);
  const maximumGasCostNative18 = gasLimitTotal * ARC_MAINNET_MAX_FEE_PER_GAS_WEI;
  // Truncation is conservative for the funding cap: retain the raw 18-decimal
  // amount above for auditing and use its exact ceil when expressing USDC6.
  const maximumGasCostUsdc6 = (maximumGasCostNative18 + 999_999_999_999n) / 1_000_000_000_000n;
  const maximumTotalExposureUsdc6 = ARC_MAINNET_PRINCIPAL_USDC6 + maximumGasCostUsdc6;
  if (ARC_MAINNET_WALLET_FLOOR_USDC6 < maximumTotalExposureUsdc6) {
    throw new Error("Recommended Mainnet wallet floor must cover the maximum total exposure");
  }
  return {
    transactionCount: gasLimits.length,
    gasLimitTotal,
    maxFeePerGasWei: ARC_MAINNET_MAX_FEE_PER_GAS_WEI,
    maximumGasCostNative18,
    maximumGasCostUsdc6,
    principalUsdc6: ARC_MAINNET_PRINCIPAL_USDC6,
    qualificationAmountUsdc6: ARC_MAINNET_QUALIFICATION_AMOUNT_USDC6,
    unsafeAllowanceUsdc6: ARC_MAINNET_UNSAFE_ALLOWANCE_USDC6,
    idempotentAllowanceUsdc6: ARC_MAINNET_IDEMPOTENT_ALLOWANCE_USDC6,
    maximumTotalExposureUsdc6,
    recommendedWalletFloorUsdc6: ARC_MAINNET_WALLET_FLOOR_USDC6,
    headroomAboveCapUsdc6: ARC_MAINNET_WALLET_FLOOR_USDC6 - maximumTotalExposureUsdc6,
  };
}
