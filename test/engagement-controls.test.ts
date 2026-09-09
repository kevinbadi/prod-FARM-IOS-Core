import assert from 'node:assert/strict';
import test from 'node:test';

import sharp from 'sharp';

import { detectEngagementControls } from '../src/tiktok/engagement-controls.js';

const HEART_PATH = 'M32 56C28 51 7 38 7 21C7 10 20 5 32 17C44 5 57 10 57 21C57 38 36 51 32 56Z';
const BOOKMARK_PATH = 'M13 6Q13 3 17 3H47Q51 3 51 7V59L32 47L13 59Z';

async function iconPng(path: string, size: number): Promise<Buffer> {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path fill="white" d="${path}"/></svg>`;
    return sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
}

async function composeRail(options: {
    width: number;
    height: number;
    iconSize: number;
    heart?: { x: number; y: number };
    bookmark?: { x: number; y: number };
    /** Bright circular blob (LIVE-style avatar decoy) in pixel coords. */
    avatar?: { x: number; y: number; radius: number };
}): Promise<Buffer> {
    const { width, height, iconSize } = options;
    const composites: { input: Buffer; left: number; top: number }[] = [];
    if (options.avatar) {
        const r = options.avatar.radius;
        const avatarSvg = Buffer.from(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${r * 2}" height="${r * 2}">`
                + `<circle cx="${r}" cy="${r}" r="${r}" fill="white"/></svg>`,
        );
        composites.push({
            input: await sharp(avatarSvg).png().toBuffer(),
            left: Math.round(options.avatar.x - r),
            top: Math.round(options.avatar.y - r),
        });
    }
    if (options.heart) {
        composites.push({
            input: await iconPng(HEART_PATH, iconSize),
            left: Math.round(options.heart.x - iconSize / 2),
            top: Math.round(options.heart.y - iconSize / 2),
        });
    }
    if (options.bookmark) {
        composites.push({
            input: await iconPng(BOOKMARK_PATH, iconSize),
            left: Math.round(options.bookmark.x - iconSize / 2),
            top: Math.round(options.bookmark.y - iconSize / 2),
        });
    }
    return sharp({
        create: { width, height, channels: 3, background: { r: 0, g: 0, b: 0 } },
    }).composite(composites).png().toBuffer();
}

test('seeded detect finds heart and bookmark near seeds', async () => {
    const scale = 2;
    const width = 800;
    const height = 1600;
    const likeSeed = { x: 370, y: 450 };
    const saveSeed = { x: 370, y: 580 };
    const iconSize = Math.max(42, Math.round(32 * scale));
    const screenshot = await composeRail({
        width,
        height,
        iconSize,
        heart: { x: likeSeed.x * scale + 6, y: likeSeed.y * scale - 4 },
        bookmark: { x: saveSeed.x * scale - 2, y: saveSeed.y * scale + 8 },
    });

    const detected = await detectEngagementControls(screenshot, scale, {
        like: likeSeed,
        save: saveSeed,
    });
    assert.ok(detected, 'expected seeded detection to succeed');
    assert.ok(Math.abs(detected!.like.x - likeSeed.x) <= 20, `like.x=${detected!.like.x}`);
    assert.ok(Math.abs(detected!.like.y - likeSeed.y) <= 20, `like.y=${detected!.like.y}`);
    assert.ok(Math.abs(detected!.save.x - saveSeed.x) <= 20, `save.x=${detected!.save.x}`);
    assert.ok(Math.abs(detected!.save.y - saveSeed.y) <= 20, `save.y=${detected!.save.y}`);
    assert.ok(detected!.confidence >= 0.72);
});

test('seeded detect rejects heart matches too far above the like seed', async () => {
    const scale = 2;
    const width = 800;
    const height = 1600;
    const likeSeed = { x: 370, y: 450 };
    const saveSeed = { x: 370, y: 580 };
    const iconSize = Math.max(42, Math.round(32 * scale));
    // Heart inside the ±45pt seed window but >35pt above the seed so the
    // LIVE-avatar guard rejects it; bookmark remains near the save seed.
    const screenshot = await composeRail({
        width,
        height,
        iconSize,
        heart: { x: likeSeed.x * scale, y: (likeSeed.y - 40) * scale },
        bookmark: { x: saveSeed.x * scale, y: saveSeed.y * scale },
        avatar: { x: likeSeed.x * scale, y: (likeSeed.y - 42) * scale, radius: 28 },
    });

    const detected = await detectEngagementControls(screenshot, scale, {
        like: likeSeed,
        save: saveSeed,
    });
    assert.equal(detected, undefined, 'above-seed heart should be rejected');
});

test('seeded detect prefers the near-seed heart over an above-seed decoy', async () => {
    const scale = 2;
    const width = 800;
    const height = 1600;
    const likeSeed = { x: 370, y: 450 };
    const saveSeed = { x: 370, y: 580 };
    const iconSize = Math.max(42, Math.round(32 * scale));
    const screenshot = await composeRail({
        width,
        height,
        iconSize,
        heart: { x: likeSeed.x * scale, y: likeSeed.y * scale },
        bookmark: { x: saveSeed.x * scale, y: saveSeed.y * scale },
        avatar: { x: likeSeed.x * scale, y: (likeSeed.y - 50) * scale, radius: 30 },
    });

    const detected = await detectEngagementControls(screenshot, scale, {
        like: likeSeed,
        save: saveSeed,
    });
    assert.ok(detected, 'expected detection of the near-seed heart');
    assert.ok(Math.abs(detected!.like.y - likeSeed.y) <= 15, `like.y drifted to ${detected!.like.y}`);
});
