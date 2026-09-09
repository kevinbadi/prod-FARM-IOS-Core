import assert from 'node:assert/strict';
import test from 'node:test';

import { PluginRegistry } from '../src/registry.js';
import { createInstagramPlugin } from '../src/instagram-plugin.js';

const plugin = createInstagramPlugin({ doomscrollEntrypoint: '/example/doomscroll.js', postEntrypoint: '/example/post.js' });

test('built-in Instagram plugin validates versioned doomscroll tasks', () => {
    assert.equal(plugin.id, 'com.git-agni.instagram');
    const registry = new PluginRegistry([plugin]);
    const value = registry.validate({
        deviceUdid: 'device-12345678',
        task: {
            pluginId: plugin.id, taskType: 'doomscroll', taskVersion: 1,
            payload: { durationMinutes: 5, personality: 'casual', likeEnabled: true, saveEnabled: false },
        },
        timing: { kind: 'daily', localTime: '09:00', timezone: 'Asia/Kolkata' },
    });
    assert.equal(value.task.payload.durationMinutes, 5);
    const task = plugin.tasks.find((entry) => entry.type === 'doomscroll' && entry.version === 1)!;
    assert.equal(task.summarize(value.task.payload as never), 'Doomscroll · casual · 5 min');
});

test('Instagram recurring public posts require confirmation', () => {
    const registry = new PluginRegistry([plugin]);
    assert.throws(() => registry.validate({
        deviceUdid: 'device-12345678',
        task: {
            pluginId: plugin.id, taskType: 'post', taskVersion: 1,
            payload: {
                media: [{ assetId: 'asset-1', name: 'x.jpg', mimeType: 'image/jpeg' }],
                destination: 'publish', account: '@test',
            },
        },
        timing: { kind: 'daily', localTime: '10:00', timezone: 'Asia/Kolkata' },
    }), /explicit confirmation/);
    const ok = registry.validate({
        deviceUdid: 'device-12345678',
        task: {
            pluginId: plugin.id, taskType: 'post', taskVersion: 1,
            payload: {
                media: [{ assetId: 'asset-1', name: 'x.jpg', mimeType: 'image/jpeg' }],
                destination: 'publish', account: '@test', recurringPublishConfirmed: true,
            },
        },
        timing: { kind: 'daily', localTime: '10:00', timezone: 'Asia/Kolkata' },
    });
    assert.equal(ok.task.payload.destination, 'publish');
});
