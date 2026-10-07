---
version: 1
slug: "apps-web-src-app-tsx"
primary_target: "apps/web/src/App.tsx"
related_targets: []
---

# Sazume web experiment

## Scope and mode
Single-page, web, Operate surface. The artifact is an economic reliability experiment, not a static landing-page dashboard.

## Audience, job, action, proof, constraints
Inferred primary audience from the brief: protocol and application engineers testing payment workflows. They configure an economic intent, choose an implementation and deterministic fault, run a verified evidence replay, and inspect the resulting invariant verdict. Proof is accepted Arc Testnet receipt, matching settlement event, and recipient USDC6 balance evidence from `evidence/testnet/`. Preserve the evidence provider and core semantics. No RPC or browser broadcast; never claim Mainnet. Use black, white, neutral grays only. Support keyboard, visible focus, reduced motion, and responsive widths.

## Direction contract

THESIS: Judge the payment obligation against observed economic movement; receipts alone do not settle the question. Refuse the precomputed dashboard that displays result cards before a test.

OWN-WORLD: A monochrome conformance folio for an economic workflow. Black, white, and neutral gray; type hierarchy does the status work; open space gives way to compact evidence; a precise obligation/observation equation is the signature move. Standard web controls remain recognizable and the page remains a working test product.

STORY: Define one obligation, select unsafe or idempotent behavior and one of four faults, run the recorded execution, reconcile receipts/events/balance, then inspect why the invariants pass or fail.

FIRST VIEWPORT: A compact SAZUME masthead and restrained “ARC TESTNET / VERIFIED EVIDENCE” line sit above a four-line display thesis. The next section is the instrument: intent and limits, implementation selector, fault selector, and one high-contrast run action. No observed outcomes, hashes, matrix, or verdict appear before the run.

FORM: Candidate 6, conformance report and verification record, selected from the grounded set; direction seed `e5a27320`. The user’s strict monochrome and editorial engineering brief overrides the seed’s catalog palette. Signature interaction: one intent branches into actual transaction receipts and recombines at the observed recipient delta, beside the invariant verdict. Configure → execute → analyze → verdict → proof. Desktop pairs the experiment controls with a spacious trace; mobile keeps the same sequence in one column.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
