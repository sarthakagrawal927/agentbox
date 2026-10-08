// A working source helper is not enough: desktop builds must prepare its
// universal binary and carry it outside asar, without new runtime dependencies.
import {it,expect} from 'vitest';import fs from 'node:fs';
it('prepares and packages the read-only receiver where desktop startup expects it',()=>{
 const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
 expect(pkg.scripts.build).toContain('build-lifecycle-helper.mjs');
 expect(pkg.build.extraResources).toContainEqual({from:'native/bin/AgentInboxLifecycle',to:'native/AgentInboxLifecycle'});
 expect(fs.readFileSync('main/main.mjs','utf8')).toContain("path.join(appDir, 'native', 'bin', 'AgentInboxLifecycle')");
 const script=fs.readFileSync('scripts/build-lifecycle-helper.mjs','utf8');expect(script).toContain("'--arch', 'arm64', '--arch', 'x86_64'");expect(script).toContain("MACOSX_DEPLOYMENT_TARGET: '13.0'");
 expect(fs.readFileSync('.gitignore','utf8')).toContain('native/bin/');
});
