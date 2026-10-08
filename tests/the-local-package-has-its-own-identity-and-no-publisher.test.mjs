import {it,expect} from 'vitest';
const pack=await import('../scripts/pack-local-inbox.mjs').catch(()=>({}));
it('packages the local entry point without signing or publishing upstream',()=>{
 expect(typeof pack.localPackageConfig).toBe('function');
 const config=pack.localPackageConfig('/disposable/new-output');
 expect(config).toMatchObject({appId:'com.significanthobbies.agentinbox.local',productName:'Agent Inbox',publish:null,
  extraMetadata:{main:'main/local-inbox.mjs',productName:'Agent Inbox'},mac:{identity:null,notarize:false},directories:{output:'/disposable/new-output'}});
 expect(config.extraResources).toContainEqual({from:'native/bin/AgentInboxLifecycle',to:'native/AgentInboxLifecycle'});
 expect(config.files).toContain('LICENSE');
});
it('names Agent Inbox in the macOS privacy prompts',()=>{
 const info=pack.localPackageConfig('/disposable/new-output').mac.extendInfo;
 for(const [key,value] of Object.entries(info)){
  if(key.endsWith('UsageDescription')){
   expect(value).toContain('Agent Inbox');
   expect(value).not.toContain('Agentbox');
  }
 }
});
it('declares macOS 13 because the bundled lifecycle helper requires it',()=>{
 expect(pack.localPackageConfig('/disposable/new-output').mac.minimumSystemVersion).toBe('13.0');
});
