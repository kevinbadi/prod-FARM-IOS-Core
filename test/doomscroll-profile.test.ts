import assert from 'node:assert/strict';
import test from 'node:test';

import {
    PROFILES,
    decideComment,
    decideLike,
    decideSave,
    isPersonality,
} from '../src/tiktok/doomscroll-profile.js';

test('dialed is a valid personality that always engages', () => {
    assert.equal(isPersonality('dialed'), true);
    const dialed = PROFILES.dialed;
    assert.equal(decideLike(dialed, () => 0.99), true);
    assert.equal(decideSave(dialed, () => 0.99), true);
    assert.equal(decideComment(dialed, () => 0.99), true);
    assert.equal(dialed.likeChance, 1);
    assert.equal(dialed.saveChance, 1);
    assert.equal(dialed.commentChance, 1);
});
