// A socket write looked like a delivered outside reply although the real
// conversation never received it. Exercise the backend boundary and the UI
// policy; keep upstream sends and app-owned conversation replies unchanged.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { outsideAgentReplyState, replyToOutsideAgent } from '../main/outside-agent-replies.mjs';
import { replyIsSwallowed, replyBlockReason } from '../shared/agents.mjs';

describe('unverified outside sessions', () => {
  it.each(['idle', 'busy', 'waiting'])('blocks local %s sessions even when input is needed', (status) => {
    const agent = outsideAgentReplyState({ pid: 123, status, waitingFor: 'input needed' }, true);
    expect(agent.replyVerified).toBe(false);
    expect(replyIsSwallowed(agent)).toBe(true);
    expect(replyBlockReason(agent)).toMatch(/verified reply connection/);
  });
  it('refuses the local IPC send before calling the provider transport', async () => {
    const reply = vi.fn().mockResolvedValue({ ok: true, delivered: true });
    const result = await replyToOutsideAgent({ localInbox: true, pid: 123, text: 'synthetic reply', reply });
    expect(reply).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, delivered: false });
    expect(result.reason).toMatch(/own window/);
  });
  it('preserves upstream sends and does not mutate the input inventory', async () => {
    const agent = { pid: 123, status: 'idle' };
    expect(outsideAgentReplyState(agent, false)).toBe(agent);
    outsideAgentReplyState(agent, true);
    expect(agent).not.toHaveProperty('replyVerified');
    expect(replyIsSwallowed(agent)).toBe(false);
    const accepted = { ok: true, delivered: true };
    const reply = vi.fn().mockResolvedValue(accepted);
    expect(await replyToOutsideAgent({ localInbox: false, pid: 123, text: 'synthetic reply', reply })).toBe(accepted);
    expect(reply).toHaveBeenCalledWith(123, 'synthetic reply');
  });
  it('still blocks permission prompts independently of transport availability', () => {
    expect(replyIsSwallowed({ replyVerified: true, waitingFor: 'permission prompt' })).toBe(true);
    expect(replyBlockReason({ replyVerified: false, waitingFor: 'permission prompt' })).toMatch(/box it is stuck on/);
    expect(replyIsSwallowed({ replyVerified: true, waitingFor: 'input needed' })).toBe(false);
    expect(replyBlockReason({ replyVerified: true, waitingFor: 'input needed' })).toBeNull();
  });
  it('wires the backend guard, snapshot capability and host-app handoff', () => {
    const ipc = readFileSync(new URL('../main/ipc.mjs', import.meta.url), 'utf8');
    const focus = readFileSync(new URL('../renderer/src/components/Focus.tsx', import.meta.url), 'utf8');
    expect(ipc).toContain('outsideAgentReplyState(agent, localInbox)');
    expect(ipc).toContain('replyToOutsideAgent({ localInbox, pid: Number(pid), text, reply: agents.reply })');
    expect(focus).toContain('replyBlockReason(agent)');
    expect(focus.match(/agent && \(replyBlocked \|\| !agentTakesReply\) && onReveal/g)).toHaveLength(1);
  });
});
