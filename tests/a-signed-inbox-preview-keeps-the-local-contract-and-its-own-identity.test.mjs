// The old release command packages upstream Agentbox. A downloadable Inbox
// preview must keep the local entry point, disable telemetry/update publishing,
// and carry the exact signing team and source revision declared for it.
import {it,expect} from 'vitest';
import {inboxReleaseConfig,verifyPreviewManifest} from '../scripts/release-inbox.mjs';

const identity={bundleId:'com.example.agentinbox',developerIdTeamId:'ABCDE12345',updateFeed:'example/agent-inbox'};
it('keeps the local app contract while requiring Developer ID signing',()=>{
 const config=inboxReleaseConfig({output:'/disposable/output',identity,certificate:'Developer ID Application: Example (ABCDE12345)',revision:'a'.repeat(40)});
 expect(config).toMatchObject({appId:identity.bundleId,productName:'Agent Inbox',publish:null,forceCodeSigning:true,
  extraMetadata:{main:'main/local-inbox.mjs',productName:'Agent Inbox',bakedPosthogKey:null,releaseRevision:'a'.repeat(40)},
  mac:{identity:'Developer ID Application: Example (ABCDE12345)',hardenedRuntime:true,notarize:false},dmg:{title:'Agent Inbox'}});
});
it('refuses a signing certificate from a different team',()=>{
 expect(()=>inboxReleaseConfig({output:'/x',identity,certificate:'Developer ID Application: Example (ZZZZZ99999)',revision:'a'.repeat(40)})).toThrow(/team/i);
});
it('refuses manifests that would mislabel signing, revision or qualification',()=>{
 const manifest={version:'0.1.12',revision:'a'.repeat(40),bundleId:identity.bundleId,teamId:identity.developerIdTeamId,
  repository:identity.updateFeed,channel:'preview',notarized:false,physicalLidTested:false,assets:[{name:'Agent-Inbox-0.1.12-arm64.zip',sha256:'b'.repeat(64),bytes:12}]};
 expect(verifyPreviewManifest(manifest,{identity,version:'0.1.12',revision:'a'.repeat(40)})).toBe(true);
 for(const bad of [{...manifest,channel:'stable'},{...manifest,revision:'c'.repeat(40)},{...manifest,teamId:'ZZZZZ99999'},{...manifest,notarized:true},{...manifest,physicalLidTested:true}]){
  expect(()=>verifyPreviewManifest(bad,{identity,version:'0.1.12',revision:'a'.repeat(40)})).toThrow();
 }
});
