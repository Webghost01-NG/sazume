#!/usr/bin/env node
/** Arc Mainnet fixture qualification. Planning is read-only; execution needs an exact manifest digest. */
import { randomBytes } from "node:crypto";
import { mkdir, open, readFile, rename } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  createPublicClient, createWalletClient, decodeEventLog, defineChain, encodeFunctionData,
  http, keccak256, parseAbi, parseAbiItem, toHex,
  type Address, type Hex, type PublicClient, type TransactionReceipt,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { defineIntent } from "../../core/src/intent.js";
import { completionConsistency, fulfillmentUniqueness, recipientAmount, settlementUniqueness } from "../../core/src/invariant.js";
import { sazume, type ScenarioResult } from "../../core/src/runner.js";
import type { EconomicAdapter } from "../../core/src/adapter.js";
import type { EconomicIntent } from "../../core/src/intent.js";
import type { EconomicOutcome, FulfillmentResult, SettlementResult } from "../../core/src/outcome.js";
import { timeoutAfterSettlement } from "../../cli/src/scenarios/timeout-after-settlement.js";
import {
  ARC_MAINNET_MAX_FEE_PER_GAS_WEI, ARC_MAINNET_QUALIFICATION_AMOUNT_USDC6,
  calculateArcMainnetBudget,
} from "./mainnet-budget.js";
import { ARC_MAINNET_READ_RPC_ENDPOINTS, assertArcMainnetReadChainId, assertOfficialArcMainnetReadEndpoint } from "./mainnet-readonly-guards.js";
import { assertArcMainnetWritePlan } from "./preflight.js";
import {
  MAINNET_STEPS, assertFeeQuote, assertFunding, assertJournalManifest, assertRoles,
  assertSettlementEvidence, assertStepBudget, assertValidAddress,
  type JournalStep, type MainnetStep, type MainnetStepId, type QualificationJournal, type QualificationManifest,
} from "./mainnet-qualification-model.js";

const CHAIN_ID = 5_042;
const USDC = "0x3600000000000000000000000000000000000000" as Address;
const NATIVE_TRANSFER_EMITTER = "0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE" as Address;
const DEFAULT_RPC = ARC_MAINNET_READ_RPC_ENDPOINTS[0];
function assertConfiguredChain(): void {
  const configured = process.env.SAZUME_MAINNET_CHAIN_ID;
  if (configured !== undefined && configured !== String(CHAIN_ID)) {
    throw new Error(`SAZUME_MAINNET_CHAIN_ID must be ${CHAIN_ID}; no transaction sent`);
  }
}
const erc20Abi = parseAbi([
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
]);
const settlementAbi = parseAbi([
  "function settle(bytes32,address,uint256)",
  "function settled(bytes32) view returns (bool)",
  "function usdc() view returns (address)",
  "error IntentAlreadySettled(bytes32)",
]);
const intentSettled = parseAbiItem("event IntentSettled(bytes32 indexed intentId,address indexed payer,address indexed recipient,uint256 amount)");
const usdcTransfer = parseAbiItem("event Transfer(address indexed from,address indexed to,uint256 value)");

interface Artifact {
  bytecode: { object: Hex };
  deployedBytecode: { object: Hex; immutableReferences: Record<string, Array<{ start: number; length: number }>> };
}
interface ManifestFile { manifest: QualificationManifest; digest: Hex }

function stringify(value: unknown): string { return JSON.stringify(value, null, 2) + "\n"; }
function manifestDigest(manifest: QualificationManifest): Hex { return keccak256(toHex(JSON.stringify(manifest))); }
function formatUsdc6(value: bigint): string { return `${value / 1_000_000n}.${(value % 1_000_000n).toString().padStart(6, "0")}`; }

