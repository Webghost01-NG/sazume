# Contributing to Sazume

Sazume is an economic reliability testing framework. Contributions should preserve the distinction between transaction execution and economic outcome; avoid adding chain-specific logic to `packages/core`.

## Before opening a change

1. Create a focused branch from the current `main`.
2. Keep product changes scoped and document observable behavior.
3. Run `npm ci`, `npm test`, `npm run typecheck`, `npm run build`, `npm run test:contracts`, and `npm run test:external-consumer` when relevant.
4. Never include `.env`, signing keys, RPC credentials, or private wallet data. Normal CI must not need wallet credentials.
5. For economic behavior, add a regression test that derives the verdict from observed state.

Pull requests should explain the economic behavior changed, tests run, and any network-specific assumptions. UI changes should include screenshots at desktop and mobile sizes and preserve the monochrome accessible interface.
