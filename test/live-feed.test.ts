import assert from 'node:assert/strict';
import test from 'node:test';

import sharp from 'sharp';

import { detectTikTokLiveFeed } from '../src/tiktok/live-feed.js';
import { detectHomeFeedTab, identifyTikTokScreen } from '../src/tiktok/screen-identity.js';

async function solid(width: number, height: number, rgb: [number, number, number]): Promise<Buffer> {
    return sharp({
        create: { width, height, channels: 3, background: { r: rgb[0], g: rgb[1], b: rgb[2] } },
    }).png().toBuffer();
}

test('detectTikTokLiveFeed flags pink follow + dark gift bar as Live', async () => {
    const width = 402;
    const height = 874;
    const base = await sharp({
        create: { width, height, channels: 3, background: { r: 20, g: 20, b: 24 } },
    }).png().toBuffer();
    const pink = await solid(90, 28, [255, 45, 140]);
    const icon = await solid(18, 18, [240, 240, 240]);
    const composed = await sharp(base)
        .composite([
            { input: pink, left: 110, top: 90 },
            { input: icon, left: 250, top: 820 },
            { input: icon, left: 290, top: 820 },
            { input: icon, left: 330, top: 820 },
            { input: icon, left: 360, top: 820 },
        ])
        .png()
        .toBuffer();

    const result = await detectTikTokLiveFeed(composed, 1);
    assert.equal(result.isLive, true);
    assert.ok(result.confidence >= 0.7);
});

test('detectTikTokLiveFeed leaves a bright FYP-like frame alone', async () => {
    const fyp = await sharp({
        create: { width: 402, height: 874, channels: 3, background: { r: 90, g: 110, b: 140 } },
    }).png().toBuffer();
    const result = await detectTikTokLiveFeed(fyp, 1);
    assert.equal(result.isLive, false);
});

test('detectTikTokLiveFeed requires pink follow — dark icons alone are not Live', async () => {
    const width = 402;
    const height = 874;
    const base = await sharp({
        create: { width, height, channels: 3, background: { r: 18, g: 18, b: 22 } },
    }).png().toBuffer();
    const icon = await solid(20, 20, [245, 245, 245]);
    const composed = await sharp(base)
        .composite([
            { input: icon, left: 260, top: 820 },
            { input: icon, left: 300, top: 820 },
            { input: icon, left: 340, top: 820 },
            { input: icon, left: 370, top: 820 },
        ])
        .png()
        .toBuffer();
    const result = await detectTikTokLiveFeed(composed, 1);
    assert.equal(result.isLive, false);
});

test('identifyTikTokScreen treats unrecognized frames as off_feed (never assumed FYP)', async () => {
    const frame = await sharp({
        create: { width: 402, height: 874, channels: 3, background: { r: 100, g: 120, b: 150 } },
    }).png().toBuffer();
    const identity = await identifyTikTokScreen(frame, 1);
    assert.equal(identity.kind, 'off_feed');
});

test('identifyTikTokScreen flags springboard-like icon grids as off_feed', async () => {
    const width = 402;
    const height = 874;
    const base = await sharp({
        create: { width, height, channels: 3, background: { r: 28, g: 90, b: 160 } },
    }).png().toBuffer();
    const icon = await solid(36, 36, [240, 80, 60]);
    const composites = [];
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
            composites.push({
                input: icon,
                left: 40 + col * 90,
                top: 180 + row * 110,
            });
        }
    }
    const composed = await sharp(base).composite(composites).png().toBuffer();
    const identity = await identifyTikTokScreen(composed, 1);
    assert.equal(identity.kind, 'off_feed');
    assert.ok(identity.reasons.includes('springboard') || identity.reasons.includes('unrecognized'));
});

test('detectHomeFeedTab prefers the brighter top-tab label', async () => {
    const width = 402;
    const height = 874;
    // Dark video frame with bright "Following" strip on the left and dim "For You" on the right.
    const base = await sharp({
        create: { width, height, channels: 3, background: { r: 10, g: 10, b: 12 } },
    }).png().toBuffer();
    const bright = await solid(90, 28, [245, 245, 245]);
    const dim = await solid(110, 28, [90, 90, 95]);
    const composed = await sharp(base)
        .composite([
            { input: bright, left: 110, top: 60 },
            { input: dim, left: 230, top: 60 },
            // dark bottom tab bar so it isn't springboard
            { input: await solid(402, 70, [8, 8, 10]), left: 0, top: 804 },
        ])
        .raw()
        .ensureAlpha()
        .toBuffer({ resolveWithObject: true });
    const tab = detectHomeFeedTab({
        data: composed.data,
        width: composed.info.width,
        height: composed.info.height,
        channels: composed.info.channels,
    });
    assert.equal(tab, 'following');
});