function signerFromEnvironment(): ReturnType<typeof privateKeyToAccount> {
  const privateKey = process.env.SAZUME_MAINNET_PRIVATE_KEY;
  if (!privateKey || !/^(?:0x)?[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error("SAZUME_MAINNET_PRIVATE_KEY must be a 32-byte hex private key in the ignored runtime environment file");
  }
  return privateKeyToAccount((privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`) as Hex);
}

function checkSigner(): void {
  const configuredSigner = process.env.SAZUME_MAINNET_PUBLIC_ADDRESS;
  assertValidAddress(configuredSigner, "SAZUME_MAINNET_PUBLIC_ADDRESS");
  const account = signerFromEnvironment();
  if (account.address.toLowerCase() !== configuredSigner.toLowerCase()) {
    throw new Error("Configured public address does not match the locally derived signer address; no transaction sent");
  }
  console.log(`SIGNER CHECK PASSED: ${account.address}. No RPC call, signature, or broadcast occurred.`);
}

async function atomicJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.tmp`;
  const handle = await open(temporary, "wx", 0o600);
  try { await handle.writeFile(stringify(value)); await handle.sync(); }
  finally { await handle.close(); }
  await rename(temporary, path);
  const directory = await open(dirname(path), "r");
  try { await directory.sync(); } finally { await directory.close(); }
}

async function readArtifact(name: "UnsafeSettlement" | "IdempotentSettlement"): Promise<Artifact> {
  const path = resolve(`contracts/out/${name}.sol/${name}.json`);
  const artifact = JSON.parse(await readFile(path, "utf8")) as Artifact;
  if (!/^0x[0-9a-fA-F]+$/.test(artifact.bytecode?.object ?? "")) throw new Error(`Missing compiled ${name} bytecode; run npm run test:contracts`);
  return artifact;
}

function deploymentData(bytecode: Hex): Hex { return `${bytecode}${USDC.slice(2).toLowerCase().padStart(64, "0")}` as Hex; }

function expectedRuntimeCode(artifact: Artifact): Hex {
  const references = Object.values(artifact.deployedBytecode.immutableReferences).flat();
  if (references.length === 0 || references.some((reference) => reference.length !== 32)) {
    throw new Error("Compiled fixture has unexpected immutable USDC reference layout");
  }
  let code = artifact.deployedBytecode.object.slice(2).toLowerCase();
  const value = USDC.slice(2).toLowerCase().padStart(64, "0");
  for (const { start } of references) {
    if (start < 0 || (start + 32) * 2 > code.length) throw new Error("Compiled fixture immutable reference is out of bounds");
    code = code.slice(0, start * 2) + value + code.slice((start + 32) * 2);
  }
  return `0x${code}`;
}

function mainnetClient(rpcUrl: string): PublicClient {
  assertOfficialArcMainnetReadEndpoint(rpcUrl);
  const chain = defineChain({ id: CHAIN_ID, name: "Arc Mainnet", nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } });
  return createPublicClient({ chain, transport: http(rpcUrl, { timeout: 15_000 }) });
}

async function assertNetwork(client: PublicClient): Promise<void> {
  assertArcMainnetReadChainId(await client.getChainId());
  const [code, decimals] = await Promise.all([
    client.getCode({ address: USDC }),
    client.readContract({ address: USDC, abi: erc20Abi, functionName: "decimals" }),
  ]);
  if (!code || code === "0x" || decimals !== 6) throw new Error("ABORT: Mainnet USDC code or six-decimal ERC-20 interface does not match");
}

async function balances(client: PublicClient, signer: Address, recipient: Address) {
  const [native18, erc20Usdc6, recipientUsdc6] = await Promise.all([
    client.getBalance({ address: signer }),
    client.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [signer] }),
    client.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [recipient] }),
  ]);
  return { native18, erc20Usdc6, recipientUsdc6 };
}

async function assertCurrentFees(client: PublicClient): Promise<bigint> {
  const [block, gasPrice] = await Promise.all([client.getBlock({ blockTag: "latest" }), client.getGasPrice()]);
  assertFeeQuote(block.baseFeePerGas, gasPrice);
  return gasPrice;
}

async function createPlan(path: string): Promise<void> {
  assertConfiguredChain();
  const rpcUrl = process.env.SAZUME_MAINNET_RPC_URL ?? DEFAULT_RPC;
  const signer = process.env.SAZUME_MAINNET_PUBLIC_ADDRESS;
  const recipient = process.env.SAZUME_MAINNET_RECIPIENT_ADDRESS;
  assertRoles(signer, recipient);
  assertValidAddress(recipient, "SAZUME_MAINNET_RECIPIENT_ADDRESS");
  const client = mainnetClient(rpcUrl);
  await assertNetwork(client);
  const quotedGasPriceWei = await assertCurrentFees(client);
  const wallet = await balances(client, signer, recipient);
  assertFunding(wallet.native18, wallet.erc20Usdc6);
  const [unsafe, fixed] = await Promise.all([readArtifact("UnsafeSettlement"), readArtifact("IdempotentSettlement")]);
  const [unsafeEstimate, fixedEstimate] = await Promise.all([
    client.estimateGas({ account: signer, data: deploymentData(unsafe.bytecode.object) }),
    client.estimateGas({ account: signer, data: deploymentData(fixed.bytecode.object) }),
  ]);
  if (unsafeEstimate > MAINNET_STEPS[0]!.gasLimit || fixedEstimate > MAINNET_STEPS[1]!.gasLimit) {
    throw new Error("Deployment gas estimate exceeds a hard per-transaction limit");
  }
  const unsafeHumanId = `SAZUME-MAINNET-UNSAFE-${randomBytes(16).toString("hex")}`;
  const fixedHumanId = `SAZUME-MAINNET-FIXED-${randomBytes(16).toString("hex")}`;
  const budget = calculateArcMainnetBudget();
  const manifest: QualificationManifest = {
    schemaVersion: 1, network: "arc-mainnet", chainId: 5042, rpcUrl,
    signerAddress: signer, recipientAddress: recipient, usdcAddress: USDC,
    unsafeHumanId, fixedHumanId,
    unsafeIntentId: `0x${defineIntent({ id: unsafeHumanId, payment: { payer: signer, recipient, asset: { symbol: "USDC", decimals: 6 }, amount: ARC_MAINNET_QUALIFICATION_AMOUNT_USDC6 }, invariants: [] }).intentId}`,
    fixedIntentId: `0x${defineIntent({ id: fixedHumanId, payment: { payer: signer, recipient, asset: { symbol: "USDC", decimals: 6 }, amount: ARC_MAINNET_QUALIFICATION_AMOUNT_USDC6 }, invariants: [] }).intentId}`,
    amountUsdc6: ARC_MAINNET_QUALIFICATION_AMOUNT_USDC6.toString(),
    maxFeePerGasWei: ARC_MAINNET_MAX_FEE_PER_GAS_WEI.toString(),
    maximumGasNative18: budget.maximumGasCostNative18.toString(),
    maximumPrincipalUsdc6: budget.principalUsdc6.toString(),
    maximumTotalNative18: (budget.maximumGasCostNative18 + budget.principalUsdc6 * 1_000_000_000_000n).toString(),
    walletFloorUsdc6: budget.recommendedWalletFloorUsdc6.toString(),
    artifactHashes: { unsafe: keccak256(unsafe.bytecode.object), fixed: keccak256(fixed.bytecode.object) },
    recipientBalanceAtPlanUsdc6: wallet.recipientUsdc6.toString(),
    signerNativeBalanceAtPlan18: wallet.native18.toString(),
    signerErc20BalanceAtPlanUsdc6: wallet.erc20Usdc6.toString(),
    quotedGasPriceWei: quotedGasPriceWei.toString(),
    deploymentGasEstimates: { unsafe: unsafeEstimate.toString(), fixed: fixedEstimate.toString() },
    steps: MAINNET_STEPS.map((step) => ({ id: step.id, kind: step.kind, gasLimit: step.gasLimit.toString(), maxGasCostNative18: (step.gasLimit * ARC_MAINNET_MAX_FEE_PER_GAS_WEI).toString(), principalUsdc6: step.principalUsdc6.toString() })),
  };
  const digest = manifestDigest(manifest);
  await atomicJson(path, { manifest, digest });
  console.log(stringify({ mode: "READ_ONLY_PLAN", manifestPath: path, manifestDigest: digest, signerAddress: signer, recipientAddress: recipient, signerNativeBalance18: wallet.native18.toString(), signerErc20Usdc6: wallet.erc20Usdc6.toString(), walletFloorUsdc6: budget.recommendedWalletFloorUsdc6.toString(), maxPrincipalUsdc6: budget.principalUsdc6.toString(), maxGasNative18: budget.maximumGasCostNative18.toString(), maxTotalUsdc6: budget.maximumTotalExposureUsdc6.toString(), gasPriceWei: quotedGasPriceWei.toString(), deploymentGasEstimates: manifest.deploymentGasEstimates, broadcastAuthorized: false }));
}

