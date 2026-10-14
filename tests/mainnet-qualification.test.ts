import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { keccak256, toHex } from "viem";
import {
  MAINNET_STEPS, assertFeeQuote, assertFunding, assertJournalManifest,
  assertRoles, assertSettlementEvidence, assertStepBudget,
  type QualificationJournal,
} from "../packages/arc/src/mainnet-qualification-model.js";

const signer = "0x1111111111111111111111111111111111111111";
const recipient = "0x2222222222222222222222222222222222222222";
const digest = `0x${"a".repeat(64)}` as const;
const emptyJournal = (): QualificationJournal => ({ schemaVersion: 1, network: "arc-mainnet", manifestDigest: digest, steps: [], status: "incomplete" });

describe("Arc Mainnet qualification stop gates", () => {
  it("rejects zero, malformed and duplicate signer/recipient roles", () => {
    expect(() => assertRoles("0x0000000000000000000000000000000000000000", recipient)).toThrow();
    expect(() => assertRoles(signer, "wrong")).toThrow();
    expect(() => assertRoles(signer, signer)).toThrow();
    expect(() => assertRoles(signer, recipient)).not.toThrow();
  });

  it("rejects insufficient native18 or ERC-20 USDC6 funding without double-counting views", () => {
    expect(() => assertFunding(149_999_999_999_999_999n, 150_000n)).toThrow(/floor/);
    expect(() => assertFunding(150_000_000_000_000_000n, 149_999n)).toThrow(/floor/);
    expect(() => assertFunding(150_000_000_000_000_000n, 150_000n)).not.toThrow();
  });

  it("rejects gas spikes and invalid Arc fee quotes", () => {
    expect(() => assertFeeQuote(null, 20_000_000_000n)).toThrow();
    expect(() => assertFeeQuote(41_000_000_000n, 41_000_000_000n)).toThrow();
    expect(() => assertFeeQuote(20_000_000_000n, 19_000_000_000n)).toThrow();
    expect(() => assertFeeQuote(20_000_000_000n, 20_000_000_000n)).not.toThrow();
    expect(() => assertStepBudget(emptyJournal(), MAINNET_STEPS[0]!, MAINNET_STEPS[0]!.gasLimit + 1n)).toThrow(/estimate/);
  });

  it("enforces the eight-attempt order and rejects unresolved broadcasts", () => {
    expect(() => assertStepBudget(emptyJournal(), MAINNET_STEPS[1]!, 1n)).toThrow(/out of order/);
    const journal = emptyJournal();
    journal.steps.push({ id: "unsafeDeployment", status: "prepared", hash: digest, nonce: 0, data: "0x", gasLimit: "600000", maxFeePerGasWei: "40000000000" });
    expect(() => assertStepBudget(journal, MAINNET_STEPS[1]!, 1n)).toThrow(/unresolved/);
  });

  it("rejects failed receipts, missing events and event/balance disagreement", () => {
    const good = { expectedSuccess: true, receiptStatus: "success" as const, eventCount: 1, eventAmountUsdc6: 10_000n,
      transferCount: 1, transferAmountUsdc6: 10_000n, recipientBeforeUsdc6: 100n,
      recipientAfterUsdc6: 10_100n, expectedAmountUsdc6: 10_000n };
    expect(() => assertSettlementEvidence(good)).not.toThrow();
    expect(() => assertSettlementEvidence({ ...good, receiptStatus: "reverted" })).toThrow(/OBSERVER INCONSISTENCY/);
    expect(() => assertSettlementEvidence({ ...good, eventCount: 0 })).toThrow(/OBSERVER INCONSISTENCY/);
    expect(() => assertSettlementEvidence({ ...good, recipientAfterUsdc6: 100n })).toThrow(/OBSERVER INCONSISTENCY/);
    expect(() => assertSettlementEvidence({ ...good, transferAmountUsdc6: 0n })).toThrow(/OBSERVER INCONSISTENCY/);
    expect(() => assertSettlementEvidence({ ...good, expectedSuccess: false, receiptStatus: "reverted", eventCount: 0,
      eventAmountUsdc6: 0n, transferCount: 0, transferAmountUsdc6: 0n, recipientAfterUsdc6: 100n })).not.toThrow();
  });

  it("refuses recovery under a different manifest or altered transaction order", () => {
    expect(() => assertJournalManifest(emptyJournal(), digest)).not.toThrow();
    expect(() => assertJournalManifest(emptyJournal(), `0x${"b".repeat(64)}`)).toThrow(/does not match/);
    const journal = emptyJournal();
    journal.steps.push({ id: "unsafeSettlementRetry", status: "confirmed", hash: digest, nonce: 0, data: "0x", gasLimit: "1", maxFeePerGasWei: "1" });
    expect(() => assertJournalManifest(journal, digest)).toThrow(/unexpected transaction sequence/);
  });

  it("refuses execution before any RPC or signing when exact manifest approval is absent", () => {
    const directory = mkdtempSync(join(tmpdir(), "sazume-mainnet-gate-"));
    try {
      const manifest = { network: "arc-mainnet", chainId: 5042, usdcAddress: "0x3600000000000000000000000000000000000000" };
      const path = join(directory, "plan.json");
      writeFileSync(path, JSON.stringify({ manifest, digest: keccak256(toHex(JSON.stringify(manifest))) }));
      const result = spawnSync(process.execPath, ["--import", "tsx", "packages/arc/src/mainnet-qualification.ts", "--execute", "--manifest", path], {
        cwd: process.cwd(), encoding: "utf8", env: { PATH: process.env.PATH ?? "", SAZUME_MAINNET_CHAIN_ID: "5042" }, timeout: 15_000,
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Broadcast disabled");
      expect(result.stdout).toBe("");
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
