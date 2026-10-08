# Release and public-repository readiness

Status checked 2026-10-08. Package publication remains gated by final maintainer confirmation; no Mainnet transactions are authorized.

## npm release candidate

- [x] ESM and CommonJS core exports and declarations build.
- [x] CLI executable works from an installed tarball.
- [x] Independent consumer imports public exports without monorepo aliases.
- [x] JSON output, deterministic scenarios, exit codes, and no-network CI behavior validated.
- [x] Candidate tarballs are allowlisted to runtime files, declarations, README, and CLI executable; evidence, environment files, contracts, source, and dependencies are excluded.
- [x] Candidate packages target Node `>=20.19.0`, share `0.1.0-rc.1`, and route prereleases to the `next` dist-tag when published.
- [x] Authenticate to npm as `webghost01`; registry is `https://registry.npmjs.org/`.
- [x] Create the official `sazume` organization and verify `webghost01` as `owner` with `npm org ls sazume`.
- [x] Confirm `@sazume/core` and `@sazume/cli` are not yet present in the public registry (404 on 2026-10-08).
- [x] Apply MIT license with the authorized project identity `W3BGHOST`, copyright year 2026.
- [x] Remove `private: true` from the two approved npm packages only. The monorepo root remains private.
- [x] Finalize package metadata, ESM/CommonJS core exports, declarations, executable CLI, exact core dependency, Node engine, files allowlist, and `next` tag.
- [x] Add a stage-only GitHub Actions workflow with OIDC provenance; it is manual, restricted to `main`, and requires typed package/version confirmation.
- [ ] Bootstrap each new package's npm page, configure its trusted publisher after the package exists, then stage the candidate through GitHub Actions and approve it with npm 2FA in dependency order (`@sazume/core`, then `@sazume/cli`). No npm stage or publish command has been run against the registry.
- [ ] Obtain final maintainer confirmation before any public npm package action. First staging for a new name makes a `0.0.0-stage` placeholder publicly visible; disclose this alongside the exact commands before proceeding.

### Candidate package details

- `@sazume/core@0.1.0-rc.1`
- `@sazume/cli@0.1.0-rc.1`, with an exact runtime dependency on `@sazume/core@0.1.0-rc.1`
- Both manifests pin public registry access and the `next` tag, use MIT, and are publishable. Versions remain unpublished.
- `npm pack --dry-run` and the independent tarball consumer test verify the actual contents and package interfaces. The CLI test checks ESM custom config, CommonJS `require` of core, declarations, installed executable, and CI pass/fail exit statuses.

After a package exists and its trusted publisher is configured, the GitHub-hosted stage workflow runs one of:

```sh
npm stage publish --workspace=@sazume/core --access public --tag next --provenance
npm stage publish --workspace=@sazume/cli --access public --tag next --provenance
```

New names need a one-time bootstrap because npm requires a package to exist before a trusted publisher can be configured. npm's first staged publish makes a public `0.0.0-stage` placeholder; the staged release contents remain unavailable until explicit 2FA approval. This public placeholder step is included in the final publication confirmation. See [npm staged publishing](https://docs.npmjs.com/staged-publishing/) and [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).

## Public source repository

- [x] Current reachable Git history scanned for common credential patterns and secret-bearing filenames; no pattern hits were found.
- [x] Repository visibility is public and `main` is the GitHub default branch (2026-10-08).
- [x] Main branch requires CI checks; force pushes are disabled.
- [x] GitHub secret scanning and push protection are enabled; no open alerts were returned at the latest check.
- [x] Review commit identities, Testnet evidence, environment examples, and operational notes as public content. Existing commit metadata includes the maintainer's personal Gmail address; history was intentionally preserved. Use the GitHub noreply address for future commits. No secret values were found by the project scan.
- [x] Apply the MIT license to the repository and the two approved package manifests.

The commit email remains a privacy consideration; it was deliberately preserved rather than rewriting existing history.

## Vercel production tracking

- [x] Vercel project is connected to `Webghost01-NG/sazume`; the newest Production deployment reports Git ref `main` at `d920177` (verified 2026-10-08).
- [x] The public homepage and `/docs` return HTTP 200. Reverify after the npm release documentation deployment.

## Arc Microgrants

The official Arc Microgrants event page (checked 2026-10-08) requires a live, working Arc Mainnet deployment, a public repository, a short project/Arc-use description, and a public builder profile. It says submissions close 2026-10-14 at 23:59 ET and are reviewed on a rolling basis. Sazume has no Mainnet deployment or Mainnet transaction evidence, so it is not currently eligible. Do not present Testnet evidence as Mainnet evidence.

Before submission, verify the event page again; qualify the actual Mainnet integration; publish the source only after secret/privacy/license review; confirm the builder profile requirement; prepare a truthful demo walkthrough and independent evidence links. The project description should be written by the project team for the application, not copied from repository marketing text.

Source: <https://community.arc.io/public/events/arc-microgrants-f8tijfjhyq>