class MainnetExecutor {
  private constructor(
    readonly client: PublicClient,
    readonly manifest: QualificationManifest,
    readonly digest: Hex,
    readonly journalPath: string,
    readonly account: ReturnType<typeof privateKeyToAccount>,
    readonly journal: QualificationJournal,
    readonly unsafeBytecode: Hex,
    readonly fixedBytecode: Hex,
    readonly unsafeRuntimeCode: Hex,
    readonly fixedRuntimeCode: Hex,
  ) {}

  static async open(manifestPath: string): Promise<MainnetExecutor> {
    assertConfiguredChain();
    const file = JSON.parse(await readFile(manifestPath, "utf8")) as ManifestFile;
    const { manifest, digest } = file;
    if (manifestDigest(manifest) !== digest || manifest.network !== "arc-mainnet" || manifest.chainId !== CHAIN_ID || manifest.usdcAddress.toLowerCase() !== USDC.toLowerCase()) {
      throw new Error("Mainnet manifest digest, network, or USDC address is invalid");
    }
    assertRoles(manifest.signerAddress, manifest.recipientAddress);
    if (manifest.unsafeHumanId === manifest.fixedHumanId || manifest.unsafeIntentId === manifest.fixedIntentId) {
      throw new Error("Mainnet fixture intents must be distinct across scenarios");
    }
    makeIntent(manifest, "unsafe");
    makeIntent(manifest, "fixed");
    if (process.env.SAZUME_MAINNET_BROADCAST_APPROVAL !== digest) {
      throw new Error(`Broadcast disabled. After separate approval of this exact manifest, set SAZUME_MAINNET_BROADCAST_APPROVAL to its digest ${digest}`);
    }
    const configuredSigner = process.env.SAZUME_MAINNET_PUBLIC_ADDRESS;
    const configuredRecipient = process.env.SAZUME_MAINNET_RECIPIENT_ADDRESS;
    assertRoles(configuredSigner, configuredRecipient);
    assertValidAddress(configuredRecipient, "SAZUME_MAINNET_RECIPIENT_ADDRESS");
    if (configuredSigner.toLowerCase() !== manifest.signerAddress.toLowerCase()
      || configuredRecipient.toLowerCase() !== manifest.recipientAddress.toLowerCase()
      || (process.env.SAZUME_MAINNET_RPC_URL ?? DEFAULT_RPC) !== manifest.rpcUrl) {
      throw new Error("Mainnet signer, recipient or RPC differs from the approved manifest");
    }
    const account = signerFromEnvironment();
    if (account.address.toLowerCase() !== configuredSigner.toLowerCase()) throw new Error("Mainnet signer key resolves to a different public address; no transaction sent");
    const client = mainnetClient(manifest.rpcUrl);
    await assertNetwork(client);
    await assertCurrentFees(client);
    const [unsafe, fixed] = await Promise.all([readArtifact("UnsafeSettlement"), readArtifact("IdempotentSettlement")]);
    if (keccak256(unsafe.bytecode.object) !== manifest.artifactHashes.unsafe || keccak256(fixed.bytecode.object) !== manifest.artifactHashes.fixed) {
      throw new Error("Compiled fixture bytecode differs from the approved manifest");
    }
    const budget = calculateArcMainnetBudget();
    if (manifest.maxFeePerGasWei !== ARC_MAINNET_MAX_FEE_PER_GAS_WEI.toString()
      || manifest.maximumGasNative18 !== budget.maximumGasCostNative18.toString()
      || manifest.maximumPrincipalUsdc6 !== budget.principalUsdc6.toString()
      || manifest.maximumTotalNative18 !== (budget.maximumGasCostNative18 + budget.principalUsdc6 * 1_000_000_000_000n).toString()
      || manifest.walletFloorUsdc6 !== budget.recommendedWalletFloorUsdc6.toString()
      || manifest.amountUsdc6 !== ARC_MAINNET_QUALIFICATION_AMOUNT_USDC6.toString()
      || manifest.steps.length !== MAINNET_STEPS.length
      || manifest.steps.some((step, index) => {
        const expected = MAINNET_STEPS[index];
        return !expected || step.id !== expected.id || step.kind !== expected.kind
          || step.gasLimit !== expected.gasLimit.toString()
          || step.principalUsdc6 !== expected.principalUsdc6.toString()
          || step.maxGasCostNative18 !== (expected.gasLimit * ARC_MAINNET_MAX_FEE_PER_GAS_WEI).toString();
      })) {
      throw new Error("Approved Mainnet manifest exceeds or changes the compiled spending limits");
    }
    const journalPath = manifestPath.replace(/\.json$/i, "") + ".journal.json";
    let journal: QualificationJournal;
    try { journal = JSON.parse(await readFile(journalPath, "utf8")) as QualificationJournal; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      journal = { schemaVersion: 1, network: "arc-mainnet", manifestDigest: digest, steps: [], status: "incomplete" };
      const current = await balances(client, configuredSigner, configuredRecipient);
      assertFunding(current.native18, current.erc20Usdc6);
      if (current.recipientUsdc6.toString() !== manifest.recipientBalanceAtPlanUsdc6) {
        throw new Error("Recipient balance changed since planning; regenerate and reapprove the manifest");
      }
      await atomicJson(journalPath, journal);
    }
    assertJournalManifest(journal, digest);
    return new MainnetExecutor(client, manifest, digest, journalPath, account, journal,
      unsafe.bytecode.object, fixed.bytecode.object, expectedRuntimeCode(unsafe), expectedRuntimeCode(fixed));
  }

