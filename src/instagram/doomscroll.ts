import { remote, type Browser } from 'webdriverio';

import { loadRegisteredDevices, resolveDeviceCoordinates, WdaRemoteControl } from '@git-agni/phone-farm-core';
import { coordinateProfile, registeredAccounts } from './runtime-settings.js';
import { switchInstagramAccount, tapCoordinate } from './actions.js';
import { detectEngagementControls } from './engagement-controls.js';
import {
    PROFILES,
    clampToDeadline,
    decideLike,
    decideLinger,
    decideSave,
    hasTimeRemaining,
    isPersonality,
    pickWatchDurationMs,
} from './doomscroll-profile.js';

function positiveInteger(name: string, fallback: number): number {
    const rawValue = process.env[name] ?? String(fallback);
    const value = Number.parseInt(rawValue, 10);
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new Error(`${name} must be a positive integer; received ${rawValue}`);
    }
    return value;
}

function boundedInteger(name: string, fallback: number, min: number, max: number): number {
    const value = positiveInteger(name, fallback);
    if (value < min || value > max) {
        throw new Error(`${name} must be between ${min} and ${max}; received ${value}`);
    }
    return value;
}

function booleanEnv(name: string, fallback: boolean): boolean {
    const raw = process.env[name];
    if (raw === undefined) return fallback;
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    throw new Error(`${name} must be 'true' or 'false'; received ${raw}`);
}

const udidEnv = process.env.IOS_UDID;
if (!udidEnv) {
    throw new Error('IOS_UDID is required. Copy .env.example to .env and set the connected device UDID.');
}
const udid: string = udidEnv;

const personalityRaw = process.env.DOOMSCROLL_PERSONALITY ?? 'casual';
if (!isPersonality(personalityRaw)) {
    throw new Error(`DOOMSCROLL_PERSONALITY must be one of skimmer, casual, engaged; received ${personalityRaw}`);
}
const personality = personalityRaw;
const profile = PROFILES[personality];

const durationMinutes = boundedInteger('DOOMSCROLL_DURATION_MINUTES', 5, 1, 180);
const likeEnabled = booleanEnv('DOOMSCROLL_LIKE_ENABLED', true);
const saveEnabled = booleanEnv('DOOMSCROLL_SAVE_ENABLED', true);
const switchAccountName = process.env.INSTAGRAM_SWITCH_ACCOUNT?.trim() || undefined;
const registeredDevice = (await loadRegisteredDevices()).find((device) => device.udid === udid);
const coordinates = resolveDeviceCoordinates(
    coordinateProfile(registeredDevice),
    registeredDevice?.instagramCoordinates,
    'instagram',
);
const instagramCoordinates = coordinates.instagram;
const accountSwitchCoords = {
    profileTabX: instagramCoordinates.profileTab.x,
    profileTabY: instagramCoordinates.profileTab.y,
    switcherTriggerX: instagramCoordinates.accountSwitcher.x,
    switcherTriggerY: instagramCoordinates.accountSwitcher.y,
};
// switchInstagramAccount ends on the Profile tab (it re-checks there to verify
// the switch). The scroll loop below expects the Home feed, so only
// doomscroll needs to navigate back — instagram-post.ts's Create button works
// from any bottom-nav tab.
const { x: homeTabX, y: homeTabY } = instagramCoordinates.homeTab;

// Fail fast, before unlocking or launching Instagram, if the requested account
// isn't one this device is registered for.
const allowedAccounts = switchAccountName
    ? registeredAccounts(registeredDevice)
    : [];
if (switchAccountName && !allowedAccounts.includes(switchAccountName)) {
    throw new Error(`Instagram account "${switchAccountName}" is not listed in devices.json for device ${udid}`);
}
let { x: likeX, y: likeY } = instagramCoordinates.like;
let { x: saveX, y: saveY } = instagramCoordinates.save;
const { x: swipeX, startY: swipeStartY, endY: swipeEndY, durationMs: swipeDurationMs } = instagramCoordinates.swipe;
const wdaUrl = process.env.WDA_URL;
const instagramBundleId = process.env.INSTAGRAM_BUNDLE_ID ?? 'com.burbn.instagram';

