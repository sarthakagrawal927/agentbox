// WHO A RELEASE IS FROM, AND WHERE IT TELLS INSTALLED COPIES TO LOOK.
//
// This repository is the Agent Inbox fork of upstream Agentbox. Until
// 2026-10-09 `npm run release` built upstream's identity: bundle ID
// ac.astral.app, signed by whatever Developer ID was on the Mac, with an update
// feed at agentboxhq/agentbox-releases. Signed and published, that would have
// been an Agent Inbox build claiming to be Agentbox and updating from a feed
// this fork does not own.
//
// Those three values are the owner's decision, not an agent's, so the release
// path reads them from agent-inbox-release.json and refuses to build, sign or
// publish while any of them is unset, malformed, or still upstream's. There is
// no fallback and no default: an unset value stops the release.

import fs from 'node:fs';
import path from 'node:path';

export const IDENTITY_FILE = 'agent-inbox-release.json';
export const IDENTITY_DOC = 'docs/release-identity.md';

// Identities that belong to someone else, or to the unsigned local review build.
const NOT_OURS = {
  bundleId: ['ac.astral.app', 'com.significanthobbies.agentinbox.local'],
  updateFeed: ['agentboxhq/agentbox-releases', 'astral-agent/astral-releases'],
};

const FIELDS = [
  {
    key: 'bundleId',
    what: 'the macOS bundle ID (CFBundleIdentifier), reverse-DNS, e.g. com.example.agentinbox',
    valid: (v) => /^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(v),
  },
  {
    key: 'developerIdTeamId',
    what: 'the 10-character Apple Developer team ID the Developer ID Application certificate belongs to',
    valid: (v) => /^[A-Z0-9]{10}$/.test(v),
  },
  {
    key: 'updateFeed',
    what: 'the GitHub releases repository installed copies update from, as owner/repo',
    valid: (v) => /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(v),
  },
];

const unset = (v) => v == null || (typeof v === 'string' && (!v.trim() || /\bunset\b|^todo$|^placeholder$|^x+$/i.test(v.trim())));

/** Checks a parsed identity. `{ ok: true, identity }` or `{ ok: false, problems }`. */
export function checkReleaseIdentity(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return { ok: false, problems: [`${IDENTITY_FILE} is not a JSON object.`] };
  }
  const problems = [];
  const identity = {};
  for (const { key, what, valid } of FIELDS) {
    const v = config[key];
    if (unset(v)) { problems.push(`${key} is unset: ${what}.`); continue; }
    if (typeof v !== 'string' || !valid(v.trim())) { problems.push(`${key} is ${JSON.stringify(v)}, which is not ${what}.`); continue; }
    const value = v.trim();
    if ((NOT_OURS[key] ?? []).includes(value.toLowerCase())) {
      problems.push(`${key} is ${value}, which is not an Agent Inbox release identity.`);
      continue;
    }
    identity[key] = value;
  }
  return problems.length ? { ok: false, problems } : { ok: true, identity };
}

/** Reads and checks agent-inbox-release.json in a checkout. */
export function readReleaseIdentity(repo) {
  const file = path.join(repo, IDENTITY_FILE);
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch {
    return { ok: false, problems: [`${IDENTITY_FILE} is missing.`] };
  }
  let config;
  try { config = JSON.parse(raw); } catch {
    return { ok: false, problems: [`${IDENTITY_FILE} is not valid JSON.`] };
  }
  return checkReleaseIdentity(config);
}

/** The refusal, in words a person can act on. */
export function refusal(problems, doing) {
  return [
    `Not ${doing}: the Agent Inbox release identity is not configured.`,
    '',
    ...problems.map((p) => `  - ${p}`),
    '',
    `Fill in ${IDENTITY_FILE} (all three values are the owner's decision); ${IDENTITY_DOC} explains each.`,
    'For an unsigned local review build that never publishes, run: node scripts/pack-local-inbox.mjs',
  ];
}

/** electron-builder overrides that put the configured identity on the build. */
export function identityBuilderArgs(identity) {
  const [owner, repo] = identity.updateFeed.split('/');
  // build.publish on disk is an array, and electron-builder applies a
  // command-line publish object onto its first entry, so these three replace
  // upstream's provider, owner and repo rather than adding a second feed.
  return [
    `-c.appId=${identity.bundleId}`,
    '-c.publish.provider=github',
    `-c.publish.owner=${owner}`,
    `-c.publish.repo=${repo}`,
  ];
}
