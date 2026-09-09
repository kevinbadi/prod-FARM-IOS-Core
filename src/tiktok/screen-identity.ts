import sharp from 'sharp';

import { detectEngagementControls, type EngagementSeeds } from './engagement-controls.js';
import { detectTikTokLiveFeed } from './live-feed.js';

export type TikTokScreenKind = 'fyp' | 'following' | 'live' | 'comments' | 'search' | 'off_feed';

export interface TikTokScreenIdentity {
    kind: TikTokScreenKind;
    confidence: number;
    reasons: string[];
}

interface PixelImage {
    data: Buffer;
    width: number;
    height: number;
    channels: number;
}

function sampleRegion(
    image: PixelImage,
    left: number,
    top: number,
    right: number,
    bottom: number,
    predicate: (r: number, g: number, b: number) => boolean,
): { hits: number; total: number; meanLuma: number } {
    const x0 = Math.max(0, Math.floor(left));
    const y0 = Math.max(0, Math.floor(top));
    const x1 = Math.min(image.width, Math.ceil(right));
    const y1 = Math.min(image.height, Math.ceil(bottom));
    let hits = 0;
    let total = 0;
    let lumaSum = 0;
    for (let y = y0; y < y1; y += 2) {
        for (let x = x0; x < x1; x += 2) {
            const offset = (y * image.width + x) * image.channels;
            const r = image.data[offset]!;
            const g = image.data[offset + 1]!;
            const b = image.data[offset + 2]!;
            total += 1;
            lumaSum += 0.299 * r + 0.587 * g + 0.114 * b;
            if (predicate(r, g, b)) hits += 1;
        }
    }
    return { hits, total, meanLuma: total > 0 ? lumaSum / total : 0 };
}

function looksLikeCommentSheet(image: PixelImage): boolean {
    const top = sampleRegion(image, 0, 0, image.width, image.height * 0.32, () => false);
    const sheet = sampleRegion(
        image,
        0,
        image.height * 0.42,
        image.width,
        image.height * 0.92,
        () => false,
    );
    return sheet.meanLuma > 185 && top.meanLuma < 140 && (sheet.meanLuma - top.meanLuma) > 55;
}

function looksLikeSearchPage(image: PixelImage): boolean {
    const query = sampleRegion(
        image,
        image.width * 0.08,
        image.height * 0.07,
        image.width * 0.78,
        image.height * 0.15,
        () => false,
    );
    const bottom = sampleRegion(image, 0, image.height * 0.88, image.width, image.height, () => false);
    return query.meanLuma > 200 && bottom.meanLuma > 90;
}

/** Dark full-width TikTok tab bar with a few bright icon pixels. */
function looksLikeTikTokTabBar(image: PixelImage): boolean {
    const bar = sampleRegion(
        image,
        0,
        image.height * 0.90,
        image.width,
        image.height,
        () => false,
    );
    if (bar.meanLuma > 55) return false;
    const icons = sampleRegion(
        image,
        image.width * 0.05,
        image.height * 0.90,
        image.width * 0.95,
        image.height * 0.99,
        (r, g, b) => (0.299 * r + 0.587 * g + 0.114 * b) > 170,
    );
    return icons.total > 0 && (icons.hits / icons.total) > 0.015;
}

/**
 * SpringBoard / home: no near-black TikTok tab bar, and the mid-grid has
 * several saturated color blobs (app icons) rather than video content.
 */
function looksLikeSpringboard(image: PixelImage): boolean {
    const bar = sampleRegion(image, 0, image.height * 0.90, image.width, image.height, () => false);
    if (bar.meanLuma < 40) return false;
    const grid = sampleRegion(
        image,
        image.width * 0.08,
        image.height * 0.18,
        image.width * 0.92,
        image.height * 0.72,
        (r, g, b) => {
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            return max > 140 && (max - min) > 45;
        },
    );
    return grid.total > 0 && (grid.hits / grid.total) > 0.04;
}

/**
 * Home header tabs: selected label is bright white, unselected is dim gray.
 * Following sits left; For You sits center/right.
 */
export function detectHomeFeedTab(image: PixelImage): 'following' | 'forYou' | 'unknown' {
    const y0 = image.height * 0.05;
    const y1 = image.height * 0.135;
    const isBright = (r: number, g: number, b: number) => (0.299 * r + 0.587 * g + 0.114 * b) > 195;
    // Calibrated Following center is ~40% width on 17 Pro; For You sits to its right.
    const following = sampleRegion(image, image.width * 0.22, y0, image.width * 0.48, y1, isBright);
    const forYou = sampleRegion(image, image.width * 0.50, y0, image.width * 0.78, y1, isBright);
    if (following.total < 10 || forYou.total < 10) return 'unknown';
    const followingRatio = following.hits / following.total;
    const forYouRatio = forYou.hits / forYou.total;
    if (followingRatio < 0.008 && forYouRatio < 0.008) return 'unknown';
    if (followingRatio > forYouRatio * 1.4 && followingRatio > 0.012) return 'following';
    if (forYouRatio > followingRatio * 1.4 && forYouRatio > 0.012) return 'forYou';
    if (following.meanLuma > forYou.meanLuma + 18) return 'following';
    if (forYou.meanLuma > following.meanLuma + 18) return 'forYou';
    return 'unknown';
}