const capabilities: WebdriverIO.Capabilities & Record<string, unknown> = {
    platformName: 'iOS',
    'appium:automationName': 'XCUITest',
    'appium:udid': udid,
    'appium:bundleId': instagramBundleId,
    'appium:noReset': true,
    'appium:forceAppLaunch': true,
    'appium:shouldTerminateApp': true,
    'appium:newCommandTimeout': 120,
    'appium:wdaLaunchTimeout': 120000,
    'appium:wdaConnectionTimeout': 120000,
    // Instagram's video feed never becomes fully idle. Waiting for quiescence can
    // make otherwise-completed gestures block until the WDA proxy times out.
    'appium:waitForIdleTimeout': 0,
    'appium:showXcodeLog': process.env.SHOW_XCODE_LOG === 'true',
};

if (wdaUrl) {
    capabilities['appium:webDriverAgentUrl'] = wdaUrl;
    capabilities['appium:wdaRemotePort'] = positiveInteger('WDA_REMOTE_PORT', 8100);
} else if (process.env.XCODE_ORG_ID) {
    capabilities['appium:xcodeOrgId'] = process.env.XCODE_ORG_ID;
    capabilities['appium:xcodeSigningId'] = process.env.XCODE_SIGNING_ID ?? 'Apple Development';
}
if (!wdaUrl && process.env.WDA_BUNDLE_ID) {
    capabilities['appium:updatedWDABundleId'] = process.env.WDA_BUNDLE_ID;
}
if (!wdaUrl && process.env.ALLOW_PROVISIONING_DEVICE_REGISTRATION === 'true') {
    capabilities['appium:allowProvisioningDeviceRegistration'] = true;
}
if (!wdaUrl && process.env.WDA_BOOTSTRAP_PATH) {
    capabilities['appium:useXctestrunFile'] = true;
    capabilities['appium:bootstrapPath'] = process.env.WDA_BOOTSTRAP_PATH;
}

// Cooperative cancellation: a Stop request sends SIGTERM (see
// src/automations/runner.ts). Every wait below races against stopPromise so
// a stop interrupts immediately instead of waiting out the current sleep.
let stopRequested = false;
let resolveStop: () => void = () => {};
const stopPromise = new Promise<void>((resolve) => { resolveStop = resolve; });
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
        stopRequested = true;
        resolveStop();
    });
}

function cancellableDelay(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve) => {
        const timer = setTimeout(resolve, ms);
        void stopPromise.then(() => {
            clearTimeout(timer);
            resolve();
        });
    });
}

function interactionPauseMs(): number {
    return Math.round(350 + Math.random() * 450);
}

/** Longer settle so Instagram can finish heart/bookmark animations before the next tap or swipe. */
function engagementSettleMs(): number {
    return Math.round(750 + Math.random() * 850);
}

let driver: Browser | undefined;
let videosViewed = 0;
let swipes = 0;
let likes = 0;
let saves = 0;
const runStartedAt = Date.now();

console.log(`Starting doomscroll: profile=${personality} requestedDurationMinutes=${durationMinutes} likeEnabled=${likeEnabled} saveEnabled=${saveEnabled}`);

