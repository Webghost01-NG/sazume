# Release and public-repository readiness

Status checked 2026-10-08. This checklist records prerequisites; it does not authorize publication or Mainnet transactions.

## npm release candidate

- [x] ESM and CommonJS core exports and declarations build.
- [x] CLI executable works from an installed tarball.
- [x] Independent consumer imports public exports without monorepo aliases.
- [x] JSON output, deterministic scenarios, exit codes, and no-network CI behavior validated.
- [x] Candidate tarballs are allowlisted to runtime files, declarations, README, and CLI executable; evidence, environment files, contracts, source, and dependencies are excluded.
- [x] Candidate packages target Node `>=20.19.0`, share `0.1.0-rc.1`, and route prereleases to the `next` dist-tag when published.
- [ ] Authenticate to npm and verify that the publishing account controls `@sazume`. `npm whoami` currently returns 401. Anonymous registry lookups return 404 for both candidate names but do not establish ownership or availability.
- [ ] Verify an authorized alternative scope if `@sazume` is not controlled. No npm identity is available in this environment, so no alternative scope can be confirmed.
- [ ] Approve a license. **Recommendation: MIT** for a simple permissive grant. Current package manifests remain `UNLICENSED`; MIT has not been applied and no license file has been created.
- [ ] Remove private release-candidate flags, finalize metadata/versioning, and review actual tarballs immediately before publishing.
- [ ] Configure npm trusted publishing/provenance for the public GitHub repository, then explicitly approve publishing in dependency order (`@sazume/core`, then `@sazume/cli`). No publish workflow exists and no publish command was run.

### Candidate package details

- `@sazume/core@0.1.0-rc.1`
- `@sazume/cli@0.1.0-rc.1`, with an exact runtime dependency on `@sazume/core@0.1.0-rc.1`
- Both manifests pin public registry access and the `next` tag but retain `private: true` and `UNLICENSED` until the release gates are approved. npm will refuse to publish a package marked private.
- `npm pack --dry-run` and the independent tarball consumer test verify the actual contents and package interfaces. The CLI test checks ESM custom config, CommonJS `require` of core, declarations, installed executable, and CI pass/fail exit statuses.

After account ownership, license approval, and metadata gates are resolved, the intended GitHub-hosted, public-repository workflow publish steps are:

```sh
npm publish --workspace=@sazume/core --access public --tag next --provenance
npm publish --workspace=@sazume/cli --access public --tag next --provenance
```

These are **not executable in the current candidate state**: `private: true` is deliberately retained, npm ownership is unverified, licensing is unapproved, and provenance requires a configured supported CI publisher with OIDC (`id-token: write`). npm documents that trusted publishing automatically creates provenance attestations; publishing from a private repository does not support provenance. See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) and [npm provenance generation](https://docs.npmjs.com/generating-provenance-statements/).

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