function feedKindFromImage(
    image: PixelImage,
    confidence: number,
    reasons: string[],
    preferredFeed: 'following' | 'forYou' = 'forYou',
): TikTokScreenIdentity {
    const tab = detectHomeFeedTab(image);
    if (tab === 'following') {
        return { kind: 'following', confidence, reasons: [...reasons, 'followingTabSelected'] };
    }
    if (tab === 'forYou') {
        return { kind: 'fyp', confidence, reasons: [...reasons, 'forYouTabSelected'] };
    }
    // Tab pixels are often ambiguous on dark clips — prefer the caller's feed
    // instead of thrashing Home / Following / relaunch.
    if (preferredFeed === 'following') {
        return {
            kind: 'following',
            confidence: Math.min(confidence, 0.66),
            reasons: [...reasons, 'feedTabUnknownPreferredFollowing'],
        };
    }
    return { kind: 'fyp', confidence: Math.min(confidence, 0.6), reasons: [...reasons, 'feedTabUnknown'] };
}

/**
 * TikTok photo carousels show a row of page dots above the caption / tab bar.
 * Detect 2+ bright local peaks along that horizontal strip.
 */
export function detectTikTokCarouselFromImage(image: PixelImage): boolean {
    const y0 = Math.floor(image.height * 0.56);
    const y1 = Math.floor(image.height * 0.72);
    const x0 = Math.floor(image.width * 0.22);
    const x1 = Math.floor(image.width * 0.78);
    const columnMax: number[] = [];
    for (let x = x0; x < x1; x += 2) {
        let maxLuma = 0;
        for (let y = y0; y < y1; y += 2) {
            const offset = (y * image.width + x) * image.channels;
            const luma = 0.299 * image.data[offset]! + 0.587 * image.data[offset + 1]! + 0.114 * image.data[offset + 2]!;
            if (luma > maxLuma) maxLuma = luma;
        }
        columnMax.push(maxLuma);
    }
    let peaks = 0;
    for (let index = 3; index < columnMax.length - 3; index++) {
        const value = columnMax[index]!;
        if (value < 200) continue;
        if (value >= columnMax[index - 1]! && value >= columnMax[index + 1]!
            && value > columnMax[index - 3]! + 25 && value > columnMax[index + 3]! + 25) {
            peaks += 1;
            index += 6;
        }
    }
    return peaks >= 2;
}

export async function detectTikTokCarousel(screenshot: Buffer): Promise<boolean> {
    const { data, info } = await sharp(screenshot).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    return detectTikTokCarouselFromImage({
        data, width: info.width, height: info.height, channels: info.channels,
    });
}

/**
 * Classify TikTok surface. Engagement rail wins over Live heuristics so dark
 * FYP clips are not mistaken for Live and relaunched forever.
 * Home feed tabs distinguish Following vs For You when visible.
 */
export async function identifyTikTokScreen(
    screenshot: Buffer,
    scale: number,
    seeds?: EngagementSeeds,
    options?: { preferredFeed?: 'following' | 'forYou' },
): Promise<TikTokScreenIdentity> {
    const preferredFeed = options?.preferredFeed ?? 'forYou';
    const { data, info } = await sharp(screenshot).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    const image: PixelImage = { data, width: info.width, height: info.height, channels: info.channels };

    if (seeds) {
        const engagement = await detectEngagementControls(screenshot, scale, seeds);
        if (engagement && engagement.confidence >= 0.72) {
            return feedKindFromImage(image, engagement.confidence, [
                `engagementRail=${engagement.confidence.toFixed(3)}`,
            ], preferredFeed);
        }
    }

    const live = await detectTikTokLiveFeed(screenshot, scale);
    if (live.isLive) {
        return { kind: 'live', confidence: live.confidence, reasons: live.reasons };
    }

    if (looksLikeSearchPage(image)) {
        return { kind: 'search', confidence: 0.85, reasons: ['searchQueryField'] };
    }
    if (looksLikeCommentSheet(image)) {
        return { kind: 'comments', confidence: 0.8, reasons: ['lightCommentSheet'] };
    }
    if (looksLikeSpringboard(image)) {
        return { kind: 'off_feed', confidence: 0.9, reasons: ['springboard'] };
    }
    if (looksLikeTikTokTabBar(image)) {
        return feedKindFromImage(image, 0.62, ['tiktokTabBar'], preferredFeed);
    }

    // Never assume FYP — SpringBoard and random sheets used to get stuck here
    // while the loop kept liking/swiping on the iOS home screen.
    return { kind: 'off_feed', confidence: 0.55, reasons: ['unrecognized'] };
}
