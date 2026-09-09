export interface Point { x: number; y: number }
export interface InstagramCoordinates {
    passcodeKeypad: { columnX: [number, number, number]; rowY: [number, number, number, number] };
    instagram: {
        profileTab: Point; homeTab: Point; accountSwitcher: Point; create: Point; postContent: Point; upload: Point;
        selectMultiple: Point; useLayout: Point;
        picker: { circleX: number; columnStep: number; firstY: number; trayY: number; rowStep: number; cellX: number; cellStep: number; cellY: number };
        pickerNext: Point; editorNext: Point; caption: Point; keyboardBack: Point; draft: Point; finish: Point;
        like: Point; save: Point; followingTab: Point; reelsTab: Point; comment: Point; commentComposer: Point; commentSend: Point;
        swipe: { x: number; startY: number; endY: number; durationMs: number };
    };
}

export const DEVICE_COORDINATES = {
    iphone8: {
        passcodeKeypad: { columnX: [103, 191, 275], rowY: [220, 347, 425, 506] },
        instagram: {
            profileTab: { x: 337, y: 650 }, homeTab: { x: 37, y: 650 }, accountSwitcher: { x: 48, y: 72 },
            create: { x: 187, y: 650 }, postContent: { x: 70, y: 580 }, upload: { x: 70, y: 620 }, selectMultiple: { x: 340, y: 70 },
            useLayout: { x: 187, y: 520 },
            picker: { circleX: 62, columnStep: 125, firstY: 180, trayY: 400, rowStep: 125, cellX: 62, cellStep: 125, cellY: 180 },
            pickerNext: { x: 340, y: 70 }, editorNext: { x: 340, y: 70 }, caption: { x: 100, y: 200 },
            keyboardBack: { x: 22, y: 42 }, draft: { x: 80, y: 70 }, finish: { x: 340, y: 70 },
            like: { x: 345, y: 360 }, save: { x: 345, y: 500 },
            followingTab: { x: 95, y: 78 }, reelsTab: { x: 262, y: 650 }, comment: { x: 345, y: 430 },
            commentComposer: { x: 140, y: 600 }, commentSend: { x: 340, y: 600 },
            swipe: { x: 187, startY: 550, endY: 180, durationMs: 450 },
        },
    },
    // Keep in sync with src/devices/coordinates.ts.
    iphone17pro: {
        passcodeKeypad: { columnX: [110, 205, 295], rowY: [288, 455, 557, 663] },
        instagram: {
            profileTab: { x: 361, y: 852 }, homeTab: { x: 40, y: 852 }, accountSwitcher: { x: 51, y: 94 },
            create: { x: 206, y: 825 }, postContent: { x: 75, y: 760 }, upload: { x: 75, y: 812 }, selectMultiple: { x: 364, y: 92 },
            useLayout: { x: 200, y: 681 },
            picker: { circleX: 66, columnStep: 134, firstY: 236, trayY: 524, rowStep: 164, cellX: 66, cellStep: 134, cellY: 236 },
            pickerNext: { x: 364, y: 92 }, editorNext: { x: 348, y: 825 }, caption: { x: 107, y: 262 },
            keyboardBack: { x: 24, y: 55 }, draft: { x: 86, y: 92 }, finish: { x: 364, y: 92 },
            like: { x: 372, y: 470 }, save: { x: 372, y: 640 },
            followingTab: { x: 72, y: 96 }, reelsTab: { x: 281, y: 852 }, comment: { x: 372, y: 555 },
            commentComposer: { x: 150, y: 786 }, commentSend: { x: 364, y: 786 },
            swipe: { x: 130, startY: 721, endY: 197, durationMs: 380 },
        },
    },
} satisfies Record<string, InstagramCoordinates>;

export type CoordinateProfile = keyof typeof DEVICE_COORDINATES;
export function coordinatesForProfile(profile = 'iphone8'): InstagramCoordinates {
    if (!(profile in DEVICE_COORDINATES)) throw new Error(`Unknown Instagram coordinate profile "${profile}"`);
    return DEVICE_COORDINATES[profile as CoordinateProfile];
}
