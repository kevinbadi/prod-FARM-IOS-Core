export interface PickerLayout {
    circleX: number;
    columnStep: number;
    firstY: number;
    trayY: number;
    rowStep: number;
}

export interface PickerTarget {
    x: number;
    y: number;
}

/**
 * Photos Recents (and TikTok's upload grid) is newest-first.
 * After WDA import-media, the just-imported items occupy cells 0..count-1
 * at the top of the grid — not the end of the library.
 */
export function recentPickerTargets(assetCount: number, count: number, layout: PickerLayout): PickerTarget[] {
    if (!Number.isSafeInteger(assetCount) || assetCount < count || count < 1) {
        throw new Error('Photos asset count cannot satisfy the requested media selection');
    }
    return Array.from({ length: count }, (_, selection) => {
        const row = Math.floor(selection / 3);
        return {
            x: layout.circleX + ((selection % 3) * layout.columnStep),
            y: layout.firstY + (row * layout.rowStep),
        };
    });
}