try {
    const remoteControl = new WdaRemoteControl({
        deviceUdid: udid,
        wdaUrl,
        passcodeKeypadLayout: coordinates.passcodeKeypad,
    });
    console.log('Checking device lock state');
    await remoteControl.unlock(udid);

    console.log(`Opening Instagram on ${udid}`);
    driver = await remote({
        hostname: process.env.APPIUM_HOST ?? '127.0.0.1',
        port: positiveInteger('APPIUM_PORT', 4725),
        path: '/',
        logLevel: 'info',
        connectionRetryCount: 0,
        connectionRetryTimeout: 180000,
        capabilities,
    });

    await driver.updateSettings({ defaultActiveApplication: instagramBundleId });
    await driver.pause(3000);

    if (switchAccountName) {
        console.log(`Switching to Instagram account "${switchAccountName}"`);
        await switchInstagramAccount(driver, remoteControl, udid, switchAccountName, accountSwitchCoords);
        // switchInstagramAccount leaves the app on the Profile tab; the loop
        // below expects the Home feed.
        await tapCoordinate(driver, homeTabX, homeTabY, 'Home tab');
        await driver.pause(1500);
    }

    // Seeds from profile + optional dashboard calibration. Each engage video
    // re-detects near these points so rail drift does not miss the icons.
    const seedLike = { x: likeX, y: likeY };
    const seedSave = { x: saveX, y: saveY };
    console.log(
        `Instagram engagement seeds: like=(${seedLike.x}, ${seedLike.y}) save=(${seedSave.x}, ${seedSave.y})`
            + ` profile=${coordinateProfile(registeredDevice)}`
            + `${registeredDevice?.instagramCoordinates?.like || registeredDevice?.instagramCoordinates?.save ? ' (calibrated)' : ''}`,
    );

    async function refineEngagementControls(): Promise<void> {
        try {
            const [screenshot, screen] = await Promise.all([
                remoteControl.getScreenshot(udid),
                remoteControl.getScreenInfo(udid),
            ]);
            const detected = await detectEngagementControls(screenshot, screen.scale, {
                like: seedLike,
                save: seedSave,
            });
            if (detected) {
                ({ x: likeX, y: likeY } = detected.like);
                ({ x: saveX, y: saveY } = detected.save);
                seedLike.x = likeX;
                seedLike.y = likeY;
                seedSave.x = saveX;
                seedSave.y = saveY;
                console.log(
                    `Refined Instagram engagement controls: like=(${likeX}, ${likeY}) save=(${saveX}, ${saveY})`
                        + ` confidence=${detected.confidence.toFixed(3)}`,
                );
            } else {
                likeX = seedLike.x;
                likeY = seedLike.y;
                saveX = seedSave.x;
                saveY = seedSave.y;
                console.log(
                    `Could not refine Instagram engagement controls; using seeds like=(${likeX}, ${likeY}) save=(${saveX}, ${saveY})`,
                );
            }
        } catch (error) {
            likeX = seedLike.x;
            likeY = seedLike.y;
            saveX = seedSave.x;
            saveY = seedSave.y;
            console.log(
                `Engagement refine failed; using seeds: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    const deadline = Date.now() + durationMinutes * 60_000;

    while (!stopRequested && hasTimeRemaining(Date.now(), deadline)) {
        await cancellableDelay(clampToDeadline(Date.now(), deadline, pickWatchDurationMs(profile)));
        videosViewed += 1;
        if (stopRequested || !hasTimeRemaining(Date.now(), deadline)) break;

        const willLike = likeEnabled && decideLike(profile);
        const willSave = saveEnabled && decideSave(profile);
        if (willLike || willSave) {
            await refineEngagementControls();
            if (stopRequested || !hasTimeRemaining(Date.now(), deadline)) break;
        }

        if (willLike) {
            await cancellableDelay(clampToDeadline(Date.now(), deadline, interactionPauseMs()));
            if (stopRequested || !hasTimeRemaining(Date.now(), deadline)) break;
            // Single tap on the heart. Double-tapping likes then unlikes.
            await tapCoordinate(driver, likeX, likeY, 'Like');
            likes += 1;
            await cancellableDelay(clampToDeadline(Date.now(), deadline, engagementSettleMs()));
        }
        if (stopRequested || !hasTimeRemaining(Date.now(), deadline)) break;

        if (willSave) {
            await cancellableDelay(clampToDeadline(Date.now(), deadline, interactionPauseMs()));
            if (stopRequested || !hasTimeRemaining(Date.now(), deadline)) break;
            await tapCoordinate(driver, saveX, saveY, 'Save');
            saves += 1;
            await cancellableDelay(clampToDeadline(Date.now(), deadline, engagementSettleMs()));
        }
        if (stopRequested || !hasTimeRemaining(Date.now(), deadline)) break;

        const { linger, extraMs } = decideLinger(profile);
        if (linger) {
            await cancellableDelay(clampToDeadline(Date.now(), deadline, extraMs));
        }
        if (stopRequested || !hasTimeRemaining(Date.now(), deadline)) break;

        await cancellableDelay(clampToDeadline(Date.now(), deadline, engagementSettleMs()));
        if (stopRequested || !hasTimeRemaining(Date.now(), deadline)) break;

        // Coordinate actions bypass XCTest's expensive application-element
        // lookup, which can hang on Instagram's continuously updating feed.
        await driver.performActions([{
            type: 'pointer',
            id: 'finger',
            parameters: { pointerType: 'touch' },
            actions: [
                { type: 'pointerMove', duration: 0, x: swipeX, y: swipeStartY },
                { type: 'pointerDown', button: 0 },
                { type: 'pause', duration: 100 },
                { type: 'pointerMove', duration: swipeDurationMs, x: swipeX, y: swipeEndY },
                { type: 'pointerUp', button: 0 },
            ],
        }]);
        await driver.releaseActions();
        swipes += 1;
    }

    const elapsedMs = Date.now() - runStartedAt;
    const reason = stopRequested ? 'stopped' : 'completed';
    console.log(`Finished doomscroll: videosViewed=${videosViewed} swipes=${swipes} likes=${likes} saves=${saves} elapsedMs=${elapsedMs} reason=${reason}`);
} finally {
    if (driver) {
        await driver.deleteSession();
    }
}
