#!/usr/bin/env node
// Read one explicitly selected local measurement file; never discovers config or reads activity stores.
import path from 'node:path';
import { readLocalUsageReport } from '../main/local-usage.mjs';

const args = process.argv.slice(2);
const flag = args.indexOf('--usage-file');
const portfolioMode = args.includes('--portfolio');
if (flag < 0 || !args[flag + 1] || args.length !== (portfolioMode ? 3 : 2)
  || args.some((arg, index) => index !== flag && index !== flag + 1 && arg !== '--portfolio')) {
  console.error('Usage: node scripts/export-local-usage.mjs --usage-file <local-usage.json> [--portfolio]');
  process.exit(2);
}
const file = path.resolve(args[flag + 1]);
const checkedAt = Date.now();
const report = readLocalUsageReport({ file, now: checkedAt });
let output = report;
if (portfolioMode) {
  const checkedAtIso = new Date(checkedAt).toISOString();
  output = {
    kind: 'portfolio-usage',
    schemaVersion: 1,
    usage: {
      schemaVersion: 1,
      updatedAt: checkedAtIso,
      records: {
        'agent-inbox': {
        windowStart: new Date(checkedAt - 720 * 60 * 60 * 1000).toISOString(),
        windowEnd: checkedAtIso,
        checkedAt: checkedAtIso,
        proxy: {
          count: report.localDeviceUnits > 0 ? report.localDeviceUnits : null,
          unit: 'devices',
          precision: report.localDeviceUnits > 0 ? 'lower_bound' : 'unknown',
        },
        core: {
          count: null,
          definition: 'Saved local replies and newly persisted explicit permission decisions; not yet qualified as natural owner use.',
          lastUsedAt: null,
          qualified: false,
          precision: 'unknown',
          coverage: report.storageStatus === 'available' ? 'partial' : 'unknown',
        },
        tracking: report.storageStatus === 'missing' ? 'missing' : 'partial',
        evidence: [{
          source: 'Agent Inbox local counter',
          date: checkedAtIso,
          note: report.storageStatus === 'missing'
            ? 'No local counter file exists; historical coverage is unknown and no owner history or QA exclusion was checked.'
            : report.storageStatus !== 'available'
              ? 'The local counter file is unavailable; counts and historical coverage are unknown, and no owner history or QA exclusion was checked.'
              : `Content-free local event-kind and timestamp counters; coverage since ${report.coverageSince}; no owner history or QA exclusion was checked.`,
        }],
        limitations: 'Foreground focus is only a local-device proxy. Counters cover only recorded events; no continuity proof, independent QA exclusion or natural-use qualification is available.',
        events: report.storageStatus !== 'available' ? [] : [
          { name: 'foreground_focus', count: report.counts.foregroundFocuses, lastSeen: report.eventLastSeen.foregroundFocuses, precision: report.coverageComplete ? 'exact' : 'estimate' },
          { name: 'saved_reply', count: report.counts.savedReplies, lastSeen: report.eventLastSeen.savedReplies, precision: report.coverageComplete ? 'exact' : 'estimate' },
          { name: 'permission_response', count: report.counts.permissionResponses, lastSeen: report.eventLastSeen.permissionResponses, precision: report.coverageComplete ? 'exact' : 'estimate' },
        ],
        },
      },
    },
  };
}
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
