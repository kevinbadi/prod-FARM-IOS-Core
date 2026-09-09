import assert from 'node:assert/strict';
import test from 'node:test';

import { coordinatesForProfile } from '../src/devices/coordinates.js';
import {
    createWorkflowPattern,
    isSwipeNext,
    labelForTap,
    normalizeRecordedEvents,
} from '../src/tiktok/workflows.js';
import { PluginRegistry } from '../src/registry.js';
import { createTikTokPlugin } from '../src/tiktok-plugin.js';

const coords = coordinatesForProfile('iphone8').tiktok;

test('labelForTap maps nearby taps to known controls', () => {
    assert.equal(labelForTap(coords.like, coords), 'like');
    assert.equal(labelForTap(coords.save, coords), 'save');
    assert.equal(labelForTap(coords.followingTab, coords), 'followingTab');
    assert.equal(labelForTap({ x: 10, y: 10 }, coords), undefined);
});

test('isSwipeNext recognizes the profile swipe corridor', () => {
    assert.equal(isSwipeNext({
        type: 'swipe',
        startX: coords.swipe.x,
        startY: coords.swipe.startY,
        endX: coords.swipe.x,
        endY: coords.swipe.endY,
        durationMs: 400,
    }, coords), true);
    assert.equal(isSwipeNext({
        type: 'swipe',
        startX: 20,
        startY: 400,
        endX: 300,
        endY: 400,
        durationMs: 400,
    }, coords), false);
});

test('normalizeRecordedEvents inserts waits and promotes labeled steps', () => {
    const steps = normalizeRecordedEvents([
        { t: 0, action: { type: 'tap', x: coords.followingTab.x, y: coords.followingTab.y } },
        { t: 2000, action: { type: 'tap', x: coords.like.x, y: coords.like.y } },
        { t: 3500, action: {
            type: 'swipe',
            startX: coords.swipe.x,
            startY: coords.swipe.startY,
            endX: coords.swipe.x,
            endY: coords.swipe.endY,
            durationMs: 450,
        } },
        { t: 4000, action: { type: 'tap', x: 12, y: 12 } },
    ], coords);
    assert.equal(steps[0]?.step.kind, 'labeled');
    assert.equal(steps[0]?.step.kind === 'labeled' && steps[0].step.label, 'followingTab');
    assert.equal(steps[1]?.step.kind, 'wait');
    assert.equal(steps[2]?.step.kind === 'labeled' && steps[2].step.label, 'like');
    assert.equal(steps.some((item) => item.step.kind === 'labeled' && item.step.label === 'swipeNext'), true);
    assert.equal(steps.at(-1)?.step.kind, 'raw');
});

test('createWorkflowPattern requires a name and at least one gesture', () => {
    assert.throws(() => createWorkflowPattern({ name: '', events: [], coords }), /name/i);
    assert.throws(() => createWorkflowPattern({ name: 'demo', events: [], coords }), /at least one/i);
    const pattern = createWorkflowPattern({
        name: 'following-engage',
        events: [{ t: 0, action: { type: 'tap', x: coords.like.x, y: coords.like.y } }],
        coords,
        meta: { feed: 'following' },
    });
    assert.equal(pattern.name, 'following-engage');
    assert.equal(pattern.meta?.feed, 'following');
    assert.ok(pattern.id);
});

test('TikTok plugin validates following doomscroll and workflow replay', () => {
    const registry = new PluginRegistry([createTikTokPlugin()]);
    const following = registry.validate({
        deviceUdid: 'device-12345678',
        task: {
            pluginId: 'com.git-agni.tiktok',
            taskType: 'doomscroll-following',
            taskVersion: 1,
            payload: {
                durationMinutes: 5,
                personality: 'casual',
                likeEnabled: true,
                saveEnabled: true,
                commentEnabled: true,
                commentText: '🔥',
            },
        },
        timing: { kind: 'now' },
    });
    assert.equal(following.task.taskType, 'doomscroll-following');

    assert.throws(() => registry.validate({
        deviceUdid: 'device-12345678',
        task: {
            pluginId: 'com.git-agni.tiktok',
            taskType: 'doomscroll-following',
            taskVersion: 1,
            payload: {
                durationMinutes: 5,
                personality: 'casual',
                likeEnabled: true,
                saveEnabled: true,
                commentEnabled: true,
            },
        },
        timing: { kind: 'now' },
    }), /commentText/);

    const replay = registry.validate({
        deviceUdid: 'device-12345678',
        task: {
            pluginId: 'com.git-agni.tiktok',
            taskType: 'workflow-replay',
            taskVersion: 1,
            payload: { workflowId: 'abc', durationMinutes: 3 },
        },
        timing: { kind: 'now' },
    });
    assert.equal(replay.task.payload.workflowId, 'abc');
});
