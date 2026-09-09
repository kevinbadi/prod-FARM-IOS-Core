import crypto from 'node:crypto';

import type { Point, SocialAppCoordinates } from '../devices/coordinates.js';
import type { RemoteAction } from '../devices/wda-remote.js';

export const WORKFLOW_LABELED_TARGETS = [
    'like', 'save', 'comment', 'commentComposer', 'commentSend',
    'homeTab', 'followingTab', 'swipeNext',
] as const;

export type WorkflowLabeledTarget = typeof WORKFLOW_LABELED_TARGETS[number];

export type WorkflowStep =
    | { kind: 'wait'; durationMs: number }
    | { kind: 'labeled'; label: WorkflowLabeledTarget; text?: string }
    | { kind: 'raw'; action: RemoteAction };

export type WorkflowTimedStep = { t: number; step: WorkflowStep };

export type WorkflowPattern = {
    id: string;
    name: string;
    createdAt: string;
    steps: WorkflowTimedStep[];
    meta?: { feed?: 'following' | 'forYou'; source?: 'recording' };
};

export type RecordedWorkflowEvent = {
    t: number;
    action: RemoteAction;
};

const DEFAULT_TAP_THRESHOLD_PT = 40;
const SWIPE_AXIS_THRESHOLD_PT = 50;
const SWIPE_MIN_TRAVEL_PT = 80;

function distance(a: Point, b: Point): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function isLabeledTarget(value: string): value is WorkflowLabeledTarget {
    return (WORKFLOW_LABELED_TARGETS as readonly string[]).includes(value);
}

/** Map a tap near known TikTok controls to a labeled target. */
export function labelForTap(
    point: Point,
    coords: SocialAppCoordinates,
    thresholdPt = DEFAULT_TAP_THRESHOLD_PT,
): WorkflowLabeledTarget | undefined {
    const candidates: Array<{ label: WorkflowLabeledTarget; point: Point }> = [
        { label: 'like', point: coords.like },
        { label: 'save', point: coords.save },
        { label: 'comment', point: coords.comment },
        { label: 'commentComposer', point: coords.commentComposer },
        { label: 'commentSend', point: coords.commentSend },
        { label: 'homeTab', point: coords.homeTab },
        { label: 'followingTab', point: coords.followingTab },
    ];
    let best: { label: WorkflowLabeledTarget; dist: number } | undefined;
    for (const candidate of candidates) {
        const dist = distance(point, candidate.point);
        if (dist > thresholdPt) continue;
        if (!best || dist < best.dist) best = { label: candidate.label, dist };
    }
    return best?.label;
}

/** True when a swipe looks like the profile's feed "next video" gesture. */
export function isSwipeNext(
    action: Extract<RemoteAction, { type: 'swipe' }>,
    coords: SocialAppCoordinates,
): boolean {
    const travel = action.startY - action.endY;
    if (travel < SWIPE_MIN_TRAVEL_PT) return false;
    const axisOk = Math.abs(action.startX - coords.swipe.x) <= SWIPE_AXIS_THRESHOLD_PT
        && Math.abs(action.endX - coords.swipe.x) <= SWIPE_AXIS_THRESHOLD_PT;
    return axisOk;
}

/**
 * Convert a recorded remote-action stream into hybrid workflow steps.
 * Inserts wait steps for gaps between events (clamped) and promotes nearby
 * taps/swipes to labeled controls when they match the device's TikTok coords.
 */
export function normalizeRecordedEvents(
    events: RecordedWorkflowEvent[],
    coords: SocialAppCoordinates,
    options: { tapThresholdPt?: number; maxWaitMs?: number } = {},
): WorkflowTimedStep[] {
    const tapThresholdPt = options.tapThresholdPt ?? DEFAULT_TAP_THRESHOLD_PT;
    const maxWaitMs = options.maxWaitMs ?? 30_000;
    const sorted = [...events].sort((a, b) => a.t - b.t);
    const steps: WorkflowTimedStep[] = [];
    let previousT = 0;

    for (const event of sorted) {
        const gap = Math.max(0, event.t - previousT);
        if (gap >= 150 && steps.length > 0) {
            steps.push({
                t: previousT,
                step: { kind: 'wait', durationMs: Math.min(gap, maxWaitMs) },
            });
        }

        let step: WorkflowStep;
        if (event.action.type === 'tap') {
            const label = labelForTap({ x: event.action.x, y: event.action.y }, coords, tapThresholdPt);
            step = label
                ? { kind: 'labeled', label }
                : { kind: 'raw', action: event.action };
        } else if (event.action.type === 'swipe' && isSwipeNext(event.action, coords)) {
            step = { kind: 'labeled', label: 'swipeNext' };
        } else {
            step = { kind: 'raw', action: event.action };
        }

        steps.push({ t: event.t, step });
        previousT = event.t;
    }

    return steps;
}

