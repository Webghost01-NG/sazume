# Dependency security review

Audit date: 2026-10-08. The results below describe the committed lockfile and its install tree, not every dependency version that might be selected by a future lockfile update.

## Before remediation

`npm audit` reported six advisories in the development toolchain (three moderate, one high, two critical). `npm audit --omit=dev` reported no production dependency advisories.

| Package | Prior resolved version / path | Severity and impact | Resolution |
| --- | --- | --- | --- |
| `@vitest/mocker` | 2.1.9, through Vitest | Moderate; redirect mock path traversal / arbitrary file read ([GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9)) | Updated through Vitest 5.0.3 |
| `esbuild` | 0.21.5 nested under Vite | Moderate; dev-server cross-origin request exposure ([GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99)) | Vite 8.3.3 replaces this Vite transform path; current lock has no vulnerable nested version |
| `tinypool` | 1.1.1, through Vitest | Critical; worker option prototype pollution with possible code execution ([GHSA-5gmw-xhrv-c9v3](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3), [GHSA-85c8-ppgw-ccpr](https://github.com/advisories/GHSA-85c8-ppgw-ccpr)) | Updated through Vitest 5.0.3; no `tinypool` package remains in the current lock |
| `vite` | 5.4.21 | High and moderate; optimized dependency path traversal and Windows path handling ([GHSA-4w7w-66w2-5vf9](https://github.com/advisories/GHSA-4w7w-66w2-5vf9), [GHSA-v6wh-96g9-6wx3](https://github.com/advisories/GHSA-v6wh-96g9-6wx3), [GHSA-fx2h-pf6j-xcff](https://github.com/advisories/GHSA-fx2h-pf6j-xcff)) | Updated to 8.3.3 |
| `vite-node` | 2.1.9, through Vitest | Moderate; inherited Vite advisory path | Updated through Vitest 5.0.3; no `vite-node` package remains in the current lock |
| `vitest` | 2.1.9 | Critical; UI server file read/execution ([GHSA-5xrq-8626-4rwp](https://github.com/advisories/GHSA-5xrq-8626-4rwp)) plus affected transitive packages | Updated to 5.0.3 |

All findings were in developer tooling, not application runtime dependencies. Vite and Vitest required major upgrades because the audit's patched versions were outside the prior major versions. The Vite React plugin was upgraded to 6.1.2 to match Vite 8. A clean `npm ci`, tests, typecheck, and production build were run after the upgrade.

The six package-level rows correspond to six vulnerable package records; Vitest's transitive rows account for multiple advisory records, including two separate Tinypool advisories. The baseline audit summarized them as three moderate, one high, and two critical findings. A baseline lockfile audit was reproduced from commit `69ef216` in a temporary directory; the baseline lock resolved nested `vite/node_modules/esbuild` at 0.21.5 (the separate root Esbuild was 0.28.2).

## After remediation

`npm audit` reports zero known advisories in the installed, locked dependency tree. `npm audit --omit=dev` also reports zero. This is a point-in-time result; rerun the audit as part of release preparation and keep the lockfile committed.

The workspace's build/test tooling now requires Node 22.12 or newer because Vitest 5 requires it. The published runtime packages declare Node `>=20.19.0`; their supported Node 20 line was tested independently with the packed CLI and core. Vite 8 documents its Rolldown/Oxc migration and Node requirements; see [Vite migration guide](https://vite.dev/guide/migration.html), [Vite 8 announcement](https://vite.dev/blog/announcing-vite8.html), and [Vitest migration guide](https://vitest.dev/guide/migration/).

## Residual risk

Zero findings does not establish that code is safe. Config files passed to the CLI are trusted executable JavaScript and can perform any action available to the user running the CLI. The `@sazume` namespace is controlled by the verified `sazume` npm organization, and both `0.1.0-rc.1` packages are publicly available under the `next` dist-tag with MIT licensing. npm trusted publishing/provenance was not configured for this first staged release; the package artifacts should not be described as provenance-verified. No dependency is installed from an untrusted mirror, and no audit finding was suppressed.
