import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../native/awake/',import.meta.url));
export function bundleAwakeHelper({binary,output}) {
 if(fs.existsSync(output))throw Error('Keep-awake bundle output already exists.');
 const macos=path.join(output,'Contents','MacOS'),resources=path.join(output,'Contents','Resources');
 fs.mkdirSync(macos,{recursive:true});fs.mkdirSync(resources,{recursive:true});
 fs.copyFileSync(binary,path.join(macos,'AgentInboxAwake'));
 fs.copyFileSync(path.join(root,'scripts','backstop.sh'),path.join(resources,'backstop.sh'));
 fs.copyFileSync(path.join(root,'LICENSE'),path.join(resources,'LICENSE'));
 fs.copyFileSync(path.join(root,'UPSTREAM.md'),path.join(resources,'UPSTREAM.md'));
 fs.writeFileSync(path.join(output,'Contents','Info.plist'),`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>AgentInboxAwake</string>
<key>CFBundleIdentifier</key><string>com.agentinbox.awake</string>
<key>CFBundleName</key><string>Agent Inbox Keep Awake</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>0.1.0</string>
<key>CFBundleVersion</key><string>1</string>
<key>LSMinimumSystemVersion</key><string>26.0</string>
<key>LSUIElement</key><true/>
<key>NSPrincipalClass</key><string>NSApplication</string>
<key>InsomniaResumeFrozenVersion</key><integer>1</integer>
<key>NSHumanReadableCopyright</key><string>Includes Insomnia, Copyright 2026 Krish Garg, MIT License.</string>
</dict></plist>`);
 execFileSync('/usr/bin/codesign',['--force','--sign','-',output],{stdio:'inherit'});
 execFileSync('/usr/bin/codesign',['--verify','--strict',output],{stdio:'inherit'});
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)&&process.platform==='darwin') {
 execFileSync('swift',['build','--package-path',root,'--configuration','release','--arch','arm64'],{stdio:'inherit',timeout:240000});
 const candidates=['.build/arm64-apple-macosx/release/AgentInboxAwake','.build/release/AgentInboxAwake','.build/out/Products/Release/AgentInboxAwake'];
 const binary=candidates.map(candidate=>path.join(root,candidate)).find(candidate=>fs.existsSync(candidate));
 if(!binary)throw Error('Keep-awake helper was not built.');
 const bin=path.join(root,'bin');fs.mkdirSync(bin,{recursive:true});
 const staging=fs.mkdtempSync(path.join(bin,'.stage-'));
 const output=path.join(staging,'AgentInboxAwake.app');bundleAwakeHelper({binary,output});
 const destination=path.join(bin,'AgentInboxAwake.app');
 // These are disposable build artifacts only. An installed helper is never
 // replaced by this script or by the application build.
 if(fs.existsSync(destination))fs.renameSync(destination,path.join(staging,'previous.app'));
 fs.renameSync(output,destination);
 console.log('Prepared Agent Inbox keep-awake helper.');
}
