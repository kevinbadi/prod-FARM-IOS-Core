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

/** Open inbox via Home bottom-nav paper plane, then inbox header pencil. */
async function openNewMessageComposer(browser: Browser): Promise<void> {
    console.log(
        `Opening DM inbox (paper plane) at (${ig.dmCompose.x}, ${ig.dmCompose.y})`,
    );
    await tapCoordinate(browser, ig.dmCompose.x, ig.dmCompose.y, 'DM Compose');
    // Wait for inbox chrome before the top-right pencil — on Home that same
    // corner is the heart (notifications), which is what a premature tap hits.
    await browser.pause(3500);
    console.log(
        `Opening compose new message at (${ig.composeNewMessage.x}, ${ig.composeNewMessage.y})`,
    );
    await tapCoordinate(
        browser,
        ig.composeNewMessage.x,
        ig.composeNewMessage.y,
        'Compose new message',
    );
    await browser.pause(2000);
}

async function returnToHome(browser: Browser): Promise<void> {
    console.log('Returning to Home after send');
    // Leave the open thread (top-left chevron).
    await tapCoordinate(browser, ig.dmBack.x, ig.dmBack.y, 'DM back (leave thread)');
    await browser.pause(1600);
    // Floating Home icon is on the same pill row as Messages (dmCompose.y ≈ 825),
    // not the older homeTab seed at y=852 which misses the bar.
    const homeX = ig.homeTab.x;
    const homeY = ig.dmCompose.y;
    console.log(`Tapping Home tab at (${homeX}, ${homeY})`);
    await tapCoordinate(browser, homeX, homeY, 'Home tab');
    await browser.pause(2000);
}

async function sendMessageToHandle(browser: Browser, handle: string): Promise<void> {
    const query = handle.replace(/^@/, '');
    console.log(`Cold DM send for ${handle}`);
    await openNewMessageComposer(browser);
    // "New message" To: field — reuse searchField calibration on that screen.
    await tapCoordinate(browser, ig.searchField.x, ig.searchField.y, 'New message To: field');
    await browser.pause(800);
    await clearFocusedField(browser);
    await typeText(browser, query);
    // Instagram needs a recipient chosen from the list before the thread opens.
    await browser.pause(3000);
    console.log(
        `Selecting top search result at (${ig.searchFirstResult.x}, ${ig.searchFirstResult.y})`,
    );
    await tapCoordinate(
        browser,
        ig.searchFirstResult.x,
        ig.searchFirstResult.y,
        'Top search result',
    );
    await browser.pause(1500);
    console.log(
        `Confirming with blue arrow at (${ig.dmSearchSubmit.x}, ${ig.dmSearchSubmit.y})`,
    );
    await tapCoordinate(
        browser,
        ig.dmSearchSubmit.x,
        ig.dmSearchSubmit.y,
        'New message blue arrow',
    );
    await browser.pause(2500);
    console.log(
        `Focusing Message field at (${ig.dmComposer.x}, ${ig.dmComposer.y})`,
    );
    await tapCoordinate(browser, ig.dmComposer.x, ig.dmComposer.y, 'Message field');
    await browser.pause(1000);
    await clearFocusedField(browser);
    await typeText(browser, message);
    await browser.pause(800);
    console.log(`Sending DM at (${ig.dmSend.x}, ${ig.dmSend.y})`);
    await tapCoordinate(browser, ig.dmSend.x, ig.dmSend.y, 'DM Send');
    await browser.pause(2000);
    console.log(`Sent DM to ${handle}`);
}

const cycles = positiveInteger('COLD_DMS_CYCLES', 1);
const sequence = handles.flatMap((handle) => Array.from({ length: cycles }, () => handle));

const remoteControl = new WdaRemoteControl({
    deviceUdid: udid,
    passcodeKeypadLayout: coordinates.passcodeKeypad,
});

console.log(
    `Starting Instagram cold DMs: handles=${handles.length} cycles=${cycles} `
    + `sends=${sequence.length} messageChars=${message.length}`,
);

await remoteControl.unlock(udid);

let driver: Browser | undefined;
let sent = 0;
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

    // Land on Home so the first paper-plane tap is reliable.
    await tapCoordinate(driver, ig.homeTab.x, ig.homeTab.y, 'Home tab');
    await driver.pause(1500);

    for (const [index, handle] of sequence.entries()) {
        if (stopRequested) {
            console.log('Stop requested — ending cold DMs');
            break;
        }
        try {
            await sendMessageToHandle(driver, handle);
            sent += 1;
        } catch (error) {
            failed += 1;
            console.error(
                `Skipped ${handle}: ${error instanceof Error ? error.message : String(error)}`,
            );
            try {
                await returnToHome(driver);
            } catch {
                // Best-effort recovery before the next send.
            }
            continue;
        }
        if (index < sequence.length - 1 && !stopRequested) {
            await returnToHome(driver);
            await cancellableDelay(betweenHandleMs);
        }
    }
} finally {
    if (driver) await driver.deleteSession().catch(() => {});
}

console.log(`Cold DMs finished: sent=${sent} failed=${failed} total=${sequence.length}`);
if (sent === 0) {
    throw new Error('Cold DMs sent zero messages — check DM Compose / recipient / Send calibrations');
}
