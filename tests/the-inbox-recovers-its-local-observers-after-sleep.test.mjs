// Recovery was wired only to app-owned workers. The read-only inbox observers
// need their own wake path even when no supervisor or provider is running.
import {it,expect,vi} from 'vitest';
import {EventEmitter} from 'node:events';
import fs from 'node:fs';
import {installInboxRecovery} from '../main/inbox-recovery.mjs';
it('pauses observers, clears an old notice, refreshes on wake and detaches on quit',async()=>{
 const powerMonitor=new EventEmitter(),lifecycle={suspend:vi.fn(),resume:vi.fn()},discovery={suspend:vi.fn(),resume:vi.fn().mockResolvedValue({})};
 const notifier={seen:vi.fn()},companion={collapse:vi.fn(),reposition:vi.fn()};
 const recovery=installInboxRecovery({powerMonitor,lifecycle,discovery,notifier,companion});
 powerMonitor.emit('suspend');expect(lifecycle.suspend).toHaveBeenCalledTimes(1);expect(discovery.suspend).toHaveBeenCalledTimes(1);expect(notifier.seen).toHaveBeenCalledTimes(1);expect(companion.collapse).toHaveBeenCalledTimes(1);
 powerMonitor.emit('resume');await Promise.resolve();expect(lifecycle.resume).toHaveBeenCalledTimes(1);expect(discovery.resume).toHaveBeenCalledTimes(1);expect(companion.reposition).toHaveBeenCalledTimes(1);
 recovery.stop();recovery.stop();powerMonitor.emit('suspend');powerMonitor.emit('resume');expect(lifecycle.resume).toHaveBeenCalledTimes(1);expect(powerMonitor.listenerCount('resume')).toBe(0);
});
it('installs read-only recovery outside the worker-start gate',()=>{
 const main=fs.readFileSync('main/main.mjs','utf8');
 expect(main).toContain('installInboxRecovery({ powerMonitor, lifecycle: lifecycleMonitor, discovery: threadDiscovery, notifier, companion })');
 expect(main.indexOf('installInboxRecovery({ powerMonitor')).toBeGreaterThan(main.indexOf('await companion.load()'));
 expect(main).toContain("app.on('before-quit', () => inboxRecovery.stop())");
});
