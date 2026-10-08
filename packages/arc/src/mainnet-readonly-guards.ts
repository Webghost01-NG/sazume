export const ARC_MAINNET_READ_RPC_ENDPOINTS = [
  "https://rpc.mainnet.arc.io",
  "https://rpc.blockdaemon.mainnet.arc.io",
  "https://rpc.drpc.mainnet.arc.io",
  "https://rpc.quicknode.mainnet.arc.io",
] as const;

export function assertOfficialArcMainnetReadEndpoint(value: string): asserts value is typeof ARC_MAINNET_READ_RPC_ENDPOINTS[number] {
  if (!ARC_MAINNET_READ_RPC_ENDPOINTS.some((allowed) => allowed === value)) {
    throw new Error("Read-only Mainnet preflight only accepts an exact, currently documented Arc RPC endpoint URL");
  }
}

export function assertArcMainnetReadChainId(actualChainId: number): void {
  if (actualChainId !== 5_042) throw new Error(`ABORT: read-only RPC returned chain ID ${actualChainId}; expected 5042`);
}
