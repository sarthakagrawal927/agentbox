// A helper upgrade must not replace the only copy that can restore a journal.
// Test the installer with fake OS commands and real temporary bundle copies.
import {it,expect,vi} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {installAwakeHelper,powerRule,awakeSupported} from '../main/keep-awake-setup.mjs';

it('requires Apple silicon and a supported macOS release',()=>{
 expect(awakeSupported({platform:'darwin',arch:'arm64',release:'25.0.0'})).toBe(true);
 for(const host of [{platform:'darwin',arch:'arm64',release:'24.9.0'},{platform:'darwin',arch:'x64',release:'25.0.0'},{platform:'linux',arch:'arm64',release:'26.0.0'}])expect(awakeSupported(host)).toBe(false);
});
it('grants only the four power commands to a validated local username',()=>{
 const rule=powerRule('testuser');expect(rule.match(/NOPASSWD:/g)).toHaveLength(1);
 expect(rule).toContain('/usr/bin/pmset -a disablesleep 1');expect(rule).toContain('/usr/bin/pmset -a disablesleep 0');
 expect(rule).toContain('/usr/bin/pmset -b lowpowermode 1');expect(rule).toContain('/usr/bin/pmset -b lowpowermode 0');
 expect(()=>powerRule('user\nALL=(ALL) ALL')).toThrow();expect(rule).not.toContain('NOPASSWD: ALL');
});
it('refuses to overwrite an existing helper and never requests administrator access',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'awake-setup-'));
 try{
  const source=path.join(dir,'source.app'),destination=path.join(dir,'installed.app');
  fs.mkdirSync(source);fs.mkdirSync(destination);
  const run=vi.fn();await expect(installAwakeHelper({source,destination,run,username:'testuser'})).rejects.toThrow(/already installed/i);
  expect(run).not.toHaveBeenCalled();expect(fs.existsSync(destination)).toBe(true);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
it('verifies the signed recovery bundle before showing the administrator prompt',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'awake-setup-'));
 try{
  const source=path.join(dir,'source.app');fs.mkdirSync(source);
  const run=vi.fn(async()=>{throw Error('signature invalid');});
  await expect(installAwakeHelper({source,destination:path.join(dir,'installed.app'),run,username:'testuser'})).rejects.toThrow(/signature invalid/);
  expect(run).toHaveBeenCalledTimes(1);expect(run.mock.calls[0][0]).toBe('/usr/bin/codesign');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