  private deploymentAddress(id: "unsafeDeployment" | "idempotentDeployment"): Address {
    const address = this.journal.steps.find((step) => step.id === id)?.receipt?.contractAddress;
    if (!address) throw new Error(`No verified deployment address for ${id}`);
    return address;
  }

  private stepCall(step: MainnetStep): { to?: Address; data: Hex; expectedRecipientBeforeUsdc6?: bigint } {
    const recipient = this.manifest.recipientAddress;
    const unsafe = step.id.startsWith("unsafe");
    if (step.kind === "deployment") {
      return { data: deploymentData(unsafe ? this.unsafeBytecode : this.fixedBytecode) };
    }
    const contract = this.deploymentAddress(unsafe ? "unsafeDeployment" : "idempotentDeployment");
    if (step.kind === "approval") {
      return { to: USDC, data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [contract, unsafe ? 20_000n : 10_000n] }) };
    }
    const intentId = unsafe ? this.manifest.unsafeIntentId : this.manifest.fixedIntentId;
    const priorBalance = [...this.journal.steps].reverse().find((entry) => entry.receipt?.recipientAfterUsdc6 !== undefined)?.receipt?.recipientAfterUsdc6;
    return {
      to: contract,
      data: encodeFunctionData({ abi: settlementAbi, functionName: "settle", args: [intentId, recipient, ARC_MAINNET_QUALIFICATION_AMOUNT_USDC6] }),
      expectedRecipientBeforeUsdc6: BigInt(priorBalance ?? this.manifest.recipientBalanceAtPlanUsdc6),
    };
  }

  private async currentReadiness(step: MainnetStep): Promise<bigint | undefined> {
    await assertNetwork(this.client);
    await assertCurrentFees(this.client);
    const wallet = await balances(this.client, this.manifest.signerAddress, this.manifest.recipientAddress);
    const remaining = MAINNET_STEPS.slice(this.journal.steps.length);
    const remainingGas = remaining.reduce((sum, item) => sum + item.gasLimit * ARC_MAINNET_MAX_FEE_PER_GAS_WEI, 0n);
    const remainingPrincipal = remaining.reduce((sum, item) => sum + item.principalUsdc6, 0n);
    if (wallet.native18 < remainingGas + remainingPrincipal * 1_000_000_000_000n || wallet.erc20Usdc6 < remainingPrincipal) {
      throw new Error(`Mainnet wallet cannot fund remaining maximum exposure; native18 shortfall=${remainingGas + remainingPrincipal * 1_000_000_000_000n - wallet.native18}, ERC20 USDC6 shortfall=${remainingPrincipal > wallet.erc20Usdc6 ? remainingPrincipal - wallet.erc20Usdc6 : 0n}`);
    }
    if (step.kind === "expected-revert") {
      const alreadySettled = await this.client.readContract({ address: this.deploymentAddress("idempotentDeployment"), abi: settlementAbi, functionName: "settled", args: [this.manifest.fixedIntentId] });
      if (!alreadySettled) throw new Error("Fixed duplicate precondition is false; refusing expected-revert transaction");
      return undefined;
    }
    const call = this.stepCall(step);
    return this.client.estimateGas({ account: this.manifest.signerAddress, to: call.to, data: call.data });
  }

  private async reconcileConfirmed(record: JournalStep): Promise<void> {
    if (!record.receipt) throw new Error(`Confirmed ${record.id} is missing persisted receipt evidence`);
    const receipt = await this.client.getTransactionReceipt({ hash: record.hash });
    if (receipt.status !== record.receipt.status || receipt.blockNumber.toString() !== record.receipt.blockNumber
      || receipt.blockHash !== record.receipt.blockHash || receipt.gasUsed.toString() !== record.receipt.gasUsed
      || receipt.effectiveGasPrice.toString() !== record.receipt.effectiveGasPrice) {
      throw new Error(`Previously confirmed Mainnet receipt changed for ${record.hash}; stop`);
    }
  }

  async ensureStep(id: MainnetStepId): Promise<JournalStep> {
    const step = MAINNET_STEPS.find((item) => item.id === id);
    if (!step) throw new Error(`Unknown Mainnet transaction step ${id}`);
    const existing = this.journal.steps.find((item) => item.id === id);
    if (existing) {
      await assertNetwork(this.client);
      if (existing.status === "confirmed") { await this.reconcileConfirmed(existing); return existing; }
      let receipt: TransactionReceipt;
      try { receipt = await this.client.getTransactionReceipt({ hash: existing.hash }); }
      catch { throw new Error(`UNRESOLVED MAINNET TRANSACTION ${existing.hash}; inspect hash and nonce read-only. Never auto-resubmit.`); }
      await this.confirm(step, existing, receipt);
      return existing;
    }
    const estimateGas = await this.currentReadiness(step);
    assertStepBudget(this.journal, step, estimateGas);
    assertArcMainnetWritePlan({
      explicitOptIn: true, actualChainId: await this.client.getChainId(), rpcUrl: this.manifest.rpcUrl, approvedRpcUrl: this.manifest.rpcUrl,
      selectedSignerAddress: this.account.address, approvedSignerAddress: this.manifest.signerAddress,
      plannedTransactions: MAINNET_STEPS.length, maximumTransactions: 8,
      principalUsdc6: calculateArcMainnetBudget().principalUsdc6, maximumPrincipalUsdc6: calculateArcMainnetBudget().principalUsdc6,
      gasExposureNative18: calculateArcMainnetBudget().maximumGasCostNative18, maximumGasExposureNative18: calculateArcMainnetBudget().maximumGasCostNative18,
      maximumTotalExposureNative18: BigInt(this.manifest.maximumTotalNative18),
    });
    const call = this.stepCall(step);
    if (call.expectedRecipientBeforeUsdc6 !== undefined) {
      const current = await this.client.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [this.manifest.recipientAddress] });
      if (current !== call.expectedRecipientBeforeUsdc6) throw new Error("Recipient balance changed outside the approved scenario; stop before broadcast");
    }
    const nonce = await this.client.getTransactionCount({ address: this.account.address, blockTag: "pending" });
    const wallet = createWalletClient({
      account: this.account,
      chain: defineChain({ id: CHAIN_ID, name: "Arc Mainnet", nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, rpcUrls: { default: { http: [this.manifest.rpcUrl] } } }),
      transport: http(this.manifest.rpcUrl, { timeout: 15_000 }),
    });
    const raw = await wallet.signTransaction({ account: this.account, chain: wallet.chain, type: "eip1559", to: call.to, data: call.data, gas: step.gasLimit, maxFeePerGas: ARC_MAINNET_MAX_FEE_PER_GAS_WEI, maxPriorityFeePerGas: 0n, nonce });
    const hash = keccak256(raw);
    const record: JournalStep = { id, status: "prepared", hash, nonce, ...(call.to ? { to: call.to } : {}), data: call.data, gasLimit: step.gasLimit.toString(), maxFeePerGasWei: ARC_MAINNET_MAX_FEE_PER_GAS_WEI.toString(), ...(call.expectedRecipientBeforeUsdc6 !== undefined ? { expectedRecipientBeforeUsdc6: call.expectedRecipientBeforeUsdc6.toString() } : {}) };
    this.journal.steps.push(record);
    await atomicJson(this.journalPath, this.journal); // hash and nonce durable before any broadcast
    try {
      const returnedHash = await this.client.sendRawTransaction({ serializedTransaction: raw });
      if (returnedHash.toLowerCase() !== hash.toLowerCase()) throw new Error("RPC returned a different hash than the signed transaction");
    } catch (error) {
      throw new Error(`BROADCAST UNCERTAIN for ${hash}; journal preserved. Check chain state before any further action. ${error instanceof Error ? error.message : "RPC error"}`);
    }
    let receipt: TransactionReceipt;
    try { receipt = await this.client.waitForTransactionReceipt({ hash, timeout: 60_000 }); }
    catch { throw new Error(`RECEIPT UNRESOLVED for ${hash}; journal preserved. Never auto-resubmit.`); }
    await this.confirm(step, record, receipt);
    return record;
  }

  private async confirm(step: MainnetStep, record: JournalStep, receipt: TransactionReceipt): Promise<void> {
    if (receipt.transactionHash.toLowerCase() !== record.hash.toLowerCase()
      || receipt.from.toLowerCase() !== this.account.address.toLowerCase()
      || (record.to ? receipt.to?.toLowerCase() !== record.to.toLowerCase() : receipt.to !== null)
      || receipt.gasUsed > step.gasLimit
      || receipt.effectiveGasPrice > ARC_MAINNET_MAX_FEE_PER_GAS_WEI) {
      throw new Error(`ABORT: receipt identity, gas limit or fee cap mismatch for ${record.hash}`);
    }
    const expectedSuccess = step.kind !== "expected-revert";
    if ((receipt.status === "success") !== expectedSuccess) {
      throw new Error(`Unexpected receipt status ${receipt.status} for ${step.id}; hash ${record.hash}`);
    }
    const gasCostNative18 = receipt.gasUsed * receipt.effectiveGasPrice;
    const budget = calculateArcMainnetBudget();
    const otherGas = this.journal.steps.filter((entry) => entry.id !== record.id).reduce((sum, entry) => sum + BigInt(entry.receipt?.gasCostNative18 ?? "0"), 0n);
    if (otherGas + gasCostNative18 > budget.maximumGasCostNative18) throw new Error("Cumulative observed Mainnet gas exceeded the hard cap");
    let contractAddress: Address | undefined;
    let recipientAfterUsdc6: bigint | undefined;
    let settlementEventCount = 0;
    let settlementAmountUsdc6 = 0n;
    let usdcTransferCount = 0;
    if (step.kind === "deployment") {
      if (!receipt.contractAddress) throw new Error(`Deployment ${step.id} has no contract address`);
      contractAddress = receipt.contractAddress;
      const code = await this.client.getCode({ address: contractAddress });
      const expectedCode = step.id === "unsafeDeployment" ? this.unsafeRuntimeCode : this.fixedRuntimeCode;
      if (!code || code.toLowerCase() !== expectedCode.toLowerCase()) {
        throw new Error(`Deployment ${step.id} runtime code differs from the audited compiled fixture`);
      }
      const token = await this.client.readContract({ address: contractAddress, abi: settlementAbi, functionName: "usdc" });
      if (token.toLowerCase() !== USDC.toLowerCase()) throw new Error(`Deployment ${step.id} bound the wrong USDC address`);
    } else if (step.kind === "approval") {
      const spender = this.deploymentAddress(step.id === "unsafeApproval" ? "unsafeDeployment" : "idempotentDeployment");
      const expectedAllowance = step.id === "unsafeApproval" ? 20_000n : 10_000n;
      const allowance = await this.client.readContract({ address: USDC, abi: erc20Abi, functionName: "allowance", args: [this.account.address, spender] });
      if (allowance !== expectedAllowance) throw new Error(`Approval ${step.id} did not produce the exact ${expectedAllowance} USDC6 allowance`);
    } else {
      const contract = this.deploymentAddress(step.id.startsWith("unsafe") ? "unsafeDeployment" : "idempotentDeployment");
      const expectedIntentId = step.id.startsWith("unsafe") ? this.manifest.unsafeIntentId : this.manifest.fixedIntentId;
      let nativeTransferCount = 0;
      let nativeTransferAmount18 = 0n;
      let transferAmountUsdc6 = 0n;
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() === contract.toLowerCase()) {
          try {
            const event = decodeEventLog({ abi: [intentSettled], data: log.data, topics: log.topics });
            if (event.args.intentId.toLowerCase() !== expectedIntentId.toLowerCase()
              || event.args.payer.toLowerCase() !== this.account.address.toLowerCase()
              || event.args.recipient.toLowerCase() !== this.manifest.recipientAddress.toLowerCase()) {
              throw new Error("Settlement event has wrong intent, payer or recipient");
            }
            settlementEventCount++;
            settlementAmountUsdc6 += event.args.amount;
          } catch (error) { if (error instanceof Error && error.message.startsWith("Settlement event")) throw error; }
        }
        if (log.address.toLowerCase() === USDC.toLowerCase() || log.address.toLowerCase() === NATIVE_TRANSFER_EMITTER.toLowerCase()) {
          try {
            const transfer = decodeEventLog({ abi: [usdcTransfer], data: log.data, topics: log.topics });
            if (transfer.args.from.toLowerCase() === this.account.address.toLowerCase()
              && transfer.args.to.toLowerCase() === this.manifest.recipientAddress.toLowerCase()) {
              if (log.address.toLowerCase() === USDC.toLowerCase()) { usdcTransferCount++; transferAmountUsdc6 += transfer.args.value; }
              else { nativeTransferCount++; nativeTransferAmount18 += transfer.args.value; }
            }
          } catch { /* unrelated log */ }
        }
      }
      const before = BigInt(record.expectedRecipientBeforeUsdc6 ?? "-1");
      if (before < 0n) throw new Error("Settlement journal lacks recipient balance baseline");
      recipientAfterUsdc6 = await this.client.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [this.manifest.recipientAddress] });
      assertSettlementEvidence({ expectedSuccess, receiptStatus: receipt.status, eventCount: settlementEventCount,
        eventAmountUsdc6: settlementAmountUsdc6, transferCount: usdcTransferCount,
        transferAmountUsdc6, recipientBeforeUsdc6: before, recipientAfterUsdc6,
        expectedAmountUsdc6: ARC_MAINNET_QUALIFICATION_AMOUNT_USDC6 });
      const expectedNative18 = expectedSuccess ? ARC_MAINNET_QUALIFICATION_AMOUNT_USDC6 * 1_000_000_000_000n : 0n;
      if (nativeTransferCount !== (expectedSuccess ? 1 : 0) || nativeTransferAmount18 !== expectedNative18) {
        throw new Error("OBSERVER INCONSISTENCY: Arc native18 transfer mirror disagrees with ERC-20 USDC6 transfer");
      }
      if (step.kind === "expected-revert") {
        const settled = await this.client.readContract({ address: contract, abi: settlementAbi, functionName: "settled", args: [expectedIntentId] });
        if (!settled || receipt.gasUsed === step.gasLimit) throw new Error("Fixed duplicate did not show the documented idempotent revert path");
      }
    }
    record.receipt = {
      status: receipt.status, blockNumber: receipt.blockNumber.toString(), blockHash: receipt.blockHash,
      gasUsed: receipt.gasUsed.toString(), effectiveGasPrice: receipt.effectiveGasPrice.toString(),
      gasCostNative18: gasCostNative18.toString(),
      ...(contractAddress ? { contractAddress } : {}),
      settlementEventCount, settlementAmountUsdc6: settlementAmountUsdc6.toString(), usdcTransferCount,
      ...(recipientAfterUsdc6 !== undefined ? { recipientAfterUsdc6: recipientAfterUsdc6.toString() } : {}),
    };
    record.status = "confirmed";
    await atomicJson(this.journalPath, this.journal);
  }

  outcomeFor(fixture: "unsafe" | "fixed", intentId: string, fulfillmentCount: number, completed: boolean): EconomicOutcome {
    const relevant = this.journal.steps.filter((step) => step.id === (fixture === "unsafe" ? "unsafeSettlementFirst" : "idempotentSettlementFirst")
      || step.id === (fixture === "unsafe" ? "unsafeSettlementRetry" : "idempotentDuplicateRevert"));
    if (relevant.some((step) => step.status !== "confirmed" || !step.receipt)) throw new Error("Economic outcome requested before all settlement evidence was confirmed");
    return { intentId, settlement: {
      count: relevant.reduce((sum, step) => sum + (step.receipt?.settlementEventCount ?? 0), 0),
      totalAmount: relevant.reduce((sum, step) => sum + BigInt(step.receipt?.settlementAmountUsdc6 ?? "0"), 0n),
    }, fulfillment: { count: fulfillmentCount }, completed };
  }

  async finish(): Promise<void> {
    if (this.journal.steps.length !== MAINNET_STEPS.length || this.journal.steps.some((step) => step.status !== "confirmed")) {
      throw new Error("Cannot mark Mainnet run complete with missing or unresolved attempts");
    }
    this.journal.status = "complete";
    await atomicJson(this.journalPath, this.journal);
  }
}

