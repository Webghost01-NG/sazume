# Release and public-repository readiness

Status checked 2026-10-08. This checklist records prerequisites; it does not authorize publication or Mainnet transactions.

## npm release candidate

- [x] ESM and CommonJS core exports and declarations build.
- [x] CLI executable works from an installed tarball.
- [x] Independent consumer imports public exports without monorepo aliases.
- [x] JSON output, deterministic scenarios, exit codes, and no-network CI behavior validated.
- [ ] Confirm npm organization ownership and package-name authorization. Current npm CLI is unauthenticated; registry lookup returns 404, which does not establish ownership.
- [ ] Choose and approve a license. Current package manifests use `UNLICENSED`; no license has been applied.
- [ ] Remove private release-candidate flags, finalize metadata/versioning, and review actual tarballs immediately before publishing.
- [ ] Explicit approval to run `npm publish --access public` for each package in dependency order (`@sazume/core`, then `@sazume/cli`).

Apache-2.0 is a reasonable recommendation for a developer framework where an explicit patent grant is desirable; MIT is a simpler permissive alternative. The maintainers must select and approve the license. Neither recommendation grants permission to apply it automatically.

## Public source repository

- [x] Current reachable Git history scanned for common credential patterns and secret-bearing filenames; no pattern hits were found.
- [x] Repository visibility is public and `main` is the GitHub default branch (2026-10-08).
- [x] Main branch requires CI checks; force pushes are disabled.
- [x] GitHub secret scanning and push protection are enabled; no open alerts were returned at the latest check.
- [x] Review commit identities, Testnet evidence, environment examples, and operational notes as public content. Existing commit metadata includes the maintainer's personal Gmail address; history was intentionally preserved. Use the GitHub noreply address for future commits. No secret values were found by the project scan.
- [ ] Approve and apply an open-source license. Current package manifests remain `UNLICENSED`.

The repository may be viewed publicly without an open-source license, but absent a license, visitors do not receive standard permission to reuse or redistribute the source. The commit email remains a privacy consideration; it was deliberately preserved rather than rewriting existing history.

## Vercel production tracking

- [ ] Vercel is connected to `Webghost01-NG/sazume`, but its Production Branch still reads `feat/arc-solidity-observer`. The `main` merge created a Preview deployment; the `sazume.vercel.app` production alias still needs the Vercel Project Settings → Environments → Production → Branch Tracking value changed to `main` and saved.
- [x] The public homepage and `/docs` return HTTP 200. A successful Preview deployment is not evidence that production tracks `main`.

## Arc Microgrants

The official Arc Microgrants event page (checked 2026-10-08) requires a live, working Arc Mainnet deployment, a public repository, a short project/Arc-use description, and a public builder profile. It says submissions close 2026-10-14 at 23:59 ET and are reviewed on a rolling basis. Sazume has no Mainnet deployment or Mainnet transaction evidence, so it is not currently eligible. Do not present Testnet evidence as Mainnet evidence.

Before submission, verify the event page again; qualify the actual Mainnet integration; publish the source only after secret/privacy/license review; confirm the builder profile requirement; prepare a truthful demo walkthrough and independent evidence links. The project description should be written by the project team for the application, not copied from repository marketing text.

Source: <https://community.arc.io/public/events/arc-microgrants-f8tijfjhyq>
