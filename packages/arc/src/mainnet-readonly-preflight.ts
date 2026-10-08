import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createPublicClient,
  defineChain,
  encodeFunctionData,
  http,
  parseAbi,
  type Address,
  type Hex,
} from "viem";
import { ARC_MAINNET_GAS_LIMITS, calculateArcMainnetBudget } from "./mainnet-budget.js";
import { ARC_MAINNET_READ_RPC_ENDPOINTS, assertArcMainnetReadChainId, assertOfficialArcMainnetReadEndpoint } from "./mainnet-readonly-guards.js";

const CHAIN_ID = 5_042;
const USDC = "0x3600000000000000000000000000000000000000" as Address;
const SYNTHETIC_ESTIMATE_CALLER = "0x000000000000000000000000000000000000dEaD" as Address;
const endpoint = process.env.ARC_MAINNET_READ_RPC_URL ?? ARC_MAINNET_READ_RPC_ENDPOINTS[0];
const publicAddress = process.env.SAZUME_MAINNET_PUBLIC_ADDRESS;
const chain = defineChain({
  id: CHAIN_ID,
  name: "Arc Mainnet (read-only preflight)",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [endpoint] } },
});
const publicClient = createPublicClient({ chain, transport: http(endpoint, { timeout: 15_000 }) });
const erc20Abi = parseAbi([
  "function decimals() view returns (uint8)",
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

function parsePublicAddress(value: string | undefined): Address | undefined {
  if (value === undefined || value === "") return undefined;
  if (!/^0x[0-9a-fA-F]{40}$/.test(value) || /^0x0{40}$/i.test(value)) {
    throw new Error("SAZUME_MAINNET_PUBLIC_ADDRESS must be a non-zero public EVM address");
  }
  return value as Address;
}

function artifactBytecode(artifact: { bytecode?: { object?: string } }, label: string): Hex {
  const bytecode = artifact.bytecode?.object;
  if (!bytecode || !/^0x[0-9a-fA-F]+$/.test(bytecode)) throw new Error(`Missing compiled ${label} creation bytecode; run npm run preflight:arc-mainnet`);
  return bytecode as Hex;
}

async function readArtifact(path: string): Promise<{ bytecode?: { object?: string } }> {
  return JSON.parse(await readFile(resolve(path), "utf8")) as { bytecode?: { object?: string } };
}

async function main(): Promise<void> {
  assertOfficialArcMainnetReadEndpoint(endpoint);
  const signerAddress = parsePublicAddress(publicAddress);

  // The first and all later methods below are read-only JSON-RPC calls.
  const actualChainId = await publicClient.getChainId();
  assertArcMainnetReadChainId(actualChainId);

  const [block, gasPriceWei, usdcDecimals, usdcCode] = await Promise.all([
    publicClient.getBlock({ blockTag: "latest" }),
    publicClient.getGasPrice(),
    publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "decimals" }),
    publicClient.getCode({ address: USDC }),
  ]);
  if (usdcDecimals !== 6) throw new Error(`ABORT: Arc USDC ERC-20 decimals returned ${usdcDecimals}; expected 6`);
  if (!usdcCode || usdcCode === "0x") throw new Error("ABORT: configured Arc USDC address has no deployed bytecode");
  if (block.baseFeePerGas === null) throw new Error("ABORT: latest Arc block omitted baseFeePerGas; cannot validate proposed fee cap");

  const [unsafeArtifact, fixedArtifact] = await Promise.all([
    readArtifact("contracts/out/UnsafeSettlement.sol/UnsafeSettlement.json"),
    readArtifact("contracts/out/IdempotentSettlement.sol/IdempotentSettlement.json"),
  ]);
  const constructorArgument = USDC.slice(2).toLowerCase().padStart(64, "0");
  const unsafeCreationData = `${artifactBytecode(unsafeArtifact, "UnsafeSettlement")}${constructorArgument}` as Hex;
  const fixedCreationData = `${artifactBytecode(fixedArtifact, "IdempotentSettlement")}${constructorArgument}` as Hex;
  const approveUnsafeData = encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: ["0x0000000000000000000000000000000000000001", 20_000n] });
  const approveFixedData = encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: ["0x0000000000000000000000000000000000000002", 10_000n] });
  const [unsafeDeploymentGas, fixedDeploymentGas, unsafeApprovalGas, fixedApprovalGas] = await Promise.all([
    publicClient.estimateGas({ account: SYNTHETIC_ESTIMATE_CALLER, data: unsafeCreationData }),
    publicClient.estimateGas({ account: SYNTHETIC_ESTIMATE_CALLER, data: fixedCreationData }),
    publicClient.estimateGas({ account: SYNTHETIC_ESTIMATE_CALLER, to: USDC, data: approveUnsafeData }),
    publicClient.estimateGas({ account: SYNTHETIC_ESTIMATE_CALLER, to: USDC, data: approveFixedData }),
  ]);

  const wallet = signerAddress ? await (async () => {
    const [nativeBalanceUsdc18, erc20BalanceUsdc6] = await Promise.all([
      publicClient.getBalance({ address: signerAddress }),
      publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [signerAddress] }),
    ]);
    return { publicAddress: signerAddress, nativeBalanceUsdc18: nativeBalanceUsdc18.toString(), erc20BalanceUsdc6: erc20BalanceUsdc6.toString() };
  })() : null;
  const budget = calculateArcMainnetBudget();
  const capUsdc6 = budget.maximumTotalExposureUsdc6;
  const budgetUsdc = (value: bigint) => `${value / 1_000_000n}.${(value % 1_000_000n).toString().padStart(6, "0")}`;
  const signerFundingReady = wallet !== null
    && BigInt(wallet.nativeBalanceUsdc18) >= budget.maximumGasCostNative18
    && BigInt(wallet.erc20BalanceUsdc6) >= budget.principalUsdc6
    && BigInt(wallet.erc20BalanceUsdc6) >= budget.recommendedWalletFloorUsdc6;

  const result = {
    mode: "read-only; no wallet client, signing, or transaction submission code loaded",
    network: { name: "Arc Mainnet", chainId: actualChainId, rpcUrl: endpoint },
    observedAt: new Date().toISOString(),
    latestBlock: { number: block.number?.toString(), hash: block.hash, timestamp: block.timestamp?.toString(), baseFeePerGasWei: block.baseFeePerGas.toString() },
    feeQuote: {
      gasPriceWei: gasPriceWei.toString(),
      proposedMaxFeePerGasWei: budget.maxFeePerGasWei.toString(),
      withinProposedFeeCap: block.baseFeePerGas <= budget.maxFeePerGasWei && gasPriceWei <= budget.maxFeePerGasWei,
    },
    usdc: { address: USDC, erc20Decimals: usdcDecimals, codeBytes: (usdcCode.length - 2) / 2, nativeDecimals: 18, sameUnderlyingBalanceViews: true },
    rpcGasEstimates: {
      basis: "Current Mainnet eth_estimateGas using compiled fixture initcode and synthetic non-signing caller; approvals target the live USDC system contract and fixed-size allowances.",
      unsafeDeployment: unsafeDeploymentGas.toString(),
      idempotentDeployment: fixedDeploymentGas.toString(),
      unsafeApproval: unsafeApprovalGas.toString(),
      idempotentApproval: fixedApprovalGas.toString(),
      settlementCalls: "not estimable against the fixture until deployed; bounded by the per-transaction gas limits below; Testnet receipts are diagnostic proxies only",
    },
    proposedExecutionLimits: {
      transactionCount: budget.transactionCount,
      gasLimits: Object.fromEntries(Object.entries(ARC_MAINNET_GAS_LIMITS).map(([name, gasLimit]) => [name, gasLimit.toString()])),
      maximumFeePerGasWei: budget.maxFeePerGasWei.toString(),
      maximumGasCostNative18: budget.maximumGasCostNative18.toString(),
      maximumGasCostUsdc6: budget.maximumGasCostUsdc6.toString(),
      principalUsdc6: budget.principalUsdc6.toString(),
      qualificationAmountUsdc6: budget.qualificationAmountUsdc6.toString(),
      exactAllowancesUsdc6: { unsafe: budget.unsafeAllowanceUsdc6.toString(), idempotent: budget.idempotentAllowanceUsdc6.toString() },
      maximumTotalExposureUsdc6: capUsdc6.toString(),
      maximumTotalExposureUsdc: budgetUsdc(capUsdc6),
      recommendedMinimumFundingUsdc: budgetUsdc(budget.recommendedWalletFloorUsdc6),
      walletFundingStatus: wallet ? (signerFundingReady ? "meets proposed funding floor" : "below proposed funding floor") : "blocked: SAZUME_MAINNET_PUBLIC_ADDRESS is not configured",
    },
    signer: wallet,
    broadcastAuthorized: false,
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.feeQuote.withinProposedFeeCap || !signerFundingReady) process.exitCode = 1;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unexpected preflight error";
  console.error(`READ-ONLY PREFLIGHT FAILED: ${message}`);
  process.exitCode = 1;
});
