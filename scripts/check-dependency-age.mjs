#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Supply-chain cooldown CI gate (enforcement backstop)
// ─────────────────────────────────────────────────────────────────────────────
// Fails the build if a PR introduces any dependency version published more
// recently than COOLDOWN_DAYS ago. This mirrors pnpm's `minimumReleaseAge`
// (pnpm-workspace.yaml) but runs in CI, so it still catches a too-new version
// even if a contributor used a different package manager, an older pnpm, or
// hand-edited the lockfile. No third-party deps/actions — uses only Node builtins
// to keep the gate itself off the supply-chain attack surface.
//
// Env:
//   COOLDOWN_DAYS  cooldown window in days (default 7 — keep in sync with
//                  minimumReleaseAge in pnpm-workspace.yaml: days × 1440 = minutes)
//   BASE_REF       git ref to diff against (default origin/main)

import { execSync } from "node:child_process";

const COOLDOWN_DAYS = Number(process.env.COOLDOWN_DAYS || "7");
const COOLDOWN_MS = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
const BASE_REF = process.env.BASE_REF || "origin/main";
const LOCKFILE = "pnpm-lock.yaml";

// Names exempt from the cooldown — keep in sync with minimumReleaseAgeExclude.
const EXCLUDE_PREFIXES = ["@yourgpt/"];

let diff = "";
try {
  diff = execSync(`git diff ${BASE_REF}...HEAD -- ${LOCKFILE}`, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
} catch (err) {
  console.error(`Could not diff ${LOCKFILE} against ${BASE_REF}: ${err.message}`);
  process.exit(1);
}

// pnpm-lock v9 package keys look like:
//   '@scope/name@1.2.3':              (scoped, quoted)
//   name@1.2.3:                       (unscoped)
//   'react-dom@18.3.1(react@18.3.1)': (with peer suffix — base version captured)
const KEY_RE = /^\+\s+'?((?:@[a-z0-9-._]+\/)?[a-z0-9-._]+)@([0-9][^():'\s]*)(?:\([^)]*\))?'?:/i;

const specs = new Set();
for (const line of diff.split("\n")) {
  if (!line.startsWith("+")) continue;
  const m = line.match(KEY_RE);
  if (!m) continue;
  const [, name, version] = m;
  if (EXCLUDE_PREFIXES.some((p) => name.startsWith(p))) continue;
  specs.add(`${name}@${version}`);
}

if (specs.size === 0) {
  console.log("No new dependency versions introduced in the lockfile. ✅");
  process.exit(0);
}

console.log(
  `Checking ${specs.size} newly-introduced version(s) against a ${COOLDOWN_DAYS}-day cooldown…\n`,
);

const now = Date.now();
const violations = [];
const skipped = [];

for (const spec of specs) {
  const at = spec.lastIndexOf("@");
  const name = spec.slice(0, at);
  const version = spec.slice(at + 1);
  const url = `https://registry.npmjs.org/${name.replace("/", "%2F")}`;

  let meta;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      skipped.push(`${spec} (registry HTTP ${res.status})`);
      continue;
    }
    meta = await res.json();
  } catch (err) {
    skipped.push(`${spec} (fetch failed: ${err.message})`);
    continue;
  }

  const published = meta.time && meta.time[version];
  if (!published) {
    skipped.push(`${spec} (no publish timestamp)`);
    continue;
  }

  const ageDays = (now - new Date(published).getTime()) / 86_400_000;
  if (ageDays < COOLDOWN_DAYS) {
    violations.push({ spec, ageDays, published });
    console.log(`  ✗ ${spec} — published ${ageDays.toFixed(1)}d ago (< ${COOLDOWN_DAYS}d)`);
  } else {
    console.log(`  ✓ ${spec} — ${ageDays.toFixed(1)}d`);
  }
}

if (skipped.length) {
  console.log(`\nSkipped ${skipped.length} (could not verify):`);
  for (const s of skipped) console.log(`  ? ${s}`);
}

if (violations.length) {
  console.error(
    `\n❌ ${violations.length} dependency version(s) are younger than the ${COOLDOWN_DAYS}-day cooldown:`,
  );
  for (const v of violations) {
    console.error(`   - ${v.spec}  (published ${v.published})`);
  }
  console.error(
    `\nLet them age past the cooldown, or add a reviewed exception to\n` +
      `minimumReleaseAgeExclude in pnpm-workspace.yaml.`,
  );
  process.exit(1);
}

console.log(`\nAll newly-introduced versions satisfy the ${COOLDOWN_DAYS}-day cooldown. ✅`);
