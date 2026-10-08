// Exercise build preparation without compiling or copying an artifact. A newer
// host SDK must not turn a supported desktop installation into a silent failure.
import {it,expect,vi,beforeEach} from 'vitest';
const fake=vi.hoisted(()=>({copy:vi.fn(),exec:vi.fn(),minos:'13.0'}));
vi.mock('node:fs',()=>({default:{existsSync:()=>true,mkdirSync:vi.fn(),copyFileSync:fake.copy}}));
vi.mock('node:child_process',()=>({execFileSync:fake.exec}));
beforeEach(()=>{
 vi.resetModules();fake.copy.mockClear();fake.exec.mockReset();fake.minos='13.0';
 fake.exec.mockImplementation(command=>command==='/usr/bin/file'?'Mach-O universal binary: arm64 x86_64':command==='/usr/bin/otool'?`Load command 10\n      cmd LC_BUILD_VERSION\n    minos ${fake.minos}\nLoad command 10\n      cmd LC_BUILD_VERSION\n    minos 13.0\n`:'');
});
it.runIf(process.platform==='darwin')('rejects a helper requiring a newer macOS before it is copied into the app',async()=>{
 fake.minos='27.0';
 await expect(import('../scripts/build-lifecycle-helper.mjs')).rejects.toThrow(/macOS 13/);
 expect(fake.copy).not.toHaveBeenCalled();
});
it.runIf(process.platform==='darwin')('accepts both supported slices and copies only the app receiver',async()=>{
 await import('../scripts/build-lifecycle-helper.mjs');
 const inspection=fake.exec.mock.calls.find(([command])=>command==='/usr/bin/otool');
 expect(inspection?.[1].slice(0,3)).toEqual(['-arch','all','-l']);
 expect(inspection?.[1][3]).toContain('AgentInboxLifecycle');
 expect(fake.copy).toHaveBeenCalledTimes(1);
 expect(fake.copy.mock.calls[0][1]).toMatch(/native\/bin\/AgentInboxLifecycle$/);
});
