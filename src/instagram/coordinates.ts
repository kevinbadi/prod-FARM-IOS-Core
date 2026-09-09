export interface Point { x: number; y: number }
export interface InstagramCoordinates {
    passcodeKeypad: { columnX: [number, number, number]; rowY: [number, number, number, number] };
    instagram: {
        profileTab: Point; homeTab: Point; accountSwitcher: Point; create: Point; upload: Point;
        selectMultiple: Point; useLayout: Point;
        picker: { circleX: number; columnStep: number; firstY: number; trayY: number; rowStep: number; cellX: number; cellStep: number; cellY: number };
        pickerNext: Point; editorNext: Point; caption: Point; keyboardBack: Point; draft: Point; finish: Point;
        like: Point; save: Point; followingTab: Point; comment: Point; commentComposer: Point; commentSend: Point;
        swipe: { x: number; startY: number; endY: number; durationMs: number };
    };
}

export const DEVICE_COORDINATES = {
    iphone8: {
        passcodeKeypad: { columnX: [103, 191, 275], rowY: [220, 347, 425, 506] },
        instagram: {
            profileTab: { x: 337, y: 650 }, homeTab: { x: 37, y: 650 }, accountSwitcher: { x: 48, y: 72 },
            create: { x: 187, y: 650 }, upload: { x: 70, y: 620 }, selectMultiple: { x: 340, y: 70 },
            useLayout: { x: 187, y: 520 },
            picker: { circleX: 62, columnStep: 125, firstY: 180, trayY: 400, rowStep: 125, cellX: 62, cellStep: 125, cellY: 180 },
            pickerNext: { x: 340, y: 70 }, editorNext: { x: 340, y: 70 }, caption: { x: 100, y: 200 },
            keyboardBack: { x: 22, y: 42 }, draft: { x: 80, y: 70 }, finish: { x: 340, y: 70 },
            like: { x: 50, y: 520 }, save: { x: 50, y: 580 },
            followingTab: { x: 95, y: 78 }, comment: { x: 100, y: 520 },
            commentComposer: { x: 140, y: 600 }, commentSend: { x: 340, y: 600 },
            swipe: { x: 187, startY: 550, endY: 180, durationMs: 450 },
        },
    },
    // Keep in sync with src/devices/coordinates.ts.
    iphone17pro: {
        passcodeKeypad: { columnX: [110, 205, 295], rowY: [288, 455, 557, 663] },
        instagram: {
            profileTab: { x: 361, y: 852 }, homeTab: { x: 40, y: 852 }, accountSwitcher: { x: 51, y: 94 },
            create: { x: 200, y: 852 }, upload: { x: 75, y: 812 }, selectMultiple: { x: 364, y: 92 },
            useLayout: { x: 200, y: 681 },
            picker: { circleX: 66, columnStep: 134, firstY: 236, trayY: 524, rowStep: 164, cellX: 66, cellStep: 134, cellY: 236 },
            pickerNext: { x: 364, y: 92 }, editorNext: { x: 364, y: 92 }, caption: { x: 107, y: 262 },
            keyboardBack: { x: 24, y: 55 }, draft: { x: 86, y: 92 }, finish: { x: 364, y: 92 },
            like: { x: 54, y: 681 }, save: { x: 54, y: 760 },
            followingTab: { x: 102, y: 102 }, comment: { x: 107, y: 681 },
            commentComposer: { x: 150, y: 786 }, commentSend: { x: 364, y: 786 },
            swipe: { x: 200, startY: 721, endY: 236, durationMs: 450 },
        },
    },
} satisfies Record<string, InstagramCoordinates>;

export type CoordinateProfile = keyof typeof DEVICE_COORDINATES;
export function coordinatesForProfile(profile = 'iphone8'): InstagramCoordinates {
    if (!(profile in DEVICE_COORDINATES)) throw new Error(`Unknown Instagram coordinate profile "${profile}"`);
    return DEVICE_COORDINATES[profile as CoordinateProfile];
}
