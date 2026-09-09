import assert from 'node:assert/strict';
import test from 'node:test';

import {
    COLD_DMS_MAX_HANDLES,
    parseColdDmHandles,
    validateColdDmHandles,
    validateColdDmMessage,
} from '../src/instagram/cold-dms-payload.js';
import { PluginRegistry } from '../src/registry.js';
import { createInstagramPlugin } from '../src/instagram-plugin.js';

test('parseColdDmHandles accepts newlines, commas, and missing @', () => {
    assert.deepEqual(
        parseColdDmHandles('@one\ntwo, @three\n@one'),
        ['@one', '@two', '@three'],
    );
});

test('validateColdDmHandles enforces caps and format', () => {
    assert.throws(() => validateColdDmHandles([]), /at least one/);
    assert.throws(() => validateColdDmHandles(['bad handle']), /Invalid/);
    const tooMany = Array.from({ length: COLD_DMS_MAX_HANDLES + 1 }, (_, i) => `@u${i}`);
    assert.throws(() => validateColdDmHandles(tooMany), /at most/);
    assert.deepEqual(validateColdDmHandles(['@ok_user.1']), ['@ok_user.1']);
});

test('validateColdDmMessage requires non-empty text within limit', () => {
    assert.throws(() => validateColdDmMessage('   '), /required/);
    assert.throws(() => validateColdDmMessage('x'.repeat(1001)), /1000/);
    assert.equal(validateColdDmMessage('  hey  '), 'hey');
});

test('Instagram plugin registers cold-dms task', () => {
    const plugin = createInstagramPlugin({ coldDmsEntrypoint: '/example/cold-dms.js' });
    assert.ok(plugin.tasks.some((task) => task.type === 'cold-dms' && task.version === 1));
    const registry = new PluginRegistry([plugin]);
    const value = registry.validate({
        deviceUdid: 'device-12345678',
        task: {
            pluginId: plugin.id, taskType: 'cold-dms', taskVersion: 1,
            payload: { handles: ['@a', '@b'], message: 'Hey there' },
        },
        timing: { kind: 'now' },
    });
    assert.deepEqual(value.task.payload.handles, ['@a', '@b']);
    const task = plugin.tasks.find((entry) => entry.type === 'cold-dms')!;
    assert.equal(task.summarize(value.task.payload as never), 'Cold DMs · 2 handles (dry-run)');
});
