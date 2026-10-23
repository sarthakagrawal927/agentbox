// Developer ID-signed, manually installed Inbox previews. This path retains
// the local product contract and never reads provider or analytics credentials.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {z} from 'zod';
import {localPackageConfig} from './pack-local-inbox.mjs';
import {checkReleaseIdentity,readReleaseIdentity} from './lib/release-identity.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const sha256=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const previewManifest=z.object({
 version:z.string().regex(/^\d+\.\d+\.\d+$/),revision:z.string().regex(/^[a-f0-9]{40}$/),
 bundleId:z.string(),teamId:z.string(),repository:z.string(),channel:z.literal('preview'),
 notarized:z.literal(false),physicalLidTested:z.literal(false),
 assets:z.array(z.object({name:z.string().regex(/^Agent-Inbox-[A-Za-z0-9.-]+\.(zip|dmg)$/),sha256:z.string().regex(/^[a-f0-9]{64}$/),bytes:z.number().int().positive()})).min(1),
});

export function inboxReleaseConfig({output,identity,certificate,revision}) {
 if(!checkReleaseIdentity(identity).ok)throw Error('Agent Inbox release identity is not configured.');
 if(!certificate.endsWith(` (${identity.developerIdTeamId})`))throw Error('The signing certificate does not match the configured Developer ID team.');
 if(!/^[a-f0-9]{40}$/.test(revision))throw Error('Release source revision must be a full commit ID.');
 const base=localPackageConfig(output);
 return {...base,appId:identity.bundleId,forceCodeSigning:true,
  artifactName:'Agent-Inbox-${version}-arm64.${ext}',
  extraMetadata:{...base.extraMetadata,releaseRevision:revision},
  mac:{...base.mac,identity:certificate,hardenedRuntime:true,notarize:false},
  dmg:{...base.dmg,title:'Agent Inbox'}};
}

export function verifyPreviewManifest(value,{identity,version,revision}) {
 const manifest=previewManifest.parse(value);
 if(manifest.version!==version||manifest.revision!==revision||manifest.bundleId!==identity.bundleId||manifest.teamId!==identity.developerIdTeamId||manifest.repository!==identity.updateFeed)throw Error('The preview manifest does not match this source, version and release identity.');
 return true;
}

function execute(file,args,options={}) {
 return execFileSync(file,args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:180000,...options});
}
function signingCertificate(team) {
 const identities=execute('/usr/bin/security',['find-identity','-v','-p','codesigning']);
 const matches=[...identities.matchAll(/"(Developer ID Application: .+? \(([A-Z0-9]{10})\))"/g)].filter(match=>match[2]===team);
 if(matches.length!==1)throw Error('Exactly one Developer ID Application certificate must match the configured team.');
 return matches[0][1];
}
function verifySignedApp(app,identity) {
 const requirement=`anchor apple generic and identifier "${identity.bundleId}" and certificate leaf[subject.OU] = "${identity.developerIdTeamId}"`;
 execute('/usr/bin/codesign',['--verify','--deep','--strict',`-R=${requirement}`,app]);
}