export function createWorkflowPattern(input: {
    name: string;
    events: RecordedWorkflowEvent[];
    coords: SocialAppCoordinates;
    meta?: WorkflowPattern['meta'];
    steps?: WorkflowTimedStep[];
}): WorkflowPattern {
    const name = input.name.trim();
    if (!name) throw new Error('Workflow name is required');
    if (name.length > 80) throw new Error('Workflow name must be 80 characters or fewer');
    const steps = input.steps ?? normalizeRecordedEvents(input.events, input.coords);
    if (steps.length === 0) throw new Error('Record at least one gesture before saving');
    return {
        id: crypto.randomUUID(),
        name,
        createdAt: new Date().toISOString(),
        steps,
        meta: { source: 'recording', ...input.meta },
    };
}

export function parseWorkflowStep(value: unknown): WorkflowStep {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Workflow step must be an object');
    }
    const step = value as Record<string, unknown>;
    if (step.kind === 'wait') {
        if (!Number.isInteger(step.durationMs) || typeof step.durationMs !== 'number' || step.durationMs < 0) {
            throw new Error('wait.durationMs must be a non-negative integer');
        }
        return { kind: 'wait', durationMs: step.durationMs };
    }
    if (step.kind === 'labeled') {
        if (typeof step.label !== 'string' || !isLabeledTarget(step.label)) {
            throw new Error(`Unknown workflow label "${String(step.label)}"`);
        }
        const text = step.text;
        if (text !== undefined && typeof text !== 'string') throw new Error('labeled.text must be a string');
        if (typeof text === 'string' && text.length > 500) throw new Error('labeled.text must be 500 characters or fewer');
        return { kind: 'labeled', label: step.label, ...(text ? { text } : {}) };
    }
    if (step.kind === 'raw') {
        return { kind: 'raw', action: parseRemoteAction(step.action) };
    }
    throw new Error(`Unknown workflow step kind "${String(step.kind)}"`);
}

export function parseRemoteAction(value: unknown): RemoteAction {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Remote action must be an object');
    }
    const action = value as Record<string, unknown>;
    if (action.type === 'tap') {
        if (typeof action.x !== 'number' || typeof action.y !== 'number') throw new Error('tap requires x and y');
        return { type: 'tap', x: Math.round(action.x), y: Math.round(action.y) };
    }
    if (action.type === 'swipe') {
        const { startX, startY, endX, endY, durationMs } = action;
        if ([startX, startY, endX, endY, durationMs].some((n) => typeof n !== 'number')) {
            throw new Error('swipe requires numeric coordinates and durationMs');
        }
        return {
            type: 'swipe',
            startX: Math.round(startX as number),
            startY: Math.round(startY as number),
            endX: Math.round(endX as number),
            endY: Math.round(endY as number),
            durationMs: Math.round(durationMs as number),
        };
    }
    if (action.type === 'home' || action.type === 'lock' || action.type === 'wake'
        || action.type === 'unlock' || action.type === 'volumeUp' || action.type === 'volumeDown') {
        return { type: action.type };
    }
    throw new Error(`Unsupported remote action type "${String(action.type)}"`);
}

export function parseRecordedEvents(value: unknown): RecordedWorkflowEvent[] {
    if (!Array.isArray(value)) throw new Error('events must be an array');
    return value.map((item, index) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
            throw new Error(`events[${index}] must be an object`);
        }
        const event = item as Record<string, unknown>;
        if (typeof event.t !== 'number' || !Number.isFinite(event.t) || event.t < 0) {
            throw new Error(`events[${index}].t must be a non-negative number`);
        }
        return { t: Math.round(event.t), action: parseRemoteAction(event.action) };
    });
}

export function parseWorkflowPattern(value: unknown): WorkflowPattern {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Workflow must be an object');
    }
    const pattern = value as Record<string, unknown>;
    if (typeof pattern.id !== 'string' || !pattern.id) throw new Error('Workflow id is required');
    if (typeof pattern.name !== 'string' || !pattern.name.trim()) throw new Error('Workflow name is required');
    if (typeof pattern.createdAt !== 'string') throw new Error('Workflow createdAt is required');
    if (!Array.isArray(pattern.steps)) throw new Error('Workflow steps must be an array');
    const steps = pattern.steps.map((item, index) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
            throw new Error(`steps[${index}] must be an object`);
        }
        const timed = item as Record<string, unknown>;
        if (typeof timed.t !== 'number' || !Number.isFinite(timed.t) || timed.t < 0) {
            throw new Error(`steps[${index}].t must be a non-negative number`);
        }
        return { t: Math.round(timed.t), step: parseWorkflowStep(timed.step) };
    });
    return {
        id: pattern.id,
        name: pattern.name.trim(),
        createdAt: pattern.createdAt,
        steps,
        ...(pattern.meta && typeof pattern.meta === 'object' && !Array.isArray(pattern.meta)
            ? { meta: pattern.meta as WorkflowPattern['meta'] }
            : {}),
    };
}

export function listWorkflowsFromPluginData(pluginData: Record<string, unknown> | undefined): WorkflowPattern[] {
    const raw = pluginData?.workflows;
    if (!Array.isArray(raw)) return [];
    return raw.map((item) => parseWorkflowPattern(item));
}

export function replaceWorkflowsInPluginData(
    pluginData: Record<string, unknown> | undefined,
    workflows: WorkflowPattern[],
): Record<string, unknown> {
    return { ...pluginData, workflows };
}
