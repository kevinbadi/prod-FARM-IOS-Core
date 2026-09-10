export interface Point { x: number; y: number }
export interface InstagramCoordinates {
    passcodeKeypad: { columnX: [number, number, number]; rowY: [number, number, number, number] };
    instagram: {
        profileTab: Point; homeTab: Point; accountSwitcher: Point; create: Point; postContent: Point; upload: Point;
        selectMultiple: Point; useLayout: Point;
        picker: { circleX: number; columnStep: number; firstY: number; trayY: number; rowStep: number; cellX: number; cellStep: number; cellY: number };
        pickerNext: Point; editorNext: Point; caption: Point; keyboardBack: Point; draft: Point; finish: Point;
        like: Point; save: Point; followingTab: Point; reelsTab: Point;
        searchTab: Point; searchField: Point; searchFirstResult: Point; dmSearchSubmit: Point; profileMessage: Point;
        dmCompose: Point; composeNewMessage: Point; dmComposer: Point; dmSend: Point; dmBack: Point;
        comment: Point; commentComposer: Point; commentSend: Point;
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
            followingTab: { x: 95, y: 78 }, reelsTab: { x: 262, y: 650 },
            searchTab: { x: 112, y: 650 }, searchField: { x: 187, y: 90 }, searchFirstResult: { x: 100, y: 220 },
            dmSearchSubmit: { x: 340, y: 90 },
            profileMessage: { x: 280, y: 420 },
            dmCompose: { x: 187, y: 650 }, composeNewMessage: { x: 350, y: 55 },
            dmComposer: { x: 180, y: 620 }, dmSend: { x: 350, y: 620 }, dmBack: { x: 22, y: 42 },
            comment: { x: 345, y: 430 },
            commentComposer: { x: 140, y: 600 }, commentSend: { x: 340, y: 600 },
            swipe: { x: 187, startY: 550, endY: 180, durationMs: 450 },
        },
    },
    // Keep in sync with src/devices/coordinates.ts (390×844 seed).
    iphone13: {
        passcodeKeypad: { columnX: [107, 199, 286], rowY: [278, 439, 538, 640] },
        instagram: {
            profileTab: { x: 350, y: 823 }, homeTab: { x: 39, y: 797 }, accountSwitcher: { x: 50, y: 91 },
            create: { x: 200, y: 797 }, postContent: { x: 73, y: 734 }, upload: { x: 73, y: 785 }, selectMultiple: { x: 354, y: 89 },
            useLayout: { x: 194, y: 658 },
            picker: { circleX: 64, columnStep: 130, firstY: 228, trayY: 506, rowStep: 158, cellX: 64, cellStep: 130, cellY: 228 },
            pickerNext: { x: 354, y: 89 }, editorNext: { x: 354, y: 89 }, caption: { x: 104, y: 253 },
            keyboardBack: { x: 23, y: 53 }, draft: { x: 83, y: 89 }, finish: { x: 354, y: 89 },
            like: { x: 359, y: 456 }, save: { x: 359, y: 633 },
            followingTab: { x: 70, y: 93 }, reelsTab: { x: 129, y: 797 },
            searchTab: { x: 116, y: 797 }, searchField: { x: 194, y: 97 }, searchFirstResult: { x: 195, y: 222 },
            dmSearchSubmit: { x: 359, y: 97 },
            profileMessage: { x: 291, y: 531 },
            dmCompose: { x: 195, y: 797 }, composeNewMessage: { x: 367, y: 75 },
            dmComposer: { x: 155, y: 502 }, dmSend: { x: 349, y: 502 }, dmBack: { x: 23, y: 53 },
            comment: { x: 359, y: 544 },
            commentComposer: { x: 146, y: 759 }, commentSend: { x: 354, y: 759 },
            swipe: { x: 194, startY: 696, endY: 228, durationMs: 450 },
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
            followingTab: { x: 72, y: 96 }, reelsTab: { x: 281, y: 852 },
            searchTab: { x: 120, y: 852 }, searchField: { x: 200, y: 100 }, searchFirstResult: { x: 201, y: 230 },
            dmSearchSubmit: { x: 370, y: 100 },
            profileMessage: { x: 300, y: 520 },
            dmCompose: { x: 201, y: 825 }, composeNewMessage: { x: 378, y: 78 },
            dmComposer: { x: 160, y: 520 }, dmSend: { x: 360, y: 520 }, dmBack: { x: 24, y: 55 },
            comment: { x: 372, y: 555 },
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
