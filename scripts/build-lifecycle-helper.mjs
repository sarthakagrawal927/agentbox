// Reproducible desktop build preparation; compilation alone does not sign,
// package, install or release the application. No third-party Swift packages.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
if (process.platform !== 'darwin') process.exit(0);
const root = fileURLToPath(new URL('../', import.meta.url));
const native = path.join(root, 'native');
// SwiftPM's multiple-architecture build may use the Xcode build engine. Pin
// the deployment target explicitly rather than silently raising it to this SDK.
execFileSync('swift', ['build', '--package-path', native, '--configuration', 'release', '--arch', 'arm64', '--arch', 'x86_64'], {
  cwd: root, env: { ...process.env, MACOSX_DEPLOYMENT_TARGET: '13.0' }, stdio: 'inherit', timeout: 180_000,
});
const binary = ['.build/release/AgentInboxLifecycle', '.build/out/Products/Release/AgentInboxLifecycle', '.build/apple/Products/Release/AgentInboxLifecycle'].map(p => path.join(native, p)).find(p => fs.existsSync(p));
if (!binary) throw Error('The native lifecycle receiver was not built.');
const description = execFileSync('/usr/bin/file', [binary], { encoding: 'utf8' });
if (!description.includes('arm64') || !description.includes('x86_64')) throw Error('The lifecycle receiver must contain both desktop architectures.');
const loadCommands = execFileSync('/usr/bin/otool', ['-arch', 'all', '-l', binary], { encoding: 'utf8' });
const minimumVersions = [...loadCommands.matchAll(/^\s*minos\s+(\d+(?:\.\d+){0,2})\s*$/gm)].map(match => match[1]);
if (minimumVersions.length !== 2 || minimumVersions.some(version => !/^13\.0(?:\.0)?$/.test(version))) {
  throw Error('Both lifecycle receiver slices must support macOS 13.0.');
}
fs.mkdirSync(path.join(native, 'bin'), { recursive: true });
fs.copyFileSync(binary, path.join(native, 'bin', 'AgentInboxLifecycle'));
console.log('Prepared universal native lifecycle receiver.');
