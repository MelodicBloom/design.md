#!/usr/bin/env bun
/**
 * sync-labels.ts
 * Creates or updates all labels required by .github/labeler.yml and
 * .github/release-drafter.yml in the target repository.
 *
 * Usage:
 *   bun run .github/scripts/sync-labels.ts
 *
 * Requires GITHUB_TOKEN env var with repo write access.
 * Reads GITHUB_REPOSITORY (owner/repo) or falls back to MelodicBloom/design.md.
 */

const token = process.env['GITHUB_TOKEN'];
if (!token) {
  console.error('Error: GITHUB_TOKEN environment variable is required.');
  process.exit(1);
}

const repo = process.env['GITHUB_REPOSITORY'] ?? 'MelodicBloom/design.md';
const [owner, repoName] = repo.split('/');

// Label definitions: name, hex colour (no #), description
const LABELS: Array<{ name: string; color: string; description: string }> = [
  // ── Conventional commit types ──────────────────────────────────────
  { name: 'feat',          color: '0075ca', description: 'New feature or capability' },
  { name: 'feature',       color: '0075ca', description: 'Alias for feat' },
  { name: 'enhancement',   color: 'a2eeef', description: 'Improvement to an existing feature' },
  { name: 'fix',           color: 'd73a4a', description: 'Bug fix' },
  { name: 'bug',           color: 'd73a4a', description: 'Confirmed bug' },
  { name: 'bugfix',        color: 'd73a4a', description: 'Alias for fix' },
  { name: 'docs',          color: '0052cc', description: 'Documentation changes only' },
  { name: 'documentation', color: '0052cc', description: 'Alias for docs' },
  { name: 'chore',         color: 'e4e669', description: 'Maintenance, tooling, or housekeeping' },
  { name: 'refactor',      color: 'fef2c0', description: 'Code restructure without behaviour change' },
  { name: 'perf',          color: '0e8a16', description: 'Performance improvement' },
  { name: 'performance',   color: '0e8a16', description: 'Alias for perf' },
  { name: 'test',          color: 'bfd4f2', description: 'Test additions or changes' },
  { name: 'tests',         color: 'bfd4f2', description: 'Alias for test' },
  { name: 'ci',            color: 'f9d0c4', description: 'CI/CD workflow changes' },
  { name: 'build',         color: 'c5def5', description: 'Build system or package config changes' },
  { name: 'deps',          color: '0366d6', description: 'Dependency updates' },
  { name: 'dependencies',  color: '0366d6', description: 'Alias for deps' },
  // ── Release / semver ───────────────────────────────────────────────
  { name: 'release',       color: 'b60205', description: 'Version bump PR — excluded from changelog' },
  { name: 'breaking',      color: 'e11d48', description: 'Introduces a breaking (semver major) change' },
  { name: 'breaking-change', color: 'e11d48', description: 'Alias for breaking' },
  { name: 'semver:major',  color: 'b60205', description: 'Forces a major version bump' },
  { name: 'semver:minor',  color: '0075ca', description: 'Forces a minor version bump' },
  { name: 'semver:patch',  color: '0e8a16', description: 'Forces a patch version bump' },
  // ── Utility ────────────────────────────────────────────────────────
  { name: 'skip-changelog', color: 'ededed', description: 'Exclude this PR from the release changelog' },
];

const headers = {
  'Authorization': `Bearer ${token}`,
  'Accept': 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'Content-Type': 'application/json',
};

async function getExistingLabels(): Promise<Map<string, { id: number; color: string; description: string }>> {
  const map = new Map<string, { id: number; color: string; description: string }>();
  let page = 1;
  while (true) {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/labels?per_page=100&page=${page}`,
      { headers }
    );
    if (!res.ok) throw new Error(`Failed to list labels: ${res.status} ${await res.text()}`);
    const data = await res.json() as Array<{ id: number; name: string; color: string; description: string }>;
    if (data.length === 0) break;
    for (const label of data) {
      map.set(label.name, { id: label.id, color: label.color, description: label.description ?? '' });
    }
    if (data.length < 100) break;
    page++;
  }
  return map;
}

async function createLabel(label: typeof LABELS[number]): Promise<void> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repoName}/labels`,
    { method: 'POST', headers, body: JSON.stringify(label) }
  );
  if (!res.ok) throw new Error(`Failed to create label "${label.name}": ${res.status} ${await res.text()}`);
  console.log(`  created  ${label.name}`);
}

async function updateLabel(name: string, label: typeof LABELS[number]): Promise<void> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repoName}/labels/${encodeURIComponent(name)}`,
    { method: 'PATCH', headers, body: JSON.stringify({ color: label.color, description: label.description }) }
  );
  if (!res.ok) throw new Error(`Failed to update label "${name}": ${res.status} ${await res.text()}`);
  console.log(`  updated  ${label.name}`);
}

const existing = await getExistingLabels();
console.log(`\nSyncing ${LABELS.length} labels to ${owner}/${repoName}...\n`);

for (const label of LABELS) {
  const current = existing.get(label.name);
  if (!current) {
    await createLabel(label);
  } else if (current.color !== label.color || current.description !== label.description) {
    await updateLabel(label.name, label);
  } else {
    console.log(`  ok       ${label.name}`);
  }
}

console.log('\nDone.');
