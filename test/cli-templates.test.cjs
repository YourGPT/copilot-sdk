const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// create-ai-copilot copies these templates verbatim, so a stale range here
// scaffolds new projects onto an old SDK major.
const root = path.resolve(__dirname, "..");
const templates = path.join(root, "packages/create-ai-copilot/templates");
const workspaceVersions = Object.fromEntries(
  ["copilot-sdk", "llm-sdk"].map((name) => {
    const pkg = require(path.join(root, "packages", name, "package.json"));
    return [pkg.name, pkg.version];
  }),
);

const parse = (version) => version.split(/[.-]/).slice(0, 3).map(Number);

for (const template of fs.readdirSync(templates)) {
  test(`${template} template depends on the current SDK major`, () => {
    const { dependencies } = require(
      path.join(templates, template, "package.json"),
    );
    const sdkDeps = Object.keys(dependencies).filter((name) =>
      name.startsWith("@yourgpt/"),
    );
    assert.ok(sdkDeps.length > 0, "template should use the SDK");
    for (const name of sdkDeps) {
      const range = dependencies[name];
      assert.match(range, /^\^\d+\.\d+\.\d+$/, `${name} should use a ^range`);
      const [major, minor, patch] = parse(range.slice(1));
      const [curMajor, curMinor, curPatch] = parse(workspaceVersions[name]);
      assert.equal(major, curMajor, `${name} ${range} is not on v${curMajor}`);
      assert.ok(
        minor < curMinor || (minor === curMinor && patch <= curPatch),
        `${name} ${range} is newer than workspace ${workspaceVersions[name]}`,
      );
    }
  });
}
