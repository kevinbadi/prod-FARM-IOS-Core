import sharp from 'sharp';

export interface LiveFeedDetection {
    isLive: boolean;
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

/** TikTok Live pink "+ Follow" / accent chip. */
function isHotPink(r: number, g: number, b: number): boolean {
    return r > 180 && g < 120 && b > 90 && r - g > 60;
}

/** Bright glyph / gift icon on a dark Live bottom bar. */
function isBrightIcon(r: number, g: number, b: number): boolean {
    return Math.max(r, g, b) > 200 && (r + g + b) / 3 > 160;
}

/**
 * Heuristic Live-viewer detector for TikTok screenshots.
 * Live chrome tends to show a saturated pink Follow chip up top and a dark
 * chat/gift bar along the bottom — neither appears on a normal FYP clip.
 */
export async function detectTikTokLiveFeed(screenshot: Buffer, _scale = 3): Promise<LiveFeedDetection> {
    const { data, info } = await sharp(screenshot).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    const image: PixelImage = { data, width: info.width, height: info.height, channels: info.channels };
    const reasons: string[] = [];

    const followBand = sampleRegion(
        image,
        image.width * 0.08,
        image.height * 0.06,
        image.width * 0.62,
        image.height * 0.18,
        isHotPink,
    );
    const followRatio = followBand.total > 0 ? followBand.hits / followBand.total : 0;
    const strongFollow = followRatio >= 0.012;
    const weakFollow = followRatio >= 0.006;
    if (strongFollow) reasons.push(`pinkFollow=${followRatio.toFixed(4)}`);
    else if (weakFollow) reasons.push(`pinkFollowWeak=${followRatio.toFixed(4)}`);

    const bottomBar = sampleRegion(
        image,
        0,
        image.height * 0.88,
        image.width,
        image.height,
        () => false,
    );
    const darkBottom = bottomBar.meanLuma < 70;
    if (darkBottom) reasons.push(`darkBottomLuma=${bottomBar.meanLuma.toFixed(1)}`);

    const giftIcons = sampleRegion(
        image,
        image.width * 0.45,
        image.height * 0.88,
        image.width * 0.98,
        image.height * 0.98,
        isBrightIcon,
    );
    const giftRatio = giftIcons.total > 0 ? giftIcons.hits / giftIcons.total : 0;
    const brightGifts = giftRatio >= 0.03;
    if (brightGifts) reasons.push(`giftIcons=${giftRatio.toFixed(4)}`);

    // Live needs the pink Follow chip (or weak follow) plus Live chrome.
    // Dark bottom + bright icons alone matches normal FYP tab bars on dark
    // videos and caused endless terminate/relaunch loops.
    let score = 0;
    if (strongFollow) score += 0.55;
    else if (weakFollow) score += 0.3;
    if (darkBottom && brightGifts) score += 0.35;
    else if (darkBottom) score += 0.15;
    else if (brightGifts) score += 0.1;

    const isLive = score >= 0.7;
    return {
        isLive,
        confidence: Math.min(1, score),
        reasons,
    };
}
