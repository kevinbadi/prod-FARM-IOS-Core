import sharp from 'sharp';

export interface EngagementControls {
    like: { x: number; y: number };
    save: { x: number; y: number };
    confidence: number;
}

/** Point coordinates in logical points (same space as calibrated taps). */
export interface EngagementSeeds {
    like: { x: number; y: number };
    save: { x: number; y: number };
}

interface PixelImage {
    data: Buffer;
    width: number;
    height: number;
    channels: number;
}

interface Match {
    x: number;
    y: number;
    score: number;
}

const HEART_PATH = 'M32 56C28 51 7 38 7 21C7 10 20 5 32 17C44 5 57 10 57 21C57 38 36 51 32 56Z';
const BOOKMARK_PATH = 'M13 6Q13 3 17 3H47Q51 3 51 7V59L32 47L13 59Z';
// Low-confidence pairs often latch onto count text or avatars.
const MIN_PAIR_CONFIDENCE = 0.72;
/** Seeded local search half-extents in logical points. */
const SEED_WINDOW_X_PT = 28;
const SEED_WINDOW_Y_PT = 45;
/** Reject heart matches this many points above the like seed (avatar). */
const MAX_LIKE_ABOVE_SEED_PT = 35;

const templateCache = new Map<string, Float64Array>();

