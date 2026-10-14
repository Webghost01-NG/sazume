import unsafe from "../../../../evidence/mainnet/hero-unsafe/run.json";
import fixed from "../../../../evidence/mainnet/hero-fixed/run.json";
import verification from "../../../../evidence/mainnet/independent-verification.json";

const runs = [unsafe, fixed] as const;
const settlementSteps = new Set(["unsafeSettlementFirst", "unsafeSettlementRetry", "idempotentSettlementFirst", "idempotentDuplicateRevert"]);

function assertRecord(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`Mainnet evidence inconsistency: ${message}`);
}

for (const run of runs) {
  assertRecord(run.network === "arc-mainnet" && run.chainId === 5042, "network or chain ID");
  assertRecord(run.manifestDigest === verification.manifestDigest, "manifest digest");
  assertRecord(run.payerAddress === verification.signer && run.recipientAddress === verification.recipient, "participants");
  assertRecord(run.transactions.length === 2, "hero attempt count");
  assertRecord(run.trace.every((entry) => entry.intentId === run.intentId), "retry intent identity");
  assertRecord(run.invariants.every((entry) => entry.passed) === run.passed, "invariant verdict");

  const observed = run.transactions.map((transaction) => {
    assertRecord(settlementSteps.has(transaction.id), "unexpected transaction step");
    const independentlyChecked = verification.transactions.find((entry) => entry.step === transaction.id);
    assertRecord(Boolean(independentlyChecked), "missing independent receipt");
    assertRecord(transaction.hash === independentlyChecked!.hash && transaction.status === independentlyChecked!.status, "receipt status or hash");
    assertRecord(transaction.explorer === independentlyChecked!.explorer, "explorer link");
    assertRecord(transaction.settlementEventCount === independentlyChecked!.settlementEvents, "settlement events");
    assertRecord(transaction.usdcTransferCount === independentlyChecked!.erc20Transfers, "USDC transfers");
    assertRecord(transaction.settlementAmountUsdc6 === independentlyChecked!.settlementAmountUsdc6, "settlement amount");
    assertRecord(transaction.gasCostNative18 === independentlyChecked!.gasCostNative18, "gas cost");
    return transaction;
  });

  assertRecord(observed.reduce((sum, transaction) => sum + transaction.settlementEventCount, 0) === run.settlement.count, "settlement count");
  assertRecord(observed.reduce((sum, transaction) => sum + BigInt(transaction.settlementAmountUsdc6), 0n) === BigInt(run.settlement.totalAmountUsdc6), "settlement total");
  assertRecord(BigInt(observed.at(-1)!.recipientAfterUsdc6) - BigInt(observed[0]!.recipientBeforeUsdc6) === BigInt(run.recipientDeltaUsdc6), "recipient delta");
  assertRecord(BigInt(run.recipientDeltaUsdc6) === BigInt(run.settlement.totalAmountUsdc6), "balance and events disagree");
}

assertRecord(unsafe.contractAddress === verification.contracts.unsafeDeployment, "unsafe contract");
assertRecord(fixed.contractAddress === verification.contracts.idempotentDeployment, "idempotent contract");
assertRecord(BigInt(unsafe.recipientDeltaUsdc6) + BigInt(fixed.recipientDeltaUsdc6) === BigInt(verification.recipientDeltaUsdc6), "aggregate recipient delta");
assertRecord(verification.transactions.every((entry) => entry.explorer === `https://explorer.arc.io/tx/${entry.hash}`), "explorer URL");

export const mainnetQualification = { unsafe, fixed, verification };
export type MainnetHeroRun = typeof unsafe | typeof fixed;
