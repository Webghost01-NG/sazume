import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const root = await readJson("../package.json");
const core = await readJson("../packages/core/package.json");
const cli = await readJson("../packages/cli/package.json");

assert.equal(root.license, "MIT", "root metadata must name the repository license");
assert.equal(core.name, "@sazume/core");
assert.equal(cli.name, "@sazume/cli");
assert.equal(core.version, "0.1.0-rc.1");
assert.equal(cli.version, core.version, "release package versions must match");
assert.equal(cli.dependencies["@sazume/core"], core.version, "CLI must depend on the exact core release");
const repositoryLicense = await readFile(new URL("../LICENSE", import.meta.url), "utf8");

for (const manifest of [core, cli]) {
  assert.equal(manifest.private, undefined, `${manifest.name} must be publishable`);
  assert.equal(manifest.license, "MIT", `${manifest.name} must use the approved license`);
  assert.equal(manifest.engines.node, ">=20.19.0");
  assert.equal(manifest.repository.url, "git+https://github.com/Webghost01-NG/sazume.git");
  assert.equal(manifest.publishConfig.access, "public");
  assert.equal(manifest.publishConfig.tag, "next");
  assert.equal(manifest.publishConfig.registry, "https://registry.npmjs.org/");
  const license = await readFile(new URL(`../packages/${manifest.name.split("/")[1]}/LICENSE`, import.meta.url), "utf8");
  assert.equal(license, repositoryLicense, `${manifest.name} must bundle the repository's exact MIT text`);
  assert.match(license, /^MIT License\n\nCopyright \(c\) 2026 W3BGHOST\n/);
}

console.log("Release manifests verified: @sazume/core and @sazume/cli 0.1.0-rc.1, MIT, public, next.");
