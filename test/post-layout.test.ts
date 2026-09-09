import assert from 'node:assert/strict';
import test from 'node:test';

import { recentPickerTargets } from '../src/tiktok/post-layout.js';

const layout = {
    circleX: 66,
    columnStep: 135,
    firstY: 689,
    trayY: 472,
    rowStep: 164,
};

test('recentPickerTargets picks newest-first cells at the top of Recents', () => {
    assert.deepEqual(recentPickerTargets(50, 1, layout), [{ x: 66, y: 689 }]);
    assert.deepEqual(recentPickerTargets(50, 3, layout), [
        { x: 66, y: 689 },
        { x: 201, y: 689 },
        { x: 336, y: 689 },
    ]);
    assert.deepEqual(recentPickerTargets(50, 4, layout), [
        { x: 66, y: 689 },
        { x: 201, y: 689 },
        { x: 336, y: 689 },
        { x: 66, y: 853 },
    ]);
});
