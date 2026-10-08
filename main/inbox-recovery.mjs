// These are read-only observers, independent of provider worker recovery.
// Sleep cancels old evidence; waking obtains fresh data without starting agents.
export function installInboxRecovery({powerMonitor,lifecycle,discovery,notifier,companion}) {
  const suspend=()=>{lifecycle.suspend();discovery.suspend();notifier.seen();companion.collapse();};
  const resume=()=>{lifecycle.resume();void discovery.resume().catch(()=>{});companion.reposition();};
  powerMonitor.on('suspend',suspend);powerMonitor.on('resume',resume);
  return {stop(){powerMonitor.removeListener('suspend',suspend);powerMonitor.removeListener('resume',resume);}};
}
