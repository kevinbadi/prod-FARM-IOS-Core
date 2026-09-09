import assert from 'node:assert/strict';
import test from 'node:test';

import { looksLikeFeedTutorial } from '../src/tiktok/actions.js';
import type { OcrWord } from '../src/tiktok/ocr.js';

function words(...texts: string[]): OcrWord[] {
    return texts.map((text, index) => ({
        text,
        x: index * 10,
        y: 0,
        width: 8,
        height: 8,
        confidence: 90,
    }));
}

test('looksLikeFeedTutorial detects coach-mark copy', () => {
    assert.equal(looksLikeFeedTutorial(words('Following', 'For', 'You', 'Home')), false);
    assert.equal(looksLikeFeedTutorial(words('Swipe', 'up', 'for', 'more')), false);
    assert.equal(looksLikeFeedTutorial(words('Got it')), true);
    assert.equal(looksLikeFeedTutorial(words('Got', 'it')), true);
    assert.equal(looksLikeFeedTutorial(words('Skip')), true);
    assert.equal(looksLikeFeedTutorial(words('Double tap', 'to', 'like')), true);
    assert.equal(looksLikeFeedTutorial(words('Try it')), true);
    assert.equal(looksLikeFeedTutorial(words('Learn more')), true);
});
