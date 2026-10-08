// Lifecycle semantics migrated from PerformanceDaddy's AgentWallStatus and
// AgentHookCommand. This module interprets evidence; it discovers no processes,
// opens no reply connections, grants no permissions and writes no user files.
import { createHash } from 'node:crypto';

const PROVIDERS = new Set(['Codex', 'Claude', 'Devin', 'Hermes', 'Aider', 'Gemini CLI', 'OpenCode', 'Cursor CLI']);
const EVENTS = new Set(['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse',
  'PermissionRequest', 'PostToolUseFailure', 'PreCompact', 'PostCompact', 'PostCompaction',
  'Elicitation', 'ElicitationResult', 'Stop', 'StopFailure', 'RateLimit', 'Interrupt', 'SessionEnd']);
const WORK_EVENTS = new Set(['UserPromptSubmit', 'PreToolUse', 'PostToolUse',
  'PostToolUseFailure', 'PreCompact', 'PostCompact', 'PostCompaction', 'ElicitationResult']);
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const chars = text => Array.from(graphemes.segment(text), part => part.segment);
const label = (value, limit) => typeof value === 'string' && chars(value).length <= limit ? value : null;
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function parseHookJSON(input) {
  if (typeof input !== 'string' && !Buffer.isBuffer(input)) return null;
  if (Buffer.byteLength(input) > 262_144) return null;
  try {
    const value = JSON.parse(String(input));
    return isObject(value) ? value : null;
  } catch { return null; }
}

export function sessionKey(sessionID) {
  if (typeof sessionID !== 'string' || !sessionID || Buffer.byteLength(sessionID) > 256) return null;
  return createHash('sha256').update(sessionID, 'utf8').digest('hex');
}

export function normalizeHookEvent(provider, payload) {
  if (!PROVIDERS.has(provider) || !isObject(payload)) return null;
  const raw = payload.hook_event_name;
  if (raw === 'RateLimit') return null; // An internal state, never a provider event.
  if (raw === 'StopFailure' && provider === 'Claude' && payload.error === 'rate_limit') return 'RateLimit';
  if (raw === 'Notification') {
    switch (payload.notification_type) {
      case 'permission_prompt': case 'elicitation_dialog':
      case 'elicitation_url_dialog': case 'agent_needs_input': return 'PermissionRequest';
      case 'idle_prompt': case 'agent_completed': return 'Stop';
      default: return null;
    }
  }
  return EVENTS.has(raw) ? raw : null;
}

export function shortTaskLabel(prompt) {
  if (typeof prompt !== 'string' || Buffer.byteLength(prompt) > 262_144) return null;
  if (prompt.trimStart().startsWith('<task-notification>')) return null;
  let line = prompt.split(/\r\n|[\n\r\u0085\u2028\u2029]/).filter(text => text.length > 0).slice(0, 12)
    .map(text => text.trim()).find(text => text && !text.startsWith('<pasted_content') && !text.startsWith('```'));
  if (!line) return null;
  line = line.replace(/https?:\/\/\S+/g, '[link]')
    .replace(/\b[A-Za-z0-9_/-]{28,}\b/g, '[private]').replace(/\s+/g, ' ').trim();
  if (!line) return null;
  const parts = chars(line);
  return parts.length > 88 ? parts.slice(0, 88).join('') + '…' : line;
}

export function normalizeLifecycle(payload, { now = Date.now() / 1000 } = {}) {
  if (!isObject(payload) || !Number.isFinite(now)) return null;
  const { pid, started, provider, event, timestamp } = payload;
  if (!Number.isInteger(pid) || pid <= 1 || pid > 2_147_483_647 ||
      !Number.isSafeInteger(started) || started <= 0 ||
      !PROVIDERS.has(provider) || !EVENTS.has(event) || !Number.isFinite(timestamp) ||
      Math.abs(now - timestamp) >= 120) return null;
  const taskLabel = label(payload.taskLabel, 96);
  return {
    pid, started, provider, event, timestamp,
    workspace: label(payload.workspace, 64),
    sessionKey: typeof payload.sessionKey === 'string' && /^[0-9a-f]{64}$/.test(payload.sessionKey) ? payload.sessionKey : null,
    taskLabel,
    taskObservedAt: taskLabel === null ? null : timestamp,
  };
}

export function carryLifecycle(current, previous) {
  if (!previous || current.pid !== previous.pid || current.started !== previous.started || current.provider !== previous.provider) return current;
  const sameSession = current.provider === 'Codex'
    ? current.sessionKey !== null && current.sessionKey === previous.sessionKey
    : current.sessionKey === previous.sessionKey;
  if (!sameSession) return current;
  return { ...current,
    workspace: current.workspace ?? previous.workspace,
    taskLabel: current.taskLabel ?? previous.taskLabel,
    taskObservedAt: current.taskObservedAt ?? previous.taskObservedAt,
  };
}

export function resolveActivity(event, ageSeconds) {
  if (!Number.isFinite(ageSeconds) || ageSeconds < 0) return 'unknown';
  if (WORK_EVENTS.has(event)) return ageSeconds <= 300 ? 'working' : 'unknown';
  switch (event) {
    case 'PermissionRequest': case 'Elicitation': return 'needs-input';
    case 'RateLimit': return 'rate-limited';
    case 'StopFailure': return 'failed';
    case 'Stop': case 'Interrupt': case 'SessionEnd': return 'stopped';
    default: return 'unknown';
  }
}

export function lifecycleKey(signal) {
  return `${signal.provider}:${signal.pid}:${signal.started}:${signal.sessionKey ?? 'unknown'}`;
}

export class AgentLifecycleCatalog {
  #signals = new Map();

  record(payload, { now = Date.now() / 1000 } = {}) {
    const next = normalizeLifecycle(payload, { now });
    if (!next) return false;
    const key = lifecycleKey(next);
    const previous = this.#signals.get(key);
    if (previous && next.timestamp < previous.timestamp) return false;
    this.#signals.delete(key);
    this.#signals.set(key, carryLifecycle(next, previous));
    // Instrumentation must not let a long-lived inbox accumulate unbounded rows.
    if (this.#signals.size > 512) this.#signals.delete(this.#signals.keys().next().value);
    return true;
  }

  snapshot({ now = Date.now() / 1000, liveProcesses = [] } = {}) {
    if (!Number.isFinite(now) || !Array.isArray(liveProcesses)) return [];
    const live = new Set(liveProcesses.map(process => `${process?.pid}:${process?.started}`));
    return [...this.#signals.entries()]
      .filter(([, signal]) => live.has(`${signal.pid}:${signal.started}`))
      .map(([key, signal]) => ({ ...signal, key, activity: resolveActivity(signal.event, now - signal.timestamp) }));
  }
}