class MainnetQualificationAdapter implements EconomicAdapter {
  private settlementAttempts = 0;
  private fulfillmentCount = 0;
  private completed = false;
  constructor(private readonly executor: MainnetExecutor, private readonly fixture: "unsafe" | "fixed") {}
  async reset(): Promise<void> { this.settlementAttempts = 0; this.fulfillmentCount = 0; this.completed = false; }
  async settle(_intent: EconomicIntent): Promise<SettlementResult> {
    const steps = this.fixture === "unsafe"
      ? ["unsafeSettlementFirst", "unsafeSettlementRetry"] as const
      : ["idempotentSettlementFirst", "idempotentDuplicateRevert"] as const;
    const id = steps[this.settlementAttempts++];
    if (!id) throw new Error("Mainnet hero exceeded exactly two settlement attempts");
    const record = await this.executor.ensureStep(id);
    return { accepted: record.receipt?.status === "success", amount: record.receipt?.status === "success" ? ARC_MAINNET_QUALIFICATION_AMOUNT_USDC6 : 0n };
  }
  async fulfill(_intent: EconomicIntent): Promise<FulfillmentResult> {
    if (this.fixture === "fixed" && this.fulfillmentCount > 0) return { accepted: false };
    this.fulfillmentCount++;
    return { accepted: true };
  }
  async markComplete(_intent: EconomicIntent): Promise<void> { this.completed = true; }
  async observe(intent: EconomicIntent): Promise<EconomicOutcome> { return this.executor.outcomeFor(this.fixture, intent.intentId, this.fulfillmentCount, this.completed); }
}

