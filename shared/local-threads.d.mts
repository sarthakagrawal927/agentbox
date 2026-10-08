export interface DiscoveredThread { key: string; id: string; source: 'terminal' | 'desktop' | 'codex'; title: string; folderName: string; when: number }
export function threadKey(thread: {id?: string; source?: string}): string | null;
export function safeThreadLabel(value: unknown, limit?: number): string;
export function visibleDiscoveredThreads(threads?: unknown[], options?: {items?: unknown[]; agents?: unknown[]; ownedSessions?: unknown[]}): DiscoveredThread[];
export function selectThreadKeys<T>(threads: T[], keys: string[]): T[];
