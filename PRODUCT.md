# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary audience, inferred from the explicit developer-product brief: protocol and application engineers building programmable-money payment workflows. They need to test whether retries, timeouts, and duplicate execution preserve one economic obligation. Reviewers and hackathon judges are a secondary audience for the verified replay and its evidence.

## Product Purpose

Sazume tests economic reliability: whether an application preserves its intended monetary outcome when execution and application state diverge. Success means detecting a wrong economic result even when individual blockchain transactions succeed.

## Positioning

The same intent, scenarios, runner, outcome model, and invariants can evaluate unsafe and idempotent implementations through offchain and Solidity-backed adapters. The verdict is derived from observed economic outcome and corroborating evidence rather than transaction success alone.

## Operating Context

The current browser experience replays previously accepted Arc Testnet evidence. It does not make RPC requests or broadcast transactions. The interface configures an implementation and failure scenario, reveals execution progressively, evaluates economic invariants, and then exposes transaction and balance evidence.

## Capabilities and Constraints

- The validated scenarios are normal, timeout before settlement, timeout after settlement, and duplicate callback.
- The economic invariants cover settlement uniqueness, recipient amount, fulfillment uniqueness, and completion consistency.
- The current interface uses evidence from `evidence/testnet/`; the qualification amount is 0.01 USDC (10,000 USDC6).
- Mainnet deployment and testing have not occurred. Do not imply otherwise.
- Do not change `packages/core` semantics as a frontend design convenience.

## Brand Commitments

- Product name: Sazume.
- Product description: economic reliability testing for programmable money.
- Core line: “The transaction succeeded. Did the money?”
- This redesign is explicitly constrained to black, white, and neutral grays. Avoid chromatic status signaling and generic Web3 visual conventions.

## Evidence on Hand

Accepted Arc Testnet qualification records, transaction receipts, settlement events, recipient balance deltas, and the four-scenario matrix are in `evidence/testnet/`. Do not invent hashes, blocks, gas, contracts, balances, or live execution.

## Product Principles

- Judge economic intent, not receipt status alone.
- Preserve one economic identity across retries.
- Derive verdicts from observed outcomes.
- Make the supporting evidence independently inspectable.
- Keep execution and application fulfillment distinct.

## Accessibility & Inclusion

Use semantic controls, keyboard access, visible focus, readable type and contrast, state symbols in addition to color, and reduced-motion support.
