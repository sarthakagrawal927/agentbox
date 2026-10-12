import { replyBlockReason } from '../shared/agents.mjs';

// Inventory and socket discovery do not prove provider acceptance. Local Inbox
// keeps outside sessions observable and hands replies back to their host app.
export function outsideAgentReplyState(agent, localInbox) {
  return localInbox ? { ...agent, replyVerified: false } : agent;
}

export async function replyToOutsideAgent({ localInbox, pid, text, reply }) {
  if (localInbox) {
    return { ok: false, delivered: false, reason: replyBlockReason({ replyVerified: false }) };
  }
  return reply(pid, text);
}
