// Supported read-only libproc inspection. No arguments, environment, cwd,
// signals, monitoring commands, privileged helper or process modifications.
#include "NativeProcess.h"
#include <libproc.h>
#include <string.h>
#include <unistd.h>
int ai_list_pids(int32_t *pids, int capacity) {
    if (!pids || capacity <= 0 || capacity > 65536) return 0;
    int bytes = proc_listpids(PROC_ALL_PIDS, 0, pids, capacity * (int)sizeof(int32_t));
    return bytes > 0 ? bytes / (int)sizeof(int32_t) : 0;
}
int ai_process(int32_t pid, AIProcess *out) {
    if (pid <= 1 || !out) return 0;
    struct proc_bsdinfo first = {0}, last = {0};
    if (proc_pidinfo(pid, PROC_PIDTBSDINFO, 0, &first, sizeof(first)) != sizeof(first) || first.pbi_uid != getuid()) return 0;
    memset(out, 0, sizeof(*out));
    out->pid = pid; out->parent = first.pbi_ppid;
    out->started = first.pbi_start_tvsec * 1000000ULL + first.pbi_start_tvusec;
    proc_name(pid, out->name, sizeof(out->name));
    proc_pidpath(pid, out->path, sizeof(out->path));
    if (proc_pidinfo(pid, PROC_PIDTBSDINFO, 0, &last, sizeof(last)) != sizeof(last)) return 0;
    return out->started > 0 && last.pbi_uid == first.pbi_uid && last.pbi_start_tvsec == first.pbi_start_tvsec && last.pbi_start_tvusec == first.pbi_start_tvusec;
}
