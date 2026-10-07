# Sazume interface design

## Design intent

Sazume is an economic reliability instrument for programmable-money workflows. The page presents a conformance folio: define one obligation, replay a recorded execution, reconcile independent evidence, and reveal whether the obligation survived. The visual system uses type, spacing, symbols, and contrast to make status legible without color.

The page's signature is a single economic intent branching into transaction receipts and recombining at the recipient balance delta. A transaction can remain visibly successful while the economic verdict fails.

## Color and surface tokens

All interface colors are black, white, or neutral grays. Status does not depend on hue.

| CSS token | Value | Use |
| --- | --- | --- |
| `--black` | `#050505` | Main canvas, inverted verdict text |
| `--near-black` | `#101010` | Preserved verdict surface |
| `--white` | `#f5f5f5` | Primary text and active outlines |
| `--paper` | `#fff` | Violated verdict surface |
| `--gray-1` | `#dedede` | Secondary body text |
| `--gray-2` | `#b4b4b4` | Supporting text and measurements |
| `--gray-3` | `#8a8a8a` | Labels and quiet metadata |
| `--gray-4` | `#666` | Structural section rules |
| `--rule` | `#393939` | Primary internal dividers |
| `--rule-soft` | `#252525` | Dense timeline dividers |

The violated verdict inverts to a white field with black text; the preserved verdict remains near-black with white text and a white rule. Selection uses a white underline or rule. Execution symbols (`✓`, `×`, `!`, `—`, `↩`) accompany text so state is not conveyed through color alone. The page canvas is `#050505`; selection, scrollbar, links, and focus styles also stay achromatic.

## Typography

The implementation uses local/system-safe stacks; it does not require remote font assets.

- Display: `Liberation Sans Narrow`, `Arial Narrow`, `Nimbus Sans Narrow`, then sans-serif. Used for the four-line thesis, intent title, section headlines, and large verdict.
- Body: `Cantarell`, `Segoe UI`, then sans-serif. Used for explanatory copy and controls.
- Evidence/telemetry: `SFMono-Regular`, `Consolas`, `Liberation Mono`, then monospace. Used for intent IDs, values, labels, trace sequence, receipt metadata, and measurements.

Display text uses tight line-height and restrained negative tracking. Tabular numeric values use monospace or `font-variant-numeric: tabular-nums` for comparison. Small labels are deliberately secondary to the editorial headlines; dense technical metadata is limited to execution and proof sections.

## Layout and spacing

The centered page shell is capped at `1424px` and uses responsive side gutters (`52px` at the widest layout, `32px` under `1100px`, `22px` under `820px`, and `15px` under `540px`). The masthead, hero, experiment, execution, editorial sections, and footer are separated by horizontal rules rather than repeated cards.

At wide widths the hero pairs its large four-line thesis with a short purpose note. The intent specification uses a four-column grid; between `820px` and `1100px`, the obligation title spans above three aligned amount/limit columns. Implementation controls and fault selection share a two-column configuration row. Execution is a full-width timeline with an intent-to-receipt branch and a reconciled outcome. Verdict and proof appear only after the run state reaches completion. Editorial explanation and the collapsed qualification record follow the interactive instrument.

Responsive breakpoints in `apps/web/src/styles.css`:

- `1100px`: reduced shell gutters and adjusted experiment/verdict grids.
- `820px`: hero and configuration become single-column; verdict stacks; proof and method layouts adapt.
- `540px`: compact masthead, intent values, timeline, branch diagram, verdict, metadata, and matrix typography/layout.

The document minimum width is `320px`. Long identifiers and hashes wrap or truncate within their labeled control; transaction evidence is exposed in a separate expandable/inspectable section after completion.

## Product states and interaction

The UI follows `ExperimentStage` from `apps/web/src/lib/runMachine.ts`:

1. `configure`: choose `unsafe` or `fixed` and one of the four deterministic scenarios. No completed verdict, transaction proof, or economic result is shown.
2. `running`: reveal trace entries one at a time using deterministic presentation timing. The sequence clock is explicitly labeled as presentation timing, not historical chain latency. The visible receipts branch from the same intent.
3. `analyzing`: reveal reconciliation observations for receipts, settlement events, recipient balance, and invariant results.
4. `complete`: show the verdict and proof inspector. Reset returns to configuration; changing implementation or scenario also resets the run.

Implementation and scenario buttons expose `aria-pressed`; configuration groups use fieldsets and legends. Buttons, links, and evidence summary controls have visible high-contrast focus outlines. Status symbols are hidden from assistive technology where their adjacent text already communicates the state, or explicitly labeled when used as state indicators. A polite live region announces completion.

Motion is limited to trace-row arrival, active replay indication, verdict reveal, scroll movement, and small control transitions. `prefers-reduced-motion: reduce` disables smooth scrolling and reduces animations/transitions to near-zero duration. Replay intervals are presentation pacing only and make no claim about chain latency.

## Evidence and truthfulness

`testnetEvidenceProvider` loads the accepted `evidence/testnet/` records and qualification matrix. `buildRunPresentation` derives the displayed trace and invariant presentation from that evidence. React components format and reveal those values; they do not independently assign economic outcomes.

The browser is a **verified Arc Testnet evidence replay**. No browser RPC request or transaction broadcast occurs. The network is labeled Arc Testnet, evidence references the accepted run record and chain ID, transaction links use the Arc Testnet explorer, and the footer states that Mainnet is not deployed. The qualification amount is read from evidence (`USDC6`) and formatted without floating-point arithmetic.

The proof inspector distinguishes successful receipts, matching intent settlement events, and recipient USDC6 balance movement. It exposes transaction hashes, block numbers, gas, gas cost units, the intent ID, contract, and recipient evidence, with copy controls and explorer links.

## Component patterns

- **Masthead and thesis:** compact identity and truthful network/evidence status; large editorial headline.
- **Experiment specification:** obligation, amount, settlement/fulfillment bounds, implementation choice, scenario choice, and replay action; controls are open and rule-based rather than card-based.
- **Execution timeline:** numbered, presentation-timed sequence with symbol and explanatory copy.
- **Intent branches:** one stable machine intent ID connected to receipts; successful transactions remain visually successful even when the overall verdict is violated.
- **Reconciliation:** evidence classes are disclosed in sequence before evaluation completes.
- **Economic verdict:** strongest state change; monochrome inversion distinguishes failure from preservation.
- **Proof inspector:** transaction and balance corroboration appears only after completion.
- **Editorial explanation and qualification:** separate chain correctness from economic correctness; place the full validation matrix behind native disclosure.

## Design constraints

- Do not add chromatic status colors, gradients, glass surfaces, decorative dashboard tiles, or repeated rounded cards.
- Do not label evidence replay as live execution.
- Do not display Mainnet verification or imply a browser-signed transaction.
- Do not move economic semantics into the UI or change `packages/core` for presentation convenience.
- Keep monetary values as integer USDC6 strings/bigints at the evidence boundary; do not introduce floating-point accounting.
