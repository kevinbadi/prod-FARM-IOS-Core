export interface Point { x: number; y: number }
export interface TikTokCoordinates {
    passcodeKeypad: { columnX: [number, number, number]; rowY: [number, number, number, number] };
    tiktok: {
        profileTab: Point; homeTab: Point; accountSwitcher: Point; create: Point; postContent: Point; upload: Point;
        selectMultiple: Point; useLayout: Point;
        picker: { circleX: number; columnStep: number; firstY: number; trayY: number; rowStep: number; cellX: number; cellStep: number; cellY: number };
        pickerNext: Point; editorNext: Point; caption: Point; keyboardBack: Point; draft: Point; finish: Point;
        like: Point; save: Point; followingTab: Point; comment: Point; commentComposer: Point; commentSend: Point;
        liveClose: Point;
        swipe: { x: number; startY: number; endY: number; durationMs: number };
    };
}

export const DEVICE_COORDINATES = {
    iphone8: {
        passcodeKeypad: { columnX: [103, 191, 275], rowY: [220, 347, 425, 506] },
        tiktok: {
            profileTab: { x: 338, y: 656 }, homeTab: { x: 38, y: 653 }, accountSwitcher: { x: 185, y: 158 },
            create: { x: 187, y: 640 }, postContent: { x: 187, y: 640 }, upload: { x: 30, y: 635 }, selectMultiple: { x: 24, y: 618 },
            useLayout: { x: 24, y: 489 },
            picker: { circleX: 106, columnStep: 126, firstY: 482, trayY: 360, rowStep: 125, cellX: 62, cellStep: 125, cellY: 526 },
            pickerNext: { x: 277, y: 617 }, editorNext: { x: 277, y: 637 }, caption: { x: 120, y: 236 },
            keyboardBack: { x: 22, y: 42 }, draft: { x: 98, y: 630 }, finish: { x: 277, y: 630 },
            like: { x: 345, y: 313 }, save: { x: 345, y: 444 },
            followingTab: { x: 95, y: 78 }, comment: { x: 345, y: 378 },
            commentComposer: { x: 140, y: 620 }, commentSend: { x: 340, y: 620 },
            liveClose: { x: 351, y: 70 },
            swipe: { x: 187, startY: 550, endY: 150, durationMs: 450 },
        },
    },
    // Keep in sync with src/devices/coordinates.ts (scaled seed for 390×844).
    iphone13: {
        passcodeKeypad: { columnX: [107, 199, 286], rowY: [278, 439, 538, 640] },
        tiktok: {
            profileTab: { x: 352, y: 830 }, homeTab: { x: 40, y: 826 }, accountSwitcher: { x: 192, y: 200 },
            create: { x: 194, y: 810 }, postContent: { x: 194, y: 810 }, upload: { x: 31, y: 804 }, selectMultiple: { x: 25, y: 782 },
            useLayout: { x: 25, y: 619 },
            picker: { circleX: 110, columnStep: 131, firstY: 610, trayY: 456, rowStep: 158, cellX: 64, cellStep: 130, cellY: 666 },
            pickerNext: { x: 288, y: 781 }, editorNext: { x: 288, y: 806 }, caption: { x: 125, y: 299 },
            keyboardBack: { x: 23, y: 53 }, draft: { x: 102, y: 797 }, finish: { x: 288, y: 797 },
            like: { x: 359, y: 396 }, save: { x: 359, y: 562 },
            followingTab: { x: 99, y: 99 }, comment: { x: 359, y: 478 },
            commentComposer: { x: 146, y: 785 }, commentSend: { x: 354, y: 785 },
            liveClose: { x: 365, y: 89 },
            swipe: { x: 194, startY: 696, endY: 190, durationMs: 450 },
        },
    },
    // Keep in sync with src/devices/coordinates.ts (scaled seed for 402×874).
    iphone17pro: {
        passcodeKeypad: { columnX: [110, 205, 295], rowY: [288, 455, 557, 663] },
        tiktok: {
            profileTab: { x: 362, y: 860 }, homeTab: { x: 41, y: 856 }, accountSwitcher: { x: 198, y: 207 },
            create: { x: 206, y: 818 }, postContent: { x: 206, y: 818 }, upload: { x: 32, y: 832 }, selectMultiple: { x: 26, y: 810 },
            useLayout: { x: 26, y: 641 },
            picker: { circleX: 114, columnStep: 135, firstY: 631, trayY: 472, rowStep: 164, cellX: 66, cellStep: 135, cellY: 689 },
            pickerNext: { x: 297, y: 809 }, editorNext: { x: 297, y: 835 }, caption: { x: 129, y: 309 },
            keyboardBack: { x: 24, y: 55 }, draft: { x: 105, y: 826 }, finish: { x: 297, y: 826 },
            like: { x: 372, y: 455 }, save: { x: 372, y: 575 },
            followingTab: { x: 163, y: 88 }, comment: { x: 370, y: 552 },
            commentComposer: { x: 150, y: 812 }, commentSend: { x: 364, y: 812 },
            liveClose: { x: 385, y: 62 },
            swipe: { x: 130, startY: 721, endY: 197, durationMs: 380 },
        },
    },
} satisfies Record<string, TikTokCoordinates>;

export type CoordinateProfile = keyof typeof DEVICE_COORDINATES;
export function coordinatesForProfile(profile = 'iphone8'): TikTokCoordinates {
    if (!(profile in DEVICE_COORDINATES)) throw new Error(`Unknown TikTok coordinate profile "${profile}"`);
    return DEVICE_COORDINATES[profile as CoordinateProfile];
}
