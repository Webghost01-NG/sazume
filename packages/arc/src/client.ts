import { createPublicClient, createWalletClient, defineChain, http, type Account, type Chain, type Transport } from "viem";
import type { ArcConfig } from "./config.js";

export function arcChain(config: ArcConfig): Chain {
  return defineChain({
    id: config.chainId,
    name: config.chainId === 5_042 ? "Arc" : "Arc Testnet",
    nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
    rpcUrls: { default: { http: [config.rpcUrl] } },
  });
}

export function createArcClients(config: ArcConfig, account?: Account) {
  const chain = arcChain(config);
  const transport = http(config.rpcUrl);
  return {
    chain,
    publicClient: createPublicClient({ chain, transport }),
    ...(account ? { walletClient: createWalletClient({ account, chain, transport }) } : {}),
  };
}

export type { Account, Transport };
