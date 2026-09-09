import sharp from 'sharp';

import { detectEngagementControls, type EngagementSeeds } from './engagement-controls.js';

export type InstagramScreenKind = 'reels' | 'following' | 'home' | 'comments' | 'search' | 'off_feed';

export interface InstagramScreenIdentity {
    kind: InstagramScreenKind;
    confidence: number;
    reasons: string[];
}

export interface PixelImage {
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
    const top = sampleRegion(image, 0, 0, image.width, image.height * 0.28, () => false);
    const sheet = sampleRegion(
        image,
        0,
        image.height * 0.40,
        image.width,
        image.height * 0.92,
        () => false,
    );
    return sheet.meanLuma > 185 && top.meanLuma < 150 && (sheet.meanLuma - top.meanLuma) > 45;
}

function looksLikeSearchPage(image: PixelImage): boolean {
    const query = sampleRegion(
        image,
        image.width * 0.08,
        image.height * 0.07,
        image.width * 0.85,
        image.height * 0.14,
        () => false,
    );
    const bottom = sampleRegion(image, 0, image.height * 0.88, image.width, image.height, () => false);
    return query.meanLuma > 200 && bottom.meanLuma > 120;
}

/** Instagram bottom nav: light bar + dark icons, or dark bar + light icons. */
function looksLikeInstagramTabBar(image: PixelImage): boolean {
    const bar = sampleRegion(
        image,
        0,
        image.height * 0.88,
        image.width,
        image.height,
        () => false,
    );
    if (bar.meanLuma > 150) {
        const darkIcons = sampleRegion(
            image,
            image.width * 0.04,
            image.height * 0.88,
            image.width * 0.96,
            image.height * 0.995,
            (r, g, b) => (0.299 * r + 0.587 * g + 0.114 * b) < 80,
        );
        return darkIcons.total > 0 && (darkIcons.hits / darkIcons.total) > 0.006;
    }
    if (bar.meanLuma < 70) {
        const lightIcons = sampleRegion(
            image,
            image.width * 0.04,
            image.height * 0.88,
            image.width * 0.96,
            image.height * 0.995,
            (r, g, b) => (0.299 * r + 0.587 * g + 0.114 * b) > 150,
        );
        return lightIcons.total > 0 && (lightIcons.hits / lightIcons.total) > 0.008;
    }
    return false;
}

