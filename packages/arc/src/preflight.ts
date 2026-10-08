const ARC_MAINNET_CHAIN_ID = 5_042;
const UINT256_MAX = (1n << 256n) - 1n;

export interface ArcMainnetWritePlan {
  explicitOptIn: boolean;
  actualChainId: number;
  rpcUrl: string;
  approvedRpcUrl: string;
  selectedSignerAddress?: string;
  approvedSignerAddress?: string;
  plannedTransactions: number;
  maximumTransactions: number;
  principalUsdc6: bigint;
  maximumPrincipalUsdc6: bigint;
  gasExposureNative18: bigint;
  maximumGasExposureNative18: bigint;
  maximumTotalExposureNative18: bigint;
}

/**
 * Validate a future Mainnet write plan before any signer or broadcast code runs.
 * This function does not connect to an RPC, sign, or send a transaction.
 */
export function assertArcMainnetWritePlan(plan: ArcMainnetWritePlan): void {
  if (plan.explicitOptIn !== true) throw new Error("Mainnet writes require explicit opt-in");
  if (plan.actualChainId !== ARC_MAINNET_CHAIN_ID) throw new Error(`Mainnet preflight expected chain ID 5042; received ${plan.actualChainId}`);
  if (!plan.rpcUrl || plan.rpcUrl !== plan.approvedRpcUrl) throw new Error("Mainnet RPC URL does not match the explicitly approved endpoint");
  const signer = plan.selectedSignerAddress;
  const approvedSigner = plan.approvedSignerAddress;
  if (!signer || !/^0x[0-9a-fA-F]{40}$/.test(signer)) throw new Error("Mainnet preflight requires an explicitly selected signer address");
  if (!approvedSigner || signer.toLowerCase() !== approvedSigner.toLowerCase()) throw new Error("Selected Mainnet signer does not match the explicitly approved address");
  if (!Number.isSafeInteger(plan.plannedTransactions) || plan.plannedTransactions <= 0) throw new Error("Mainnet transaction count must be a positive safe integer");
  if (!Number.isSafeInteger(plan.maximumTransactions) || plan.maximumTransactions <= 0 || plan.plannedTransactions > plan.maximumTransactions) throw new Error("Planned Mainnet transaction count exceeds the approved maximum");

  for (const [name, value] of Object.entries({
    principalUsdc6: plan.principalUsdc6,
    maximumPrincipalUsdc6: plan.maximumPrincipalUsdc6,
    gasExposureNative18: plan.gasExposureNative18,
    maximumGasExposureNative18: plan.maximumGasExposureNative18,
    maximumTotalExposureNative18: plan.maximumTotalExposureNative18,
  })) {
    if (typeof value !== "bigint" || value < 0n || value > UINT256_MAX) throw new Error(`${name} must be a non-negative uint256 bigint`);
  }
  if (plan.principalUsdc6 === 0n) throw new Error("Mainnet principal exposure must be non-zero");
  if (plan.principalUsdc6 > plan.maximumPrincipalUsdc6) throw new Error("Mainnet principal exceeds the approved cap");
  if (plan.gasExposureNative18 > plan.maximumGasExposureNative18) throw new Error("Mainnet gas exposure exceeds the approved cap");
  const totalExposureNative18 = plan.principalUsdc6 * 1_000_000_000_000n + plan.gasExposureNative18;
  if (totalExposureNative18 > plan.maximumTotalExposureNative18) throw new Error("Total Mainnet exposure exceeds the approved cap");
}
