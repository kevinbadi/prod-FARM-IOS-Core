export const COLD_DMS_MAX_HANDLES = 25;
export const COLD_DMS_MAX_MESSAGE_LENGTH = 1000;

const HANDLE_PATTERN = /^@[A-Za-z0-9._]{1,64}$/;

/** Normalize pasted handle lists (newlines, commas, spaces) into unique @handles. */
export function parseColdDmHandles(raw: string): string[] {
    const tokens = raw
        .split(/[\n,]+/)
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => (value.startsWith('@') ? value : `@${value}`));
    const unique: string[] = [];
    const seen = new Set<string>();
    for (const handle of tokens) {
        const key = handle.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(handle);
    }
    return unique;
}

export function validateColdDmHandles(handles: string[]): string[] {
    if (handles.length < 1) throw new Error('Add at least one Instagram handle');
    if (handles.length > COLD_DMS_MAX_HANDLES) {
        throw new Error(`Choose at most ${COLD_DMS_MAX_HANDLES} handles per run`);
    }
    for (const handle of handles) {
        if (!HANDLE_PATTERN.test(handle)) {
            throw new Error(`Invalid Instagram handle "${handle}"`);
        }
    }
    return handles;
}

export function validateColdDmMessage(message: string): string {
    const trimmed = message.trim();
    if (!trimmed) throw new Error('Message text is required');
    if (trimmed.length > COLD_DMS_MAX_MESSAGE_LENGTH) {
        throw new Error(`Message must be ${COLD_DMS_MAX_MESSAGE_LENGTH} characters or fewer`);
    }
    return trimmed;
}