async function renderTemplate(path: string, size: number): Promise<Float64Array> {
    const cacheKey = `${path}:${size}`;
    const cached = templateCache.get(cacheKey);
    if (cached) return cached;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path fill="white" d="${path}"/></svg>`;
    const { data } = await sharp(Buffer.from(svg)).resize(size, size).flatten({ background: 'black' })
        .greyscale().raw().toBuffer({ resolveWithObject: true });
    const values = Float64Array.from(data);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    for (let index = 0; index < values.length; index++) values[index] = values[index]! - mean;
    templateCache.set(cacheKey, values);
    return values;
}

function iconIntensity(image: PixelImage): Float64Array {
    const values = new Float64Array(image.width * image.height);
    for (let index = 0; index < values.length; index++) {
        const offset = index * image.channels;
        values[index] = Math.max(image.data[offset]!, image.data[offset + 1]!, image.data[offset + 2]!);
    }
    return values;
}

function normalizedCorrelation(
    pixels: Float64Array,
    imageWidth: number,
    template: Float64Array,
    size: number,
    left: number,
    top: number,
): number {
    let patchSum = 0;
    for (let y = 0; y < size; y++) {
        const row = (top + y) * imageWidth + left;
        for (let x = 0; x < size; x++) patchSum += pixels[row + x]!;
    }
    const patchMean = patchSum / template.length;
    let covariance = 0;
    let patchEnergy = 0;
    let templateEnergy = 0;
    for (let y = 0; y < size; y++) {
        const row = (top + y) * imageWidth + left;
        const templateRow = y * size;
        for (let x = 0; x < size; x++) {
            const patchValue = pixels[row + x]! - patchMean;
            const templateValue = template[templateRow + x]!;
            covariance += patchValue * templateValue;
            patchEnergy += patchValue * patchValue;
            templateEnergy += templateValue * templateValue;
        }
    }
    if (patchEnergy === 0 || templateEnergy === 0) return -1;
    return covariance / Math.sqrt(patchEnergy * templateEnergy);
}

function bestMatchesInBounds(
    pixels: Float64Array,
    width: number,
    height: number,
    template: Float64Array,
    size: number,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
): Match[] {
    const half = Math.floor(size / 2);
    const left = Math.max(half, Math.floor(minX));
    const right = Math.min(width - half - 1, Math.ceil(maxX));
    const top = Math.max(half, Math.floor(minY));
    const bottom = Math.min(height - half - 1, Math.ceil(maxY));
    if (left > right || top > bottom) return [];

    const matches: Match[] = [];
    for (let y = top; y <= bottom; y += 3) {
        for (let x = left; x <= right; x += 3) {
            matches.push({
                x,
                y,
                score: normalizedCorrelation(pixels, width, template, size, x - half, y - half),
            });
        }
    }
    return matches.sort((a, b) => b.score - a.score).slice(0, 30);
}

function bestMatches(
    pixels: Float64Array,
    width: number,
    height: number,
    template: Float64Array,
    size: number,
    minYRatio: number,
    maxYRatio: number,
): Match[] {
    return bestMatchesInBounds(
        pixels,
        width,
        height,
        template,
        size,
        width * 0.90,
        width * 0.96,
        height * minYRatio,
        height * maxYRatio,
    );
}

function seededBounds(
    seedPt: { x: number; y: number },
    scale: number,
    width: number,
    height: number,
): { minX: number; maxX: number; minY: number; maxY: number } {
    const cx = seedPt.x * scale;
    const cy = seedPt.y * scale;
    const halfX = SEED_WINDOW_X_PT * scale;
    const halfY = SEED_WINDOW_Y_PT * scale;
    return {
        minX: Math.max(0, cx - halfX),
        maxX: Math.min(width - 1, cx + halfX),
        minY: Math.max(0, cy - halfY),
        maxY: Math.min(height - 1, cy + halfY),
    };
}

function pickBestPair(
    hearts: Match[],
    bookmarks: Match[],
    imageHeight: number,
    scale: number,
    seeds: EngagementSeeds | undefined,
): { heart: Match; bookmark: Match; confidence: number } | undefined {
    const minSep = imageHeight * (seeds ? 0.10 : 0.14);
    const maxSep = imageHeight * (seeds ? 0.30 : 0.25);
    const maxXDelta = 24 * scale;
    const maxAboveSeedPx = seeds ? MAX_LIKE_ABOVE_SEED_PT * scale : Infinity;
    const seedLikeYPx = seeds ? seeds.like.y * scale : 0;

    let best: { heart: Match; bookmark: Match; confidence: number } | undefined;
    for (const heart of hearts) {
        if (seeds && seedLikeYPx - heart.y > maxAboveSeedPx) continue;
        for (const bookmark of bookmarks) {
            const separation = bookmark.y - heart.y;
            if (Math.abs(bookmark.x - heart.x) > maxXDelta) continue;
            if (separation < minSep || separation > maxSep) continue;
            const confidence = Math.min(heart.score, bookmark.score);
            if (!best || confidence > best.confidence) best = { heart, bookmark, confidence };
        }
    }
    return best;
}

export async function detectEngagementControls(
    screenshot: Buffer,
    scale: number,
    seeds?: EngagementSeeds,
): Promise<EngagementControls | undefined> {
    const { data, info } = await sharp(screenshot).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    const image: PixelImage = { data, width: info.width, height: info.height, channels: info.channels };
    const pixels = iconIntensity(image);
    const templateSize = Math.max(42, Math.round(32 * scale));
    const [heartTemplate, bookmarkTemplate] = await Promise.all([
        renderTemplate(HEART_PATH, templateSize),
        renderTemplate(BOOKMARK_PATH, templateSize),
    ]);

    let hearts: Match[];
    let bookmarks: Match[];
    if (seeds) {
        const likeBounds = seededBounds(seeds.like, scale, image.width, image.height);
        const saveBounds = seededBounds(seeds.save, scale, image.width, image.height);
        hearts = bestMatchesInBounds(
            pixels, image.width, image.height, heartTemplate, templateSize,
            likeBounds.minX, likeBounds.maxX, likeBounds.minY, likeBounds.maxY,
        );
        bookmarks = bestMatchesInBounds(
            pixels, image.width, image.height, bookmarkTemplate, templateSize,
            saveBounds.minX, saveBounds.maxX, saveBounds.minY, saveBounds.maxY,
        );
    } else {
        hearts = bestMatches(pixels, image.width, image.height, heartTemplate, templateSize, 0.25, 0.55);
        bookmarks = bestMatches(pixels, image.width, image.height, bookmarkTemplate, templateSize, 0.45, 0.76);
    }

    const best = pickBestPair(hearts, bookmarks, image.height, scale, seeds);
    if (!best || best.confidence < MIN_PAIR_CONFIDENCE) return;
    return {
        like: { x: Math.round(best.heart.x / scale), y: Math.round(best.heart.y / scale) },
        save: { x: Math.round(best.bookmark.x / scale), y: Math.round(best.bookmark.y / scale) },
        confidence: best.confidence,
    };
}
