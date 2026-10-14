import type { Address, Hex } from "viem";
import {
  ARC_MAINNET_GAS_LIMITS,
  ARC_MAINNET_MAX_FEE_PER_GAS_WEI,
  ARC_MAINNET_PRINCIPAL_USDC6,
  ARC_MAINNET_QUALIFICATION_AMOUNT_USDC6,
  calculateArcMainnetBudget,
} from "./mainnet-budget.js";

export type MainnetStepId = keyof typeof ARC_MAINNET_GAS_LIMITS;
export type MainnetStepKind = "deployment" | "approval" | "settlement" | "expected-revert";

export interface MainnetStep {
  id: MainnetStepId;
  kind: MainnetStepKind;
  gasLimit: bigint;
  principalUsdc6: bigint;
}

export const MAINNET_STEPS: readonly MainnetStep[] = [
  { id: "unsafeDeployment", kind: "deployment", gasLimit: ARC_MAINNET_GAS_LIMITS.unsafeDeployment, principalUsdc6: 0n },
  { id: "idempotentDeployment", kind: "deployment", gasLimit: ARC_MAINNET_GAS_LIMITS.idempotentDeployment, principalUsdc6: 0n },
  { id: "unsafeApproval", kind: "approval", gasLimit: ARC_MAINNET_GAS_LIMITS.unsafeApproval, principalUsdc6: 0n },
  { id: "idempotentApproval", kind: "approval", gasLimit: ARC_MAINNET_GAS_LIMITS.idempotentApproval, principalUsdc6: 0n },
  { id: "unsafeSettlementFirst", kind: "settlement", gasLimit: ARC_MAINNET_GAS_LIMITS.unsafeSettlementFirst, principalUsdc6: ARC_MAINNET_QUALIFICATION_AMOUNT_USDC6 },
  { id: "unsafeSettlementRetry", kind: "settlement", gasLimit: ARC_MAINNET_GAS_LIMITS.unsafeSettlementRetry, principalUsdc6: ARC_MAINNET_QUALIFICATION_AMOUNT_USDC6 },
  { id: "idempotentSettlementFirst", kind: "settlement", gasLimit: ARC_MAINNET_GAS_LIMITS.idempotentSettlementFirst, principalUsdc6: ARC_MAINNET_QUALIFICATION_AMOUNT_USDC6 },
  { id: "idempotentDuplicateRevert", kind: "expected-revert", gasLimit: ARC_MAINNET_GAS_LIMITS.idempotentDuplicateRevert, principalUsdc6: 0n },
] as const;

export interface QualificationManifest {
  schemaVersion: 1;
  network: "arc-mainnet";
  chainId: 5042;
  rpcUrl: string;
  signerAddress: Address;
  recipientAddress: Address;
  usdcAddress: Address;
  unsafeHumanId: string;
  fixedHumanId: string;
  unsafeIntentId: Hex;
  fixedIntentId: Hex;
  amountUsdc6: string;
  maxFeePerGasWei: string;
  maximumGasNative18: string;
  maximumPrincipalUsdc6: string;
  maximumTotalNative18: string;
  walletFloorUsdc6: string;
  artifactHashes: { unsafe: Hex; fixed: Hex };
  recipientBalanceAtPlanUsdc6: string;
  signerNativeBalanceAtPlan18: string;
  signerErc20BalanceAtPlanUsdc6: string;
  quotedGasPriceWei: string;
  deploymentGasEstimates: { unsafe: string; fixed: string };
  steps: Array<{ id: MainnetStepId; kind: MainnetStepKind; gasLimit: string; maxGasCostNative18: string; principalUsdc6: string }>;
}

export interface JournalStep {
  id: MainnetStepId;
  status: "prepared" | "confirmed";
  hash: Hex;
  nonce: number;
  to?: Address;
  data: Hex;
  gasLimit: string;
  maxFeePerGasWei: string;
  expectedRecipientBeforeUsdc6?: string;
  receipt?: {
    status: "success" | "reverted";
    blockNumber: string;
    blockHash: Hex;
    gasUsed: string;
    effectiveGasPrice: string;
    gasCostNative18: string;
    contractAddress?: Address;
    settlementEventCount: number;
    settlementAmountUsdc6: string;
    usdcTransferCount: number;
    recipientAfterUsdc6?: string;
  };
}

export interface QualificationJournal {
  schemaVersion: 1;
  network: "arc-mainnet";
  manifestDigest: Hex;
  steps: JournalStep[];
  status: "incomplete" | "complete";
}

export function assertValidAddress(value: string | undefined, label: string): asserts value is Address {
  if (!value || !/^0x[0-9a-fA-F]{40}$/.test(value) || /^0x0{40}$/i.test(value)) {
    throw new Error(`${label} must be a non-zero 20-byte EVM public address`);
  }
}

export function assertRoles(signer: string | undefined, recipient: string | undefined): asserts signer is Address {
  assertValidAddress(signer, "SAZUME_MAINNET_PUBLIC_ADDRESS");
  assertValidAddress(recipient, "SAZUME_MAINNET_RECIPIENT_ADDRESS");
  if (signer.toLowerCase() === recipient.toLowerCase()) throw new Error("Mainnet signer and recipient must be different addresses");
}

