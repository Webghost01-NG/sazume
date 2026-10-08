# Release and public-repository readiness

Status checked 2026-10-08. Both public npm release candidates are published and independently exercised. No Mainnet transactions are authorized.

## npm release candidate

- [x] ESM and CommonJS core exports and declarations build.
- [x] CLI executable works from an installed tarball.
- [x] Independent consumer imports public exports without monorepo aliases.
- [x] JSON output, deterministic scenarios, exit codes, and no-network CI behavior validated.
- [x] Candidate tarballs are allowlisted to runtime files, declarations, README, and CLI executable; evidence, environment files, contracts, source, and dependencies are excluded.
- [x] Packages target Node `>=20.19.0`, share `0.1.0-rc.1`, and use the public `next` dist-tag.
- [x] Authenticate to npm as `webghost01`; registry is `https://registry.npmjs.org/`.
- [x] Create the official `sazume` organization and verify `webghost01` as `owner` with `npm org ls sazume`.
- [x] Verify `@sazume/core@0.1.0-rc.1` and `@sazume/cli@0.1.0-rc.1` from the public registry; `next` points to `0.1.0-rc.1` for each.
- [x] Apply MIT license with the authorized project identity `W3BGHOST`, copyright year 2026.
- [x] Remove `private: true` from the two approved npm packages only. The monorepo root remains private.
- [x] Finalize package metadata, ESM/CommonJS core exports, declarations, executable CLI, exact core dependency, Node engine, files allowlist, and `next` tag.
- [x] Publish both packages through npm staged publishing and maintainer approval with npm 2FA, in dependency order.
- [ ] Configure npm trusted publishing/OIDC before a future automated release. The current public artifacts do not claim npm provenance.
- [ ] Create and verify the GitHub prerelease after the release documentation changes are deployed.

### Candidate package details

- `@sazume/core@0.1.0-rc.1`
- `@sazume/cli@0.1.0-rc.1`, with an exact runtime dependency on `@sazume/core@0.1.0-rc.1`
- Both public packages use the `next` tag and MIT license. The CLI package depends on the exact core version `0.1.0-rc.1`.
- Public-registry consumer verification passed ESM and CommonJS core imports, TypeScript declarations, CLI exports and executable, custom adapters, the complete 4/4 versus 2/4 matrix, and expected process exit codes. The published CLI README is included in the package tarball and documents the adapter contract, scenarios, invariants, JSON, CI, and config trust boundary.

The repository includes a manually dispatched, stage-only GitHub Actions workflow for a future trusted-publisher setup:

```sh
npm stage publish --workspace=@sazume/core --access public --tag next --provenance
npm stage publish --workspace=@sazume/cli --access public --tag next --provenance
```

Because the names were new, npm exposed a temporary public `0.0.0-stage` placeholder. The actual `0.1.0-rc.1` releases are available using `@next`; the temporary placeholder remains on `latest`, so documentation must use the explicit `@next` tag. This first release used npm staged publishing but was not created by OIDC and has no provenance claim. See [npm staged publishing](https://docs.npmjs.com/staged-publishing/) and [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).

## Public source repository

- [x] Current reachable Git history scanned for common credential patterns and secret-bearing filenames; no pattern hits were found.
- [x] Repository visibility is public and `main` is the GitHub default branch (2026-10-08).
- [x] Main branch requires CI checks; force pushes are disabled.
- [x] GitHub secret scanning and push protection are enabled; no open alerts were returned at the latest check.
- [x] Review commit identities, Testnet evidence, environment examples, and operational notes as public content. Existing commit metadata includes the maintainer's personal Gmail address; history was intentionally preserved. Use the GitHub noreply address for future commits. No secret values were found by the project scan.
- [x] Apply the MIT license to the repository and the two approved package manifests.

The commit email remains a privacy consideration; it was deliberately preserved rather than rewriting existing history.

## Vercel production tracking

- [x] Vercel project is connected to `Webghost01-NG/sazume` and production tracks `main`; verify the current deployment commit after the release documentation merge.
- [x] The public homepage and `/docs` return HTTP 200. Reverify after the npm release documentation deployment.

## Arc Microgrants

The official Arc Microgrants event page (checked 2026-10-08) requires a live, working Arc Mainnet deployment, a public repository, a short project/Arc-use description, and a public builder profile. It says submissions close 2026-10-14 at 23:59 ET and are reviewed on a rolling basis. Sazume has no Mainnet deployment or Mainnet transaction evidence, so it is not currently eligible. Do not present Testnet evidence as Mainnet evidence.

Before submission, verify the event page again; qualify the actual Mainnet integration; publish the source only after secret/privacy/license review; confirm the builder profile requirement; prepare a truthful demo walkthrough and independent evidence links. The project description should be written by the project team for the application, not copied from repository marketing text.

Source: <https://community.arc.io/public/events/arc-microgrants-f8tijfjhyq>
