export type Personality = 'skimmer' | 'casual' | 'engaged' | 'dialed';

export interface ProfileConfig {
    watchMinMs: number;
    watchMaxMs: number;
    likeChance: number;
    saveChance: number;
    lingerChance: number;
    lingerMinMs: number;
    lingerMaxMs: number;
}

export const PROFILES: Record<Personality, ProfileConfig> = {
    skimmer: {
        watchMinMs: 1500, watchMaxMs: 4000,
        likeChance: 0.28, saveChance: 0.10,
        lingerChance: 0.05, lingerMinMs: 4000, lingerMaxMs: 8000,
    },
    casual: {
        watchMinMs: 4000, watchMaxMs: 9000,
        likeChance: 0.50, saveChance: 0.22,
        lingerChance: 0.10, lingerMinMs: 8000, lingerMaxMs: 15000,
    },
    engaged: {
        watchMinMs: 8000, watchMaxMs: 18000,
        likeChance: 0.75, saveChance: 0.40,
        lingerChance: 0.20, lingerMinMs: 15000, lingerMaxMs: 30000,
    },
    dialed: {
        watchMinMs: 1200, watchMaxMs: 2200,
        likeChance: 1, saveChance: 1,
        lingerChance: 0, lingerMinMs: 0, lingerMaxMs: 0,
    },
};

export function isPersonality(value: string): value is Personality {
    return value === 'skimmer' || value === 'casual' || value === 'engaged' || value === 'dialed';
}

function between(min: number, max: number, random: () => number): number {
    return Math.round(min + random() * (max - min));
}

export function pickWatchDurationMs(profile: ProfileConfig, random: () => number = Math.random): number {
    return between(profile.watchMinMs, profile.watchMaxMs, random);
}

export interface LingerDecision {
    linger: boolean;
    extraMs: number;
}

export function decideLinger(profile: ProfileConfig, random: () => number = Math.random): LingerDecision {
    const linger = random() < profile.lingerChance;
    return { linger, extraMs: linger ? between(profile.lingerMinMs, profile.lingerMaxMs, random) : 0 };
}

export function decideLike(profile: ProfileConfig, random: () => number = Math.random): boolean {
    return random() < profile.likeChance;
}

export function decideSave(profile: ProfileConfig, random: () => number = Math.random): boolean {
    return random() < profile.saveChance;
}

export function clampToDeadline(nowMs: number, deadlineMs: number, desiredMs: number): number {
    return Math.max(0, Math.min(desiredMs, deadlineMs - nowMs));
}

export function hasTimeRemaining(nowMs: number, deadlineMs: number): boolean {
    return nowMs < deadlineMs;
}