function looksLikeSpringboard(image: PixelImage): boolean {
    if (looksLikeInstagramTabBar(image)) return false;
    const bar = sampleRegion(image, 0, image.height * 0.88, image.width, image.height, () => false);
    // Instagram dark-mode feed bars sit near this band — do not call them SpringBoard.
    if (bar.meanLuma < 70) return false;
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
 * Reels top tabs (current IG): "Reels" (left, algorithmic) vs "Friends" (right).
 * Older builds used Following | For You on Home — same left/right geometry, but
 * on Reels the RIGHT selected tab means Friends (our following/friends feed).
 */
export function detectReelsTopTab(image: PixelImage): 'reels' | 'friends' | 'unknown' {
    const y0 = image.height * 0.05;
    const y1 = image.height * 0.135;
    const header = sampleRegion(image, image.width * 0.15, y0, image.width * 0.85, y1, () => false);
    const lightHeader = header.meanLuma > 170;
    const ink = lightHeader
        ? (r: number, g: number, b: number) => (0.299 * r + 0.587 * g + 0.114 * b) < 85
        : (r: number, g: number, b: number) => (0.299 * r + 0.587 * g + 0.114 * b) > 195;
    const left = sampleRegion(image, image.width * 0.18, y0, image.width * 0.42, y1, ink);
    const right = sampleRegion(image, image.width * 0.42, y0, image.width * 0.72, y1, ink);
    if (left.total < 10 || right.total < 10) return 'unknown';
    const leftRatio = left.hits / left.total;
    const rightRatio = right.hits / right.total;
    if (leftRatio < 0.008 && rightRatio < 0.008) return 'unknown';
    if (rightRatio > leftRatio * 1.35 && rightRatio > 0.012) return 'friends';
    if (leftRatio > rightRatio * 1.35 && leftRatio > 0.012) return 'reels';
    if (lightHeader) {
        if (right.meanLuma + 12 < left.meanLuma) return 'friends';
        if (left.meanLuma + 12 < right.meanLuma) return 'reels';
    } else {
        if (right.meanLuma > left.meanLuma + 18) return 'friends';
        if (left.meanLuma > right.meanLuma + 18) return 'reels';
    }
    return 'unknown';
}

/**
 * Home header tabs: Following (left) vs For You (right).
 * Light headers use dark ink for the selected tab; dark headers use bright text.
 */
export function detectHomeFeedTab(image: PixelImage): 'following' | 'forYou' | 'unknown' {
    // Prefer Reels/Friends detection when that chrome is present — Home Following
    // geometry collides with Reels|Friends and mislabels Friends as For You.
    const reelsTab = detectReelsTopTab(image);
    if (reelsTab === 'friends') return 'following';
    if (reelsTab === 'reels') return 'forYou';

    const y0 = image.height * 0.05;
    const y1 = image.height * 0.135;
    const header = sampleRegion(image, image.width * 0.15, y0, image.width * 0.85, y1, () => false);
    const lightHeader = header.meanLuma > 170;
    const ink = lightHeader
        ? (r: number, g: number, b: number) => (0.299 * r + 0.587 * g + 0.114 * b) < 85
        : (r: number, g: number, b: number) => (0.299 * r + 0.587 * g + 0.114 * b) > 195;
    const following = sampleRegion(image, image.width * 0.08, y0, image.width * 0.38, y1, ink);
    const forYou = sampleRegion(image, image.width * 0.42, y0, image.width * 0.78, y1, ink);
    if (following.total < 10 || forYou.total < 10) return 'unknown';
    const followingRatio = following.hits / following.total;
    const forYouRatio = forYou.hits / forYou.total;
    if (followingRatio < 0.008 && forYouRatio < 0.008) return 'unknown';
    if (followingRatio > forYouRatio * 1.35 && followingRatio > 0.012) return 'following';
    if (forYouRatio > followingRatio * 1.35 && forYouRatio > 0.012) return 'forYou';
    if (lightHeader) {
        if (following.meanLuma + 12 < forYou.meanLuma) return 'following';
        if (forYou.meanLuma + 12 < following.meanLuma) return 'forYou';
    } else {
        if (following.meanLuma > forYou.meanLuma + 18) return 'following';
        if (forYou.meanLuma > following.meanLuma + 18) return 'forYou';
    }
    return 'unknown';
}

function homeKindFromTab(
    tab: 'following' | 'forYou',
    confidence: number,
    reasons: string[],
): InstagramScreenIdentity {
    if (tab === 'following') {
        return { kind: 'following', confidence, reasons: [...reasons, 'friendsTabSelected'] };
    }
    return { kind: 'reels', confidence, reasons: [...reasons, 'reelsTabSelected'] };
}

function preferredSurface(
    confidence: number,
    reasons: string[],
    preferredFeed: 'reels' | 'following' | 'home',
): InstagramScreenIdentity {
    if (preferredFeed === 'reels') {
        return {
            kind: 'reels',
            confidence: Math.min(confidence, 0.66),
            reasons: [...reasons, 'preferredReels'],
        };
    }
    if (preferredFeed === 'following') {
        return {
            kind: 'following',
            confidence: Math.min(confidence, 0.66),
            reasons: [...reasons, 'feedTabUnknownPreferredFollowing'],
        };
    }
    return {
        kind: 'home',
        confidence: Math.min(confidence, 0.6),
        reasons: [...reasons, 'feedTabUnknown'],
    };
}

/**
 * Classify Instagram surface. Engagement icons win when confident.
 * Never assume Reels/Home — unrecognized frames are off_feed unless the
 * caller prefers a feed and we only have a tab bar (soft preference).
 */
export async function identifyInstagramScreen(
    screenshot: Buffer,
    scale: number,
    seeds?: EngagementSeeds,
    options?: { preferredFeed?: 'reels' | 'following' | 'home' },
): Promise<InstagramScreenIdentity> {
    const preferredFeed = options?.preferredFeed ?? 'reels';
    const { data, info } = await sharp(screenshot).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    const image: PixelImage = { data, width: info.width, height: info.height, channels: info.channels };

    if (looksLikeSearchPage(image)) {
        return { kind: 'search', confidence: 0.85, reasons: ['searchQueryField'] };
    }
    if (looksLikeCommentSheet(image)) {
        return { kind: 'comments', confidence: 0.8, reasons: ['lightCommentSheet'] };
    }

    // Reels chrome is "Reels | Friends" (right = friends/following).
    const homeTab = detectHomeFeedTab(image);
    if (homeTab !== 'unknown') {
        if (preferredFeed === 'reels') {
            // Warmup wants algorithmic Reels — Friends counts as drifted.
            if (homeTab === 'following') {
                return {
                    kind: 'following',
                    confidence: 0.78,
                    reasons: ['reelsHeaderTabs', 'friendsTabSelected'],
                };
            }
            return {
                kind: 'reels',
                confidence: 0.78,
                reasons: ['reelsHeaderTabs', 'reelsTabSelected'],
            };
        }
        return homeKindFromTab(homeTab, 0.78, ['reelsHeaderTabs']);
    }

    if (seeds) {
        const engagement = await detectEngagementControls(screenshot, scale, seeds);
        if (engagement && engagement.confidence >= 0.72) {
            if (preferredFeed === 'reels') {
                return {
                    kind: 'reels',
                    confidence: engagement.confidence,
                    reasons: [`engagementRail=${engagement.confidence.toFixed(3)}`],
                };
            }
            return preferredSurface(engagement.confidence, [
                `engagementRail=${engagement.confidence.toFixed(3)}`,
            ], preferredFeed);
        }
    }

    // Tab bar before SpringBoard — colorful IG feeds false-trigger springboard
    // when the light bottom nav is present.
    if (looksLikeInstagramTabBar(image)) {
        return preferredSurface(0.62, ['instagramTabBar'], preferredFeed);
    }
    if (looksLikeSpringboard(image)) {
        return { kind: 'off_feed', confidence: 0.9, reasons: ['springboard'] };
    }

    return { kind: 'off_feed', confidence: 0.55, reasons: ['unrecognized'] };
}