function makeIntent(manifest: QualificationManifest, fixture: "unsafe" | "fixed"): EconomicIntent {
  const intent = defineIntent({
    id: fixture === "unsafe" ? manifest.unsafeHumanId : manifest.fixedHumanId,
    payment: { payer: manifest.signerAddress, recipient: manifest.recipientAddress, asset: { symbol: "USDC", decimals: 6 }, amount: ARC_MAINNET_QUALIFICATION_AMOUNT_USDC6 },
    invariants: [settlementUniqueness(), recipientAmount(), fulfillmentUniqueness(), completionConsistency()],
  });
  if (`0x${intent.intentId}` !== (fixture === "unsafe" ? manifest.unsafeIntentId : manifest.fixedIntentId)) {
    throw new Error("Retry economic intent differs from the approved manifest");
  }
  return intent;
}

async function saveHeroEvidence(executor: MainnetExecutor, fixture: "unsafe" | "fixed", result: ScenarioResult): Promise<void> {
  const evidenceDirectory = resolve(`evidence/mainnet/hero-${fixture}`);
  const related = executor.journal.steps.filter((step) => fixture === "unsafe" ? step.id.startsWith("unsafeSettlement") : step.id.startsWith("idempotentSettlement") || step.id === "idempotentDuplicateRevert");
  const evidence = {
    network: "arc-mainnet", chainId: CHAIN_ID, status: "observed", manifestDigest: executor.digest,
    rpcUrl: executor.manifest.rpcUrl, payerAddress: executor.manifest.signerAddress, recipientAddress: executor.manifest.recipientAddress,
    usdcAddress: USDC, contractAddress: executor.journal.steps.find((step) => step.id === (fixture === "unsafe" ? "unsafeDeployment" : "idempotentDeployment"))?.receipt?.contractAddress,
    scenario: result.scenario, intentId: result.outcome.intentId,
    humanId: fixture === "unsafe" ? executor.manifest.unsafeHumanId : executor.manifest.fixedHumanId,
    amountUsdc6: ARC_MAINNET_QUALIFICATION_AMOUNT_USDC6.toString(),
    transactions: related.map((step) => ({ id: step.id, hash: step.hash, nonce: step.nonce,
      recipientBeforeUsdc6: step.expectedRecipientBeforeUsdc6, ...step.receipt,
      explorer: `https://explorer.arc.io/tx/${step.hash}` })),
    settlement: { count: result.outcome.settlement.count, totalAmountUsdc6: result.outcome.settlement.totalAmount.toString() },
    recipientDeltaUsdc6: related.reduce((sum, step) => {
      if (step.expectedRecipientBeforeUsdc6 === undefined || step.receipt?.recipientAfterUsdc6 === undefined) {
        throw new Error(`Missing independent recipient balance evidence for ${step.id}`);
      }
      return sum + BigInt(step.receipt.recipientAfterUsdc6) - BigInt(step.expectedRecipientBeforeUsdc6);
    }, 0n).toString(),
    fulfillmentCount: result.outcome.fulfillment.count, completed: result.outcome.completed,
    invariants: result.invariants, passed: result.passed, trace: result.trace,
    corroboration: "receipt + fixture event + ERC-20 USDC6 transfer + native18 mirror + recipient balance delta",
  };
  await atomicJson(resolve(evidenceDirectory, "run.json"), evidence);
  await mkdir(evidenceDirectory, { recursive: true, mode: 0o700 });
  const lines = [
    `SAZUME ARC MAINNET — ${fixture.toUpperCase()} TIMEOUT AFTER SETTLEMENT`,
    `Intent: ${evidence.humanId} / ${evidence.intentId}`,
    `Payer: ${evidence.payerAddress} Recipient: ${evidence.recipientAddress}`,
    `Settlement attempts: ${related.length}`,
    `Observed settlements: ${result.outcome.settlement.count}`,
    `Recipient amount: ${formatUsdc6(result.outcome.settlement.totalAmount)} USDC`,
    `Fulfillments: ${result.outcome.fulfillment.count}`,
    `Economic verdict: ${result.passed ? "PASS" : "FAIL"}`,
    ...related.map((step) => `${step.id} ${step.hash} ${step.receipt?.status} block=${step.receipt?.blockNumber} gasUsed=${step.receipt?.gasUsed} effectiveGasPrice=${step.receipt?.effectiveGasPrice}`),
  ];
  const handle = await open(resolve(evidenceDirectory, "report.txt"), "w", 0o600);
  try { await handle.writeFile(lines.join("\n") + "\n"); await handle.sync(); }
  finally { await handle.close(); }
}