export function assertFunding(native18: bigint, erc20Usdc6: bigint): void {
  const budget = calculateArcMainnetBudget();
  // Both reads show the same USDC asset with different precision; never sum them.
  if (native18 < budget.recommendedWalletFloorUsdc6 * 1_000_000_000_000n
    || erc20Usdc6 < budget.recommendedWalletFloorUsdc6) {
    const shortfallNative18 = budget.recommendedWalletFloorUsdc6 * 1_000_000_000_000n - native18;
    const shortfallUsdc6 = budget.recommendedWalletFloorUsdc6 - erc20Usdc6;
    throw new Error(`Mainnet wallet below 0.150000 USDC floor; native18 shortfall=${shortfallNative18 > 0n ? shortfallNative18 : 0n}, ERC20 USDC6 shortfall=${shortfallUsdc6 > 0n ? shortfallUsdc6 : 0n}`);
  }
}

export function assertFeeQuote(baseFeePerGas: bigint | null, gasPrice: bigint): void {
  if (baseFeePerGas === null || baseFeePerGas > ARC_MAINNET_MAX_FEE_PER_GAS_WEI
    || gasPrice > ARC_MAINNET_MAX_FEE_PER_GAS_WEI || gasPrice < 20_000_000_000n) {
    throw new Error("Mainnet fee quote is missing, above the 40 Gwei cap, or below Arc's 20 Gwei floor");
  }
}

export function assertStepBudget(
  journal: QualificationJournal,
  next: MainnetStep,
  estimateGas: bigint | undefined,
): void {
  const budget = calculateArcMainnetBudget();
  const expectedIndex = journal.steps.length;
  if (expectedIndex >= MAINNET_STEPS.length || MAINNET_STEPS[expectedIndex]?.id !== next.id) {
    throw new Error("Mainnet step is out of order or eight-attempt limit is exhausted");
  }
  if (estimateGas !== undefined && estimateGas > next.gasLimit) throw new Error(`${next.id} gas estimate exceeds its hard transaction limit`);
  if (journal.steps.some((step) => step.status !== "confirmed")) throw new Error("Previous Mainnet transaction is unresolved; no automatic retry");
  const actualGas = journal.steps.reduce((sum, step) => sum + BigInt(step.receipt?.gasCostNative18 ?? "0"), 0n);
  const remainingMaxGas = MAINNET_STEPS.slice(expectedIndex).reduce((sum, step) => sum + step.gasLimit * ARC_MAINNET_MAX_FEE_PER_GAS_WEI, 0n);
  const actualPrincipal = journal.steps.reduce((sum, step) => sum + (step.receipt?.status === "success" ? MAINNET_STEPS.find((item) => item.id === step.id)?.principalUsdc6 ?? 0n : 0n), 0n);
  const remainingPrincipal = MAINNET_STEPS.slice(expectedIndex).reduce((sum, step) => sum + step.principalUsdc6, 0n);
  if (actualPrincipal + remainingPrincipal > ARC_MAINNET_PRINCIPAL_USDC6
    || actualGas + remainingMaxGas > budget.maximumGasCostNative18
    || actualGas + remainingMaxGas + (actualPrincipal + remainingPrincipal) * 1_000_000_000_000n > budget.maximumTotalExposureUsdc6 * 1_000_000_000_000n) {
    throw new Error("Mainnet cumulative principal, gas, or total exposure would exceed the approved ceiling");
  }
}

export function assertSettlementEvidence(input: {
  expectedSuccess: boolean;
  receiptStatus: "success" | "reverted";
  eventCount: number;
  eventAmountUsdc6: bigint;
  transferCount: number;
  transferAmountUsdc6: bigint;
  recipientBeforeUsdc6: bigint;
  recipientAfterUsdc6: bigint;
  expectedAmountUsdc6: bigint;
}): void {
  const expectedCount = input.expectedSuccess ? 1 : 0;
  const expectedAmount = input.expectedSuccess ? input.expectedAmountUsdc6 : 0n;
  if ((input.receiptStatus === "success") !== input.expectedSuccess
    || input.eventCount !== expectedCount || input.transferCount !== expectedCount
    || input.eventAmountUsdc6 !== expectedAmount || input.transferAmountUsdc6 !== expectedAmount
    || input.recipientAfterUsdc6 - input.recipientBeforeUsdc6 !== expectedAmount) {
    throw new Error("OBSERVER INCONSISTENCY: receipt, settlement event, USDC transfer, or recipient balance delta disagree");
  }
}

export function assertJournalManifest(journal: QualificationJournal, digest: Hex): void {
  if (journal.schemaVersion !== 1 || journal.network !== "arc-mainnet" || journal.manifestDigest.toLowerCase() !== digest.toLowerCase()) {
    throw new Error("Existing Mainnet journal does not match the approved manifest; refusing recovery");
  }
  if (journal.steps.length > MAINNET_STEPS.length || journal.steps.some((step, index) => step.id !== MAINNET_STEPS[index]?.id)) {
    throw new Error("Existing Mainnet journal has an unexpected transaction sequence");
  }
}
