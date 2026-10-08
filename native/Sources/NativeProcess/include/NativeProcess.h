#include <stdint.h>
typedef struct {
    int32_t pid, parent;
    uint64_t started;
    char name[256], path[4096];
} AIProcess;
int ai_process(int32_t pid, AIProcess *out);
int ai_list_pids(int32_t *pids, int capacity);