async function execute(manifestPath: string): Promise<void> {
  const executor = await MainnetExecutor.open(manifestPath);
  for (const id of ["unsafeDeployment", "idempotentDeployment", "unsafeApproval", "idempotentApproval"] as const) {
    await executor.ensureStep(id);
  }
  for (const fixture of ["unsafe", "fixed"] as const) {
    const intent = makeIntent(executor.manifest, fixture);
    const adapter = new MainnetQualificationAdapter(executor, fixture);
    const run = await sazume.run({ intent, adapter, scenarios: [timeoutAfterSettlement()] });
    const result = run.scenarios[0];
    if (!result) throw new Error("Core runner returned no Mainnet hero result");
    await saveHeroEvidence(executor, fixture, result);
    if (result.passed !== (fixture === "fixed")) {
      throw new Error(`MAINNET STOP GATE: ${fixture} hero produced an unexpected economic verdict`);
    }
  }
  await executor.finish();
  await atomicJson(resolve("evidence/mainnet/deployments.json"), {
    network: "arc-mainnet", chainId: CHAIN_ID, manifestDigest: executor.digest,
    usdcAddress: USDC, payerAddress: executor.manifest.signerAddress, recipientAddress: executor.manifest.recipientAddress,
    steps: executor.journal.steps.filter((step) => step.id.endsWith("Deployment") || step.id.endsWith("Approval")),
  });
  console.log("ARC MAINNET QUALIFICATION COMPLETE: unsafe economic FAIL; idempotent economic PASS; receipt/event/transfer/balance evidence saved.");
}

async function main(): Promise<void> {
  const mode = process.argv[2] ?? "--plan";
  const flag = process.argv[3];
  const path = process.argv[4];
  if (mode === "--check-signer" && process.argv.length === 3) return checkSigner();
  if (mode === "--plan" && process.argv.length <= 3) return createPlan(resolve("/tmp/sazume-mainnet-manifest.json"));
  if (mode === "--plan" && flag === "--manifest" && path) return createPlan(resolve(path));
  if (mode === "--execute" && flag === "--manifest" && path) return execute(resolve(path));
  throw new Error("Usage: --check-signer | --plan [--manifest /absolute/path.json] | --execute --manifest /absolute/path.json");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown qualification error";
  console.error(`MAINNET QUALIFICATION STOPPED: ${message}`);
  process.exitCode = 1;
});
