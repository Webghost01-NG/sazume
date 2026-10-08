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
- [ ] Remove or replace the personal Gmail author identity in Git history before public exposure. Existing commit objects contain it in every commit; preserving current history means it will be exposed by a public clone.
- [ ] Review commit identities, testnet evidence, environment examples, and operational notes as public content.
- [ ] Confirm a license and public-ready default branch.
- [x] Explicit approval for public visibility was received on 2026-10-08; visibility change is paused because current commit history contains the maintainer's personal Gmail address.

The repository may be viewed publicly without an open-source license, but absent a license, visitors do not receive standard permission to reuse or redistribute the source. The commit identity issue is the immediate privacy blocker.

## Arc Microgrants

The official Arc Microgrants event page (checked 2026-10-08) requires a live, working Arc Mainnet deployment, a public repository, a short project/Arc-use description, and a public builder profile. It says submissions close 2026-10-14 at 23:59 ET and are reviewed on a rolling basis. Sazume has no Mainnet deployment or Mainnet transaction evidence, so it is not currently eligible. Do not present Testnet evidence as Mainnet evidence.

Before submission, verify the event page again; qualify the actual Mainnet integration; publish the source only after secret/privacy/license review; confirm the builder profile requirement; prepare a truthful demo walkthrough and independent evidence links. The project description should be written by the project team for the application, not copied from repository marketing text.

Source: <https://community.arc.io/public/events/arc-microgrants-f8tijfjhyq>
