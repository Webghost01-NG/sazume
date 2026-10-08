export interface ArcConfig {
  rpcUrl: string;
  chainId: number;
  usdcAddress: `0x${string}`;
  settlementAddress: `0x${string}`;
}

function address(name: string, value: string | undefined): `0x${string}` {
  if (!value || !/^0x[0-9a-fA-F]{40}$/.test(value)) throw new Error(`${name} must be configured as a 20-byte EVM address`);
  return value as `0x${string}`;
}

export const arcConfigFromEnv = (env: NodeJS.ProcessEnv = process.env): ArcConfig => {
  const chainId = Number(env.ARC_CHAIN_ID ?? "5042002");
  if (chainId === 5_042) throw new Error("MAINNET EXECUTION DISABLED DURING PHASE 6.5");
  if (chainId !== 5_042_002) throw new Error("ARC_CHAIN_ID must be Arc testnet (5042002) during Phase 6.5");
  return {
    rpcUrl: env.ARC_RPC_URL ?? "https://rpc.testnet.arc.io",
    chainId,
    usdcAddress: address("ARC_USDC_ADDRESS", env.ARC_USDC_ADDRESS),
    settlementAddress: address("SAZUME_SETTLEMENT_ADDRESS", env.SAZUME_SETTLEMENT_ADDRESS),
  };
};
