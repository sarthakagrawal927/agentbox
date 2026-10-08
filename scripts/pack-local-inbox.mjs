// Local review artifact only: never overwrites an installation, signs with an
// identity, reads private configuration, or publishes a release.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function localPackageConfig(output) {
 const base=JSON.parse(fs.readFileSync(path.join(repo,'package.json'),'utf8')).build;
 const extendInfo=Object.fromEntries(Object.entries(base.mac.extendInfo).map(([key,value])=>
  [key,key.endsWith('UsageDescription')?value.replaceAll('Agentbox','Agent Inbox'):value]));
 return {...base,appId:'com.significanthobbies.agentinbox.local',productName:'Agent Inbox',publish:null,
  directories:{...base.directories,output},
  files:[...base.files,'LICENSE','PRODUCT.md'],
  extraMetadata:{main:'main/local-inbox.mjs',productName:'Agent Inbox',bakedPosthogKey:null},
  forceCodeSigning:false,mac:{...base.mac,extendInfo,minimumSystemVersion:'13.0',identity:null,notarize:false}};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const output=path.join(repo,'release','local-inbox-'+new Date().toISOString().replace(/[:.]/g,'-'));
 if(fs.existsSync(output))throw Error('Local build output already exists.');
 process.env.CSC_IDENTITY_AUTO_DISCOVERY='false';
 const {build,Platform,Arch}=await import('electron-builder');
 await build({targets:Platform.MAC.createTarget('dir',process.arch==='arm64'?Arch.arm64:Arch.x64),config:localPackageConfig(output),publish:'never',projectDir:repo});
 console.log(JSON.stringify({output,app:path.join(output,process.arch==='arm64'?'mac-arm64':'mac','Agent Inbox.app'),signing:'unsigned',published:false}));
}
