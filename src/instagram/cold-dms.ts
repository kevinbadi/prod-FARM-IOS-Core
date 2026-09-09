import { remote, type Browser } from 'webdriverio';

import { loadRegisteredDevices, resolveDeviceCoordinates, WdaRemoteControl } from '@git-agni/phone-farm-core';
import { coordinateProfile, registeredAccounts } from './runtime-settings.js';
import { switchInstagramAccount, tapCoordinate, typeText } from './actions.js';
import {
    parseColdDmHandles,
    validateColdDmHandles,
    validateColdDmMessage,
} from './cold-dms-payload.js';

function positiveInteger(name: string, fallback: number): number {
    const rawValue = process.env[name] ?? String(fallback);
    const value = Number.parseInt(rawValue, 10);
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new Error(`${name} must be a positive integer; received ${rawValue}`);
    }
    return value;
}

const udidEnv = process.env.IOS_UDID;
if (!udidEnv) {
    throw new Error('IOS_UDID is required. Copy .env.example to .env and set the connected device UDID.');
}
const udid: string = udidEnv;

const message = validateColdDmMessage(process.env.COLD_DMS_MESSAGE ?? '');
const handles = validateColdDmHandles(parseColdDmHandles(process.env.COLD_DMS_HANDLES ?? ''));
const switchAccountName = process.env.INSTAGRAM_SWITCH_ACCOUNT?.trim() || undefined;
const betweenHandleMs = positiveInteger('COLD_DMS_BETWEEN_MS', 2500);

const registeredDevice = (await loadRegisteredDevices()).find((device) => device.udid === udid);
const coordinates = resolveDeviceCoordinates(
    coordinateProfile(registeredDevice),
    registeredDevice?.instagramCoordinates,
    'instagram',
);
const ig = coordinates.instagram;
const accountSwitchCoords = {
    profileTabX: ig.profileTab.x,
    profileTabY: ig.profileTab.y,
    switcherTriggerX: ig.accountSwitcher.x,
    switcherTriggerY: ig.accountSwitcher.y,
};

const allowedAccounts = switchAccountName ? registeredAccounts(registeredDevice) : [];
if (switchAccountName && !allowedAccounts.includes(switchAccountName)) {
    throw new Error(`Instagram account "${switchAccountName}" is not listed in devices.json for device ${udid}`);
}

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
    'appium:newCommandTimeout': 180,
    'appium:wdaLaunchTimeout': 120000,
    'appium:wdaConnectionTimeout': 120000,
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

async function clearFocusedField(browser: Browser): Promise<void> {
    try {
        const focused = await browser.$('-ios predicate string:hasKeyboardFocus == 1');
        if (await focused.isExisting()) await focused.clearValue();
    } catch {
        // Coordinate-driven flow — clear is best-effort.
    }
}

async function openSearch(browser: Browser): Promise<void> {
    await tapCoordinate(browser, ig.searchTab.x, ig.searchTab.y, 'Search tab');
    await browser.pause(1500);
    await tapCoordinate(browser, ig.searchField.x, ig.searchField.y, 'Search field');
    await browser.pause(800);
    await clearFocusedField(browser);
}

async function leaveThreadToSearch(browser: Browser): Promise<void> {
    await tapCoordinate(browser, ig.dmBack.x, ig.dmBack.y, 'DM back');
    await browser.pause(900);
    await tapCoordinate(browser, ig.dmBack.x, ig.dmBack.y, 'DM back (profile)');
    await browser.pause(900);
    await tapCoordinate(browser, ig.searchTab.x, ig.searchTab.y, 'Search tab (reset)');
    await browser.pause(1200);
}

async function prepareComposerForHandle(browser: Browser, handle: string): Promise<void> {
    const query = handle.replace(/^@/, '');
    console.log(`Cold DM dry-run for ${handle}`);
    await openSearch(browser);
    await typeText(browser, query);
    await browser.pause(2000);
    await tapCoordinate(browser, ig.searchFirstResult.x, ig.searchFirstResult.y, 'Search first result');
    await browser.pause(2500);
    await tapCoordinate(browser, ig.profileMessage.x, ig.profileMessage.y, 'Profile Message');
    await browser.pause(2500);
    await tapCoordinate(browser, ig.dmComposer.x, ig.dmComposer.y, 'DM composer');
    await browser.pause(800);
    await clearFocusedField(browser);
    await typeText(browser, message);
    console.log(`Composer ready for ${handle} (not sending)`);
}

const remoteControl = new WdaRemoteControl({
    deviceUdid: udid,
    passcodeKeypadLayout: coordinates.passcodeKeypad,
});

console.log(
    `Starting Instagram cold DMs dry-run: handles=${handles.length} messageChars=${message.length}`
    + ` (will not tap Send)`,
);

await remoteControl.unlock(udid);

let driver: Browser | undefined;
let prepared = 0;
let failed = 0;

try {
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

    if (switchAccountName) {
        console.log(`Switching to Instagram account "${switchAccountName}"`);
        await driver.pause(2000);
        try {
            await switchInstagramAccount(driver, remoteControl, udid, switchAccountName, accountSwitchCoords);
        } catch (error) {
            console.warn(
                `Account switch skipped (${error instanceof Error ? error.message : String(error)}). `
                + 'Continuing with the currently signed-in Instagram account.',
            );
        }
    }

    for (const [index, handle] of handles.entries()) {
        if (stopRequested) {
            console.log('Stop requested — ending cold DM dry-run');
            break;
        }
        try {
            await prepareComposerForHandle(driver, handle);
            prepared += 1;
        } catch (error) {
            failed += 1;
            console.error(
                `Skipped ${handle}: ${error instanceof Error ? error.message : String(error)}`,
            );
            try {
                await leaveThreadToSearch(driver);
            } catch {
                // Best-effort recovery before the next handle.
            }
            continue;
        }
        if (index < handles.length - 1 && !stopRequested) {
            await leaveThreadToSearch(driver);
            await cancellableDelay(betweenHandleMs);
        }
    }
} finally {
    if (driver) await driver.deleteSession().catch(() => {});
}

console.log(`Cold DM dry-run finished: prepared=${prepared} failed=${failed} total=${handles.length}`);
if (prepared === 0) {
    throw new Error('Cold DM dry-run prepared zero composers — check Search / Message / DM calibrations');
}
