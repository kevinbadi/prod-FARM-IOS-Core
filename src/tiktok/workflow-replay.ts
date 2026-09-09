import { remote, type Browser } from 'webdriverio';

import { loadRegisteredDevices, resolveDeviceCoordinates, WdaRemoteControl } from '@git-agni/phone-farm-core';
import { coordinateProfile } from './runtime-settings.js';
import { tapCoordinate, typeText } from './actions.js';
import { detectEngagementControls } from './engagement-controls.js';
import {
    listWorkflowsFromPluginData,
    type WorkflowLabeledTarget,
    type WorkflowPattern,
    type WorkflowStep,
} from './workflows.js';

function positiveInteger(name: string, fallback: number): number {
    const rawValue = process.env[name] ?? String(fallback);
    const value = Number.parseInt(rawValue, 10);
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new Error(`${name} must be a positive integer; received ${rawValue}`);
    }
    return value;
}

const udid = process.env.IOS_UDID;
if (!udid) {
    throw new Error('IOS_UDID is required. Copy .env.example to .env and set the connected device UDID.');
}
const deviceUdid = udid;

const workflowId = process.env.WORKFLOW_ID?.trim();
if (!workflowId) throw new Error('WORKFLOW_ID is required');

const durationMinutesRaw = process.env.WORKFLOW_DURATION_MINUTES;
const loopsRaw = process.env.WORKFLOW_LOOPS;
const durationMinutes = durationMinutesRaw ? positiveInteger('WORKFLOW_DURATION_MINUTES', 5) : undefined;
const loops = loopsRaw ? positiveInteger('WORKFLOW_LOOPS', 1) : undefined;
if (durationMinutes === undefined && loops === undefined) {
    throw new Error('Provide WORKFLOW_DURATION_MINUTES or WORKFLOW_LOOPS');
}
if (durationMinutes !== undefined && (durationMinutes < 1 || durationMinutes > 180)) {
    throw new Error('WORKFLOW_DURATION_MINUTES must be between 1 and 180');
}
if (loops !== undefined && (loops < 1 || loops > 500)) {
    throw new Error('WORKFLOW_LOOPS must be between 1 and 500');
}

const commentOverride = (process.env.WORKFLOW_COMMENT_TEXT ?? '').trim() || undefined;
const registeredDevice = (await loadRegisteredDevices()).find((device) => device.udid === udid);
if (!registeredDevice) throw new Error(`Device ${udid} is not registered`);

const pluginData = registeredDevice.pluginData?.['com.git-agni.tiktok'] as Record<string, unknown> | undefined;
const workflows = listWorkflowsFromPluginData(pluginData);
const workflow = workflows.find((item) => item.id === workflowId);
if (!workflow) throw new Error(`Workflow ${workflowId} was not found on this device`);

const coordinates = resolveDeviceCoordinates(coordinateProfile(registeredDevice), registeredDevice.coordinates);
const tiktokCoordinates = coordinates.tiktok;
let { x: likeX, y: likeY } = tiktokCoordinates.like;
let { x: saveX, y: saveY } = tiktokCoordinates.save;

const wdaUrl = process.env.WDA_URL;
const tiktokBundleId = process.env.TIKTOK_BUNDLE_ID ?? 'com.zhiliaoapp.musically';

