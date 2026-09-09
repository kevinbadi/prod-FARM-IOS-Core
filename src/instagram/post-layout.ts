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
 * Photos Recents is newest-first. Just-imported items land in cells 0..count-1.
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