async function main() {
 const read=readReleaseIdentity(root);if(!read.ok)throw Error(read.problems.join('\n'));
 const identity=read.identity,version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
 if(execute('git',['status','--porcelain']).trim())throw Error('Commit source changes before building or publishing an Inbox preview.');
 const revision=execute('git',['rev-parse','HEAD']).trim(),tag=`inbox-v${version}`;
 const output=path.join(root,'release',tag),manifestPath=path.join(output,'preview-manifest.json');
 if(process.argv.includes('--publish')) {
  const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));verifyPreviewManifest(manifest,{identity,version,revision});
  for(const asset of manifest.assets){
   const file=path.join(output,asset.name);
   if(fs.statSync(file).size!==asset.bytes||sha256(file)!==asset.sha256)throw Error(`Release asset changed: ${asset.name}`);
  }
  verifySignedApp(path.join(output,'mac-arm64','Agent Inbox.app'),identity);
  const remote=execute('git',['ls-remote','origin','refs/heads/main']).split(/\s/)[0];
  if(remote!==revision)throw Error('Publish only the exact source revision on public main.');
  const repoInfo=JSON.parse(execute('gh',['repo','view',identity.updateFeed,'--json','nameWithOwner,isPrivate,viewerPermission']));
  if(repoInfo.nameWithOwner.toLowerCase()!==identity.updateFeed.toLowerCase()||repoInfo.isPrivate||!['ADMIN','MAINTAIN','WRITE'].includes(repoInfo.viewerPermission))throw Error('The preview release destination must be the configured public repository with write access.');
  const notes=path.join(output,'release-notes.md');
  fs.writeFileSync(notes,`Agent Inbox ${version} preview\n\nTimed lid-closed keep-awake sessions are integrated into Settings → Running. Includes explicit administrator setup, start/extend/end controls, battery and thermal guards, journaled restoration, and deadline recovery.\n\nDistribution: Developer ID-signed Apple silicon app; **not notarized**. macOS may require approval in Privacy & Security. Manual installation; automatic updates, telemetry and cloud teams are disabled. Keep-awake requires macOS 26 or later.\n\nPhysical lid-close and administrator-install qualification have not been completed. This preview is not qualified for unattended lid-closed use. Automated checks exercise native recovery, boundary cases, and the real recovery shell with fake power commands.\n\nSource: ${revision}. Full source and GPL-3.0-or-later license are in this repository at this release tag. Insomnia's MIT attribution is included in the helper.\n\nSHA-256 checksums are in SHA256SUMS; preview-manifest.json records the exact source and qualification limits.\n`);
  // Upload the complete set to a draft, then expose it in one final edit.
  execute('gh',['release','create',tag,'--repo',identity.updateFeed,'--target',revision,'--title',`Agent Inbox ${version} Preview`,'--notes-file',notes,'--prerelease','--draft']);
  execute('gh',['release','upload',tag,'--repo',identity.updateFeed,...manifest.assets.map(asset=>path.join(output,asset.name)),manifestPath,path.join(output,'SHA256SUMS')],{timeout:600000});
  execute('gh',['release','edit',tag,'--repo',identity.updateFeed,'--draft=false','--prerelease']);
  console.log(execute('gh',['release','view',tag,'--repo',identity.updateFeed,'--json','url','--jq','.url']).trim());
  return;
 }
 if(process.platform!=='darwin'||process.arch!=='arm64')throw Error('Build the Inbox preview on an Apple silicon Mac.');
 if(fs.existsSync(output))throw Error('This version already has a release directory. Preserve it and increment the version for another build.');
 const certificate=signingCertificate(identity.developerIdTeamId);
 execute('npm',['run','build'],{stdio:'inherit',timeout:600000});
 if(execute('git',['status','--porcelain']).trim())throw Error('Build preparation changed source files. Commit and verify those changes before packaging.');
 const helper=path.join(root,'native','awake','bin','AgentInboxAwake.app');
 execute('/usr/bin/codesign',['--force','--options','runtime','--timestamp','--sign',certificate,helper]);
 const {build,Platform,Arch}=await import('electron-builder');
 await build({targets:Platform.MAC.createTarget(['dmg','zip'],Arch.arm64),config:inboxReleaseConfig({output,identity,certificate,revision}),publish:'never',projectDir:root});
 const app=path.join(output,'mac-arm64','Agent Inbox.app');verifySignedApp(app,identity);
 for(const name of fs.readdirSync(output).filter(name=>name.endsWith('.dmg'))){
  const file=path.join(output,name);
  execute('/usr/bin/codesign',['--sign',certificate,'--timestamp',file]);
  execute('/usr/bin/codesign',['--verify','--strict',file]);
 }
 const assets=fs.readdirSync(output).filter(name=>/\.(zip|dmg)$/.test(name)).map(name=>({name,sha256:sha256(path.join(output,name)),bytes:fs.statSync(path.join(output,name)).size}));
 if(!assets.some(asset=>asset.name.endsWith('.zip'))||!assets.some(asset=>asset.name.endsWith('.dmg')))throw Error('The preview must include both a zip and a disk image.');
 const manifest={version,revision,bundleId:identity.bundleId,teamId:identity.developerIdTeamId,repository:identity.updateFeed,channel:'preview',notarized:false,physicalLidTested:false,assets};
 verifyPreviewManifest(manifest,{identity,version,revision});
 fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
 fs.writeFileSync(path.join(output,'SHA256SUMS'),assets.map(asset=>`${asset.sha256}  ${asset.name}`).join('\n')+'\n');
 console.log(`Built signed Inbox preview ${version}. Not notarized; physical lid-close qualification remains unverified.\n${manifestPath}`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main().catch(error=>{console.error(error.message);process.exitCode=1;});