const capabilities: WebdriverIO.Capabilities & Record<string, unknown> = {
    platformName: 'iOS',
    'appium:automationName': 'XCUITest',
    'appium:udid': udid,
    'appium:bundleId': tiktokBundleId,
    'appium:noReset': true,
    'appium:forceAppLaunch': true,
    'appium:shouldTerminateApp': true,
    'appium:newCommandTimeout': 120,
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

function pointForLabel(label: WorkflowLabeledTarget): { x: number; y: number } | undefined {
    switch (label) {
        case 'like': return { x: likeX, y: likeY };
        case 'save': return { x: saveX, y: saveY };
        case 'comment': return tiktokCoordinates.comment;
        case 'commentComposer': return tiktokCoordinates.commentComposer;
        case 'commentSend': return tiktokCoordinates.commentSend;
        case 'homeTab': return tiktokCoordinates.homeTab;
        case 'followingTab': return tiktokCoordinates.followingTab;
        case 'swipeNext': return undefined;
        default: return undefined;
    }
}

async function swipeNext(driver: Browser): Promise<void> {
    const { x, startY, endY, durationMs } = tiktokCoordinates.swipe;
    await driver.performActions([{
        type: 'pointer',
        id: 'finger',
        parameters: { pointerType: 'touch' },
        actions: [
            { type: 'pointerMove', duration: 0, x, y: startY },
            { type: 'pointerDown', button: 0 },
            { type: 'pause', duration: 100 },
            { type: 'pointerMove', duration: durationMs, x, y: endY },
            { type: 'pointerUp', button: 0 },
        ],
    }]);
    await driver.releaseActions();
}

async function performRaw(driver: Browser, remoteControl: WdaRemoteControl, step: Extract<WorkflowStep, { kind: 'raw' }>): Promise<void> {
    const action = step.action;
    if (action.type === 'tap') {
        await tapCoordinate(driver, action.x, action.y, `raw tap`);
        return;
    }
    if (action.type === 'swipe') {
        await driver.performActions([{
            type: 'pointer',
            id: 'finger',
            parameters: { pointerType: 'touch' },
            actions: [
                { type: 'pointerMove', duration: 0, x: action.startX, y: action.startY },
                { type: 'pointerDown', button: 0 },
                { type: 'pause', duration: 80 },
                { type: 'pointerMove', duration: action.durationMs, x: action.endX, y: action.endY },
                { type: 'pointerUp', button: 0 },
            ],
        }]);
        await driver.releaseActions();
        return;
    }
    await remoteControl.performAction(deviceUdid, action);
}

async function performLabeled(
    driver: Browser,
    step: Extract<WorkflowStep, { kind: 'labeled' }>,
): Promise<void> {
    if (step.label === 'swipeNext') {
        await swipeNext(driver);
        return;
    }
    if (step.label === 'comment' && (step.text || commentOverride)) {
        const text = (step.text ?? commentOverride)!.trim();
        await tapCoordinate(driver, tiktokCoordinates.comment.x, tiktokCoordinates.comment.y, 'Comment');
        await driver.pause(700);
        await tapCoordinate(driver, tiktokCoordinates.commentComposer.x, tiktokCoordinates.commentComposer.y, 'Comment composer');
        await driver.pause(300);
        await typeText(driver, text);
        await driver.pause(250);
        await tapCoordinate(driver, tiktokCoordinates.commentSend.x, tiktokCoordinates.commentSend.y, 'Comment send');
        await driver.pause(600);
        return;
    }
    const point = pointForLabel(step.label);
    if (!point) throw new Error(`No coordinates for workflow label ${step.label}`);
    await tapCoordinate(driver, point.x, point.y, step.label);
}

async function runPatternOnce(driver: Browser, remoteControl: WdaRemoteControl, pattern: WorkflowPattern): Promise<void> {
    for (const timed of pattern.steps) {
        if (stopRequested) return;
        const { step } = timed;
        if (step.kind === 'wait') {
            await cancellableDelay(Math.min(step.durationMs, 30_000));
            continue;
        }
        if (step.kind === 'labeled') {
            await performLabeled(driver, step);
            continue;
        }
        await performRaw(driver, remoteControl, step);
    }
}

let driver: Browser | undefined;
const runStartedAt = Date.now();
let completedLoops = 0;

console.log(
    `Starting workflow replay: id=${workflow.id} name=${workflow.name}`
    + ` steps=${workflow.steps.length}`
    + (durationMinutes !== undefined ? ` durationMinutes=${durationMinutes}` : ` loops=${loops}`),
);

try {
    const remoteControl = new WdaRemoteControl({
        deviceUdid: udid,
        wdaUrl,
        passcodeKeypadLayout: coordinates.passcodeKeypad,
    });
    await remoteControl.unlock(udid);

    driver = await remote({
        hostname: process.env.APPIUM_HOST ?? '127.0.0.1',
        port: positiveInteger('APPIUM_PORT', 4725),
        path: '/',
        logLevel: 'info',
        connectionRetryCount: 0,
        connectionRetryTimeout: 180000,
        capabilities,
    });
    await driver.updateSettings({ defaultActiveApplication: tiktokBundleId });
    await driver.pause(2500);

    try {
        const overrides = registeredDevice.coordinates ?? {};
        if (!overrides.like && !overrides.save) {
            const [screenshot, screen] = await Promise.all([
                remoteControl.getScreenshot(udid),
                remoteControl.getScreenInfo(udid),
            ]);
            const detected = await detectEngagementControls(screenshot, screen.scale);
            if (detected) {
                ({ x: likeX, y: likeY } = detected.like);
                ({ x: saveX, y: saveY } = detected.save);
                console.log(`Detected engagement controls for labeled replay: like=(${likeX}, ${likeY}) save=(${saveX}, ${saveY})`);
            }
        }
    } catch (error) {
        console.log(`Engagement detection skipped: ${error instanceof Error ? error.message : String(error)}`);
    }

    const deadline = durationMinutes !== undefined
        ? Date.now() + durationMinutes * 60_000
        : Number.POSITIVE_INFINITY;
    const maxLoops = loops ?? Number.POSITIVE_INFINITY;

    while (!stopRequested && completedLoops < maxLoops && Date.now() < deadline) {
        console.log(`Workflow loop ${completedLoops + 1}`);
        await runPatternOnce(driver, remoteControl, workflow);
        completedLoops += 1;
    }

    const reason = stopRequested ? 'stopped' : 'completed';
    console.log(`Finished workflow replay: loops=${completedLoops} elapsedMs=${Date.now() - runStartedAt} reason=${reason}`);
} finally {
    if (driver) await driver.deleteSession();
}
