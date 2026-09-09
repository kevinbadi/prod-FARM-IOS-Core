export {};

interface ScreenSize {
    width: number;
    height: number;
}

interface DeviceConnectionStatus {
    physical: 'connected' | 'disconnected';
    wda: 'disconnected' | 'connecting' | 'unlock-required' | 'ready' | 'error';
    appium: 'ready' | 'unavailable';
    message: string;
}

type RemoteAction =
    | { type: 'tap'; x: number; y: number }
    | { type: 'home' }
    | { type: 'lock' }
    | { type: 'wake' }
    | { type: 'unlock' }
    | { type: 'volumeUp' }
    | { type: 'volumeDown' }
    | { type: 'swipe'; startX: number; startY: number; endX: number; endY: number; durationMs: number };

type SwipeDirection = 'left' | 'right' | 'up' | 'down';

interface Point {
    x: number;
    y: number;
    time?: number;
}

interface PostRun {
    status: 'idle' | 'running' | 'succeeded' | 'failed';
    destination: 'draft' | 'publish' | null;
    logs: string[];
}

type SocialTaskType = 'doomscroll' | 'doomscroll-following' | 'post';
type SocialPluginId = 'com.git-agni.tiktok' | 'com.git-agni.instagram' | string;
type CalibrateApp = 'tiktok' | 'instagram';

interface DeviceSchedule {
    id: string;
    pluginId: SocialPluginId;
    status: 'active' | 'paused' | 'completed' | 'cancelled';
    taskType: SocialTaskType;
    timing: { kind: string; localTime?: string; timezone?: string; weekdays?: number[]; runAt?: string };
    nextRunAt: string | null;
    payload: {
        type: SocialTaskType;
        destination?: 'draft' | 'publish';
        account?: string;
        durationMinutes?: number;
        personality?: string;
    };
}

interface DeviceExecution {
    id: string;
    pluginId: SocialPluginId;
    taskType: SocialTaskType;
    status: string;
    scheduledFor: string;
    startedAt: string | null;
    finishedAt: string | null;
    error: string | null;
}

function element<T extends Element>(selector: string): T {
    const value = document.querySelector<T>(selector);
    if (!value) throw new Error(`Missing element: ${selector}`);
    return value;
}

const udid = decodeURIComponent(location.pathname.split('/').filter(Boolean).at(-1) ?? '');
const elements = {
    screen: element<HTMLImageElement>('#screen'),
    status: element<HTMLElement>('#status'),
    statusText: element<HTMLElement>('#status span:last-child'),
    refresh: element<HTMLButtonElement>('#refresh'),
    toggle: element<HTMLButtonElement>('#toggle'),
    remoteButtons: Array.from(document.querySelectorAll<HTMLButtonElement>('[data-remote-action]')),
    openPost: element<HTMLButtonElement>('#open-post'),
    openDoomscroll: element<HTMLButtonElement>('#open-doomscroll'),
    doomscrollDialog: element<HTMLDialogElement>('#doomscroll-dialog'),
    closeDoomscroll: element<HTMLButtonElement>('#close-doomscroll'),
    cancelDoomscroll: element<HTMLButtonElement>('#cancel-doomscroll'),
    doomscrollDuration: element<HTMLInputElement>('#doomscroll-duration'),
    doomscrollDurationButtons: Array.from(document.querySelectorAll<HTMLButtonElement>('[data-doomscroll-duration]')),
    postDialog: element<HTMLDialogElement>('#post-dialog'),
    postForm: element<HTMLFormElement>('#post-form'),
    closePost: element<HTMLButtonElement>('#close-post'),
    cancelPost: element<HTMLButtonElement>('#cancel-post'),
    submitPost: element<HTMLButtonElement>('#submit-post'),
    media: element<HTMLInputElement>('#media'),
    mediaList: element<HTMLOListElement>('#media-list'),
    musicUrl: element<HTMLInputElement>('#music-url'),
    caption: element<HTMLTextAreaElement>('#caption'),
    postAccount: element<HTMLSelectElement>('#post-account'),
    publishConfirm: element<HTMLElement>('#publish-confirm'),
    confirmPublish: element<HTMLInputElement>('#confirm-publish'),
    postResult: element<HTMLElement>('#post-result'),
    doomscrollForm: element<HTMLFormElement>('#doomscroll-form'),
    doomscrollRecurring: element<HTMLInputElement>('#doomscroll-recurring'),
    doomscrollStartOptions: element<HTMLElement>('#doomscroll-start-options'),
    doomscrollStartKind: element<HTMLSelectElement>('#doomscroll-start-kind'),
    doomscrollOnceFields: element<HTMLElement>('#doomscroll-once-fields'),
    doomscrollRecurringFields: element<HTMLElement>('#doomscroll-recurring-fields'),
    doomscrollFrequency: element<HTMLSelectElement>('#doomscroll-frequency'),
    doomscrollWeekdayFields: element<HTMLElement>('#doomscroll-weekday-fields'),
    doomscrollWeekdayInputs: Array.from(document.querySelectorAll<HTMLInputElement>('#doomscroll-weekday-fields input[type="checkbox"]')),
    doomscrollRunWindowField: element<HTMLElement>('#doomscroll-run-window-field'),
    doomscrollScheduleKind: element<HTMLInputElement>('#doomscroll-schedule-kind'),
    doomscrollWeekdays: element<HTMLInputElement>('#doomscroll-weekdays'),
    doomscrollRunAt: element<HTMLInputElement>('#doomscroll-run-at'),
    doomscrollRunAtIso: element<HTMLInputElement>('#doomscroll-run-at-iso'),
    doomscrollResult: element<HTMLElement>('#doomscroll-result'),
    doomscrollCommentEnabled: element<HTMLInputElement>('#doomscroll-comment-enabled'),
    doomscrollCommentText: element<HTMLInputElement>('#doomscroll-comment-text'),
    openFollowingDoomscroll: element<HTMLButtonElement>('#open-following-doomscroll'),
    followingDoomscrollDialog: element<HTMLDialogElement>('#following-doomscroll-dialog'),
    closeFollowingDoomscroll: element<HTMLButtonElement>('#close-following-doomscroll'),
    cancelFollowingDoomscroll: element<HTMLButtonElement>('#cancel-following-doomscroll'),
    followingDoomscrollForm: element<HTMLFormElement>('#following-doomscroll-form'),
    followingDoomscrollDuration: element<HTMLInputElement>('#following-doomscroll-duration'),
    followingDoomscrollDurationButtons: Array.from(document.querySelectorAll<HTMLButtonElement>('[data-following-doomscroll-duration]')),
    followingCommentEnabled: element<HTMLInputElement>('#following-comment-enabled'),
    followingCommentText: element<HTMLInputElement>('#following-comment-text'),
    followingDoomscrollResult: element<HTMLElement>('#following-doomscroll-result'),
    trainToggle: element<HTMLButtonElement>('#train-toggle'),
    trainSave: element<HTMLButtonElement>('#train-save'),
    trainClear: element<HTMLButtonElement>('#train-clear'),
    trainStatus: element<HTMLElement>('#train-status'),
    trainSteps: element<HTMLOListElement>('#train-steps'),
    trainSaveDialog: element<HTMLDialogElement>('#train-save-dialog'),
    trainSaveForm: element<HTMLFormElement>('#train-save-form'),
    closeTrainSave: element<HTMLButtonElement>('#close-train-save'),
    cancelTrainSave: element<HTMLButtonElement>('#cancel-train-save'),
    trainWorkflowName: element<HTMLInputElement>('#train-workflow-name'),
    trainWorkflowFeed: element<HTMLSelectElement>('#train-workflow-feed'),
    trainSaveResult: element<HTMLElement>('#train-save-result'),
    refreshWorkflows: element<HTMLButtonElement>('#refresh-workflows'),
    workflowList: element<HTMLElement>('#workflow-list'),
    openInstagramPost: element<HTMLButtonElement>('#open-instagram-post'),
    openInstagramDoomscroll: element<HTMLButtonElement>('#open-instagram-doomscroll'),
    instagramDoomscrollDialog: element<HTMLDialogElement>('#instagram-doomscroll-dialog'),
    closeInstagramDoomscroll: element<HTMLButtonElement>('#close-instagram-doomscroll'),
    cancelInstagramDoomscroll: element<HTMLButtonElement>('#cancel-instagram-doomscroll'),
    instagramDoomscrollDuration: element<HTMLInputElement>('#instagram-doomscroll-duration'),
    instagramDoomscrollDurationButtons: Array.from(document.querySelectorAll<HTMLButtonElement>('[data-instagram-doomscroll-duration]')),
    instagramPostDialog: element<HTMLDialogElement>('#instagram-post-dialog'),
    instagramPostForm: element<HTMLFormElement>('#instagram-post-form'),
    closeInstagramPost: element<HTMLButtonElement>('#close-instagram-post'),
    cancelInstagramPost: element<HTMLButtonElement>('#cancel-instagram-post'),
    submitInstagramPost: element<HTMLButtonElement>('#submit-instagram-post'),
    instagramMedia: element<HTMLInputElement>('#instagram-media'),
    instagramMediaList: element<HTMLOListElement>('#instagram-media-list'),
    instagramMusicUrl: element<HTMLInputElement>('#instagram-music-url'),
    instagramCaption: element<HTMLTextAreaElement>('#instagram-caption'),
    instagramPostAccount: element<HTMLSelectElement>('#instagram-post-account'),
    instagramPublishConfirm: element<HTMLElement>('#instagram-publish-confirm'),
    instagramConfirmPublish: element<HTMLInputElement>('#instagram-confirm-publish'),
    instagramPostResult: element<HTMLElement>('#instagram-post-result'),
    instagramDoomscrollForm: element<HTMLFormElement>('#instagram-doomscroll-form'),
    instagramDoomscrollRecurring: element<HTMLInputElement>('#instagram-doomscroll-recurring'),
    instagramDoomscrollStartOptions: element<HTMLElement>('#instagram-doomscroll-start-options'),
    instagramDoomscrollStartKind: element<HTMLSelectElement>('#instagram-doomscroll-start-kind'),
    instagramDoomscrollOnceFields: element<HTMLElement>('#instagram-doomscroll-once-fields'),
    instagramDoomscrollRecurringFields: element<HTMLElement>('#instagram-doomscroll-recurring-fields'),
    instagramDoomscrollFrequency: element<HTMLSelectElement>('#instagram-doomscroll-frequency'),
    instagramDoomscrollWeekdayFields: element<HTMLElement>('#instagram-doomscroll-weekday-fields'),
    instagramDoomscrollWeekdayInputs: Array.from(document.querySelectorAll<HTMLInputElement>('#instagram-doomscroll-weekday-fields input[type="checkbox"]')),
    instagramDoomscrollRunWindowField: element<HTMLElement>('#instagram-doomscroll-run-window-field'),
    instagramDoomscrollScheduleKind: element<HTMLInputElement>('#instagram-doomscroll-schedule-kind'),
    instagramDoomscrollWeekdays: element<HTMLInputElement>('#instagram-doomscroll-weekdays'),
    instagramDoomscrollRunAt: element<HTMLInputElement>('#instagram-doomscroll-run-at'),
    instagramDoomscrollRunAtIso: element<HTMLInputElement>('#instagram-doomscroll-run-at-iso'),
    instagramDoomscrollResult: element<HTMLElement>('#instagram-doomscroll-result'),
    timezoneInputs: Array.from(document.querySelectorAll<HTMLInputElement>('.browser-timezone')),
    postRecurring: element<HTMLInputElement>('#post-recurring'),
    postStartOptions: element<HTMLElement>('#post-start-options'),
    postStartKind: element<HTMLSelectElement>('#post-start-kind'),
    postOnceFields: element<HTMLElement>('#post-once-fields'),
    postRecurringFields: element<HTMLElement>('#post-recurring-fields'),
    postFrequency: element<HTMLSelectElement>('#post-frequency'),
    postWeekdayFields: element<HTMLElement>('#post-weekday-fields'),
    postWeekdayInputs: Array.from(document.querySelectorAll<HTMLInputElement>('#post-weekday-fields input[type="checkbox"]')),
    postRunWindowField: element<HTMLElement>('#post-run-window-field'),
    postRunAt: element<HTMLInputElement>('#post-run-at'),
    postLocalTime: element<HTMLInputElement>('#post-local-time'),
    postRunWindow: element<HTMLInputElement>('#post-run-window'),
    instagramPostRecurring: element<HTMLInputElement>('#instagram-post-recurring'),
    instagramPostStartOptions: element<HTMLElement>('#instagram-post-start-options'),
    instagramPostStartKind: element<HTMLSelectElement>('#instagram-post-start-kind'),
    instagramPostOnceFields: element<HTMLElement>('#instagram-post-once-fields'),
    instagramPostRecurringFields: element<HTMLElement>('#instagram-post-recurring-fields'),
    instagramPostFrequency: element<HTMLSelectElement>('#instagram-post-frequency'),
    instagramPostWeekdayFields: element<HTMLElement>('#instagram-post-weekday-fields'),
    instagramPostWeekdayInputs: Array.from(document.querySelectorAll<HTMLInputElement>('#instagram-post-weekday-fields input[type="checkbox"]')),
    instagramPostRunWindowField: element<HTMLElement>('#instagram-post-run-window-field'),
    instagramPostRunAt: element<HTMLInputElement>('#instagram-post-run-at'),
    instagramPostLocalTime: element<HTMLInputElement>('#instagram-post-local-time'),
    instagramPostRunWindow: element<HTMLInputElement>('#instagram-post-run-window'),
    accountsForm: element<HTMLFormElement>('#accounts-form'),
    deviceAccounts: element<HTMLInputElement>('#device-accounts'),
    accountsResult: element<HTMLElement>('#accounts-result'),
    accountsDialog: element<HTMLDialogElement>('#accounts-dialog'),
    openAccounts: element<HTMLButtonElement>('#open-accounts'),
    closeAccounts: element<HTMLButtonElement>('#close-accounts'),
    instagramAccountsForm: element<HTMLFormElement>('#instagram-accounts-form'),
    instagramDeviceAccounts: element<HTMLInputElement>('#instagram-device-accounts'),
    instagramAccountsResult: element<HTMLElement>('#instagram-accounts-result'),
    instagramAccountsDialog: element<HTMLDialogElement>('#instagram-accounts-dialog'),
    openInstagramAccounts: element<HTMLButtonElement>('#open-instagram-accounts'),
    closeInstagramAccounts: element<HTMLButtonElement>('#close-instagram-accounts'),
    passcodeDialog: element<HTMLDialogElement>('#passcode-dialog'),
    openPasscode: element<HTMLButtonElement>('#open-passcode'),
    closePasscode: element<HTMLButtonElement>('#close-passcode'),
    removeDialog: element<HTMLDialogElement>('#remove-dialog'),
    openRemove: element<HTMLButtonElement>('#open-remove'),
    closeRemove: element<HTMLButtonElement>('#close-remove'),
    deviceSchedules: element<HTMLElement>('#device-schedules'),
    deviceExecutions: element<HTMLElement>('#device-executions'),
    deviceQueueStatus: element<HTMLElement>('#device-queue-status'),
    clearDeviceQueue: element<HTMLButtonElement>('#clear-device-queue'),
    tasksDialog: element<HTMLDialogElement>('#tasks-dialog'),
    openTasks: element<HTMLButtonElement>('#open-tasks'),
    closeTasks: element<HTMLButtonElement>('#close-tasks'),
    passcodeForm: element<HTMLFormElement>('#passcode-form'),
    devicePasscode: element<HTMLInputElement>('#device-passcode'),
    passcodeClear: element<HTMLButtonElement>('#passcode-clear'),
    passcodeState: element<HTMLElement>('#passcode-state'),
    passcodeResult: element<HTMLElement>('#passcode-result'),
    openCalibrate: element<HTMLButtonElement>('#open-calibrate'),
    calibrateDialog: element<HTMLDialogElement>('#calibrate-dialog'),
    closeCalibrate: element<HTMLButtonElement>('#close-calibrate'),
    calApp: element<HTMLSelectElement>('#cal-app'),
    calScreen: element<HTMLImageElement>('#cal-screen'),
    calControl: element<HTMLInputElement>('#cal-control'),
    calUnlock: element<HTMLButtonElement>('#cal-unlock'),
    calMarkers: element<HTMLElement>('#cal-markers'),
    calPoints: element<HTMLElement>('#cal-points'),
    calStatus: element<HTMLElement>('#cal-status'),
    calProfile: element<HTMLElement>('#cal-profile'),
    calResetAll: element<HTMLButtonElement>('#cal-reset-all'),
    calCancel: element<HTMLButtonElement>('#cal-cancel'),
    calSave: element<HTMLButtonElement>('#cal-save'),
    removeDevice: element<HTMLButtonElement>('#remove-device'),
    removeResult: element<HTMLElement>('#remove-result'),
};

let screenSize: ScreenSize | undefined;
let paused = false;
let connecting = false;
let pointerStart: Point | undefined;
type RecordedTrainEvent = { t: number; action: RemoteAction };
let trainRecording = false;
let trainStartedAt = 0;
let trainEvents: RecordedTrainEvent[] = [];

function summarizeTrainAction(action: RemoteAction): string {
    if (action.type === 'tap') return `tap (${action.x}, ${action.y})`;
    if (action.type === 'swipe') {
        return `swipe (${action.startX},${action.startY})→(${action.endX},${action.endY})`;
    }
    return action.type;
}

function renderTrainSteps(): void {
    elements.trainSteps.innerHTML = '';
    for (const event of trainEvents) {
        const li = document.createElement('li');
        li.textContent = `+${event.t}ms · ${summarizeTrainAction(event.action)}`;
        elements.trainSteps.append(li);
    }
    elements.trainSteps.hidden = trainEvents.length === 0;
    elements.trainStatus.textContent = trainRecording
        ? `Recording… ${trainEvents.length} gesture${trainEvents.length === 1 ? '' : 's'}`
        : (trainEvents.length ? `${trainEvents.length} gestures ready to save` : '');
}

function recordTrainEvent(action: RemoteAction): void {
    if (!trainRecording) return;
    const t = Math.max(0, Math.round(performance.now() - trainStartedAt));
    trainEvents.push({ t, action });
    renderTrainSteps();
}

function setTrainRecording(active: boolean): void {
    trainRecording = active;
    if (active) {
        trainStartedAt = performance.now();
        trainEvents = [];
    }
    elements.trainToggle.textContent = active ? 'Stop training' : 'Train workflow';
    elements.trainSave.hidden = active || trainEvents.length === 0;
    elements.trainClear.hidden = trainEvents.length === 0 && !active;
    renderTrainSteps();
}
let orderedMedia: File[] = [];
let instagramOrderedMedia: File[] = [];
let postPoll: number | undefined;
let instagramPostPoll: number | undefined;
let connectionPoll: number | undefined;
let connectionChecking = false;
const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
elements.timezoneInputs.forEach((input) => { input.value = browserTimezone; });

function selectedWeekdays(inputs: HTMLInputElement[]): number[] {
    return inputs.filter(({ checked }) => checked).map(({ value }) => Number(value));
}

function updateDoomscrollSchedule(): void {
    const recurring = elements.doomscrollRecurring.checked;
    const kind = recurring ? elements.doomscrollFrequency.value : elements.doomscrollStartKind.value;
    elements.doomscrollScheduleKind.value = kind;
    elements.doomscrollWeekdays.value = selectedWeekdays(elements.doomscrollWeekdayInputs).join(',');
    elements.doomscrollStartOptions.hidden = recurring;
    elements.doomscrollOnceFields.hidden = recurring || kind !== 'once';
    elements.doomscrollRecurringFields.hidden = !recurring;
    elements.doomscrollWeekdayFields.hidden = !recurring || kind !== 'weekly';
    elements.doomscrollRunWindowField.hidden = kind === 'now';
    elements.doomscrollRunAt.required = kind === 'once';
}

function updateInstagramDoomscrollSchedule(): void {
    const recurring = elements.instagramDoomscrollRecurring.checked;
    const kind = recurring ? elements.instagramDoomscrollFrequency.value : elements.instagramDoomscrollStartKind.value;
    elements.instagramDoomscrollScheduleKind.value = kind;
    elements.instagramDoomscrollWeekdays.value = selectedWeekdays(elements.instagramDoomscrollWeekdayInputs).join(',');
    elements.instagramDoomscrollStartOptions.hidden = recurring;
    elements.instagramDoomscrollOnceFields.hidden = recurring || kind !== 'once';
    elements.instagramDoomscrollRecurringFields.hidden = !recurring;
    elements.instagramDoomscrollWeekdayFields.hidden = !recurring || kind !== 'weekly';
    elements.instagramDoomscrollRunWindowField.hidden = kind === 'now';
    elements.instagramDoomscrollRunAt.required = kind === 'once';
}

function updatePostSchedule(): void {
    const recurring = elements.postRecurring.checked;
    const kind = recurring ? elements.postFrequency.value : elements.postStartKind.value;
    elements.postStartOptions.hidden = recurring;
    elements.postOnceFields.hidden = recurring || kind !== 'once';
    elements.postRecurringFields.hidden = !recurring;
    elements.postWeekdayFields.hidden = !recurring || kind !== 'weekly';
    elements.postRunWindowField.hidden = kind === 'now';
    elements.postRunAt.required = kind === 'once';
}

function updateInstagramPostSchedule(): void {
    const recurring = elements.instagramPostRecurring.checked;
    const kind = recurring ? elements.instagramPostFrequency.value : elements.instagramPostStartKind.value;
    elements.instagramPostStartOptions.hidden = recurring;
    elements.instagramPostOnceFields.hidden = recurring || kind !== 'once';
    elements.instagramPostRecurringFields.hidden = !recurring;
    elements.instagramPostWeekdayFields.hidden = !recurring || kind !== 'weekly';
    elements.instagramPostRunWindowField.hidden = kind === 'now';
    elements.instagramPostRunAt.required = kind === 'once';
}

elements.doomscrollRecurring.addEventListener('change', updateDoomscrollSchedule);
elements.doomscrollStartKind.addEventListener('change', updateDoomscrollSchedule);
elements.doomscrollFrequency.addEventListener('change', updateDoomscrollSchedule);
elements.doomscrollWeekdayInputs.forEach((input) => input.addEventListener('change', updateDoomscrollSchedule));
elements.instagramDoomscrollRecurring.addEventListener('change', updateInstagramDoomscrollSchedule);
elements.instagramDoomscrollStartKind.addEventListener('change', updateInstagramDoomscrollSchedule);
elements.instagramDoomscrollFrequency.addEventListener('change', updateInstagramDoomscrollSchedule);
elements.instagramDoomscrollWeekdayInputs.forEach((input) => input.addEventListener('change', updateInstagramDoomscrollSchedule));
elements.postRecurring.addEventListener('change', updatePostSchedule);
elements.postStartKind.addEventListener('change', updatePostSchedule);
elements.postFrequency.addEventListener('change', updatePostSchedule);
elements.instagramPostRecurring.addEventListener('change', updateInstagramPostSchedule);
elements.instagramPostStartKind.addEventListener('change', updateInstagramPostSchedule);
elements.instagramPostFrequency.addEventListener('change', updateInstagramPostSchedule);
elements.doomscrollForm.addEventListener('submit', () => {
    updateDoomscrollSchedule();
    elements.doomscrollResult.textContent = 'Starting…';
    elements.doomscrollRunAtIso.value = elements.doomscrollRunAt.value
        ? new Date(elements.doomscrollRunAt.value).toISOString()
        : '';
});
elements.instagramDoomscrollForm.addEventListener('submit', () => {
    updateInstagramDoomscrollSchedule();
    elements.instagramDoomscrollResult.textContent = 'Starting…';
    elements.instagramDoomscrollRunAtIso.value = elements.instagramDoomscrollRunAt.value
        ? new Date(elements.instagramDoomscrollRunAt.value).toISOString()
        : '';
});
elements.openDoomscroll.addEventListener('click', () => elements.doomscrollDialog.showModal());
elements.doomscrollCommentEnabled.addEventListener('change', () => {
    elements.doomscrollCommentText.disabled = !elements.doomscrollCommentEnabled.checked;
    if (elements.doomscrollCommentEnabled.checked && !elements.doomscrollCommentText.value.trim()) {
        elements.doomscrollCommentText.value = '🔥';
    }
});
elements.closeDoomscroll.addEventListener('click', () => elements.doomscrollDialog.close());
elements.cancelDoomscroll.addEventListener('click', () => elements.doomscrollDialog.close());
elements.doomscrollDurationButtons.forEach((button) => {
    button.addEventListener('click', () => {
        elements.doomscrollDuration.value = button.dataset.doomscrollDuration ?? '';
    });
});
elements.openInstagramDoomscroll.addEventListener('click', () => elements.instagramDoomscrollDialog.showModal());
elements.closeInstagramDoomscroll.addEventListener('click', () => elements.instagramDoomscrollDialog.close());
elements.cancelInstagramDoomscroll.addEventListener('click', () => elements.instagramDoomscrollDialog.close());
elements.instagramDoomscrollDurationButtons.forEach((button) => {
    button.addEventListener('click', () => {
        elements.instagramDoomscrollDuration.value = button.dataset.instagramDoomscrollDuration ?? '';
    });
});

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function setStatus(message: string, state = ''): void {
    elements.status.className = `status ${state}`;
    elements.statusText.textContent = message;
}

async function jsonRequest<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(url, options);
    const data = await response.json() as T & { error?: string };
    if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`);
    return data;
}

function startStream(): void {
    if (paused || !screenSize) return;
    setStatus('Connecting video stream…');
    elements.screen.src = `/api/devices/${encodeURIComponent(udid)}/remote/stream?t=${Date.now()}`;
}

async function connectRemote(): Promise<void> {
    if (paused || connecting || !screenSize) return;
    connecting = true;
    try {
        startStream();
    } finally {
        connecting = false;
    }
}

async function pollConnection(reloadWhenReady = false): Promise<void> {
    if (connectionChecking) return;
    connectionChecking = true;
    window.clearTimeout(connectionPoll);
    try {
        const connection = await jsonRequest<DeviceConnectionStatus>(
            `/api/devices/${encodeURIComponent(udid)}/connection`,
        );
        if (connection.wda === 'ready') {
            if (reloadWhenReady) {
                location.reload();
                return;
            }
            connectionPoll = window.setTimeout(() => void connectRemote(), 2_000);
            return;
        }
        const appium = connection.appium === 'ready' ? '' : ' Appium is unavailable.';
        setStatus(`${connection.message}.${appium}`.replace('..', '.'), connection.wda === 'error' ? 'error' : '');
        connectionPoll = window.setTimeout(() => void pollConnection(reloadWhenReady), 2_000);
    } catch (error) {
        setStatus(errorMessage(error), 'error');
        connectionPoll = window.setTimeout(() => void pollConnection(reloadWhenReady), 2_000);
    } finally {
        connectionChecking = false;
    }
}

function useDeviceSummary(summary: HTMLElement): void {
    const width = Number(summary.dataset.screenWidth);
    const height = Number(summary.dataset.screenHeight);
    if (!Number.isFinite(width) || !Number.isFinite(height)) return;
    screenSize = { width, height };
    const name = summary.querySelector('h1')?.textContent;
    if (name) document.title = `${name} · iOS Automation`;
    void connectRemote();
}

document.addEventListener('htmx:afterSwap', () => {
    const summary = document.querySelector<HTMLElement>('#device-summary[data-screen-width]');
    if (summary) useDeviceSummary(summary);
});

document.addEventListener('htmx:afterRequest', (event) => {
    const detail = (event as CustomEvent<{
        elt?: Element;
        successful?: boolean;
        xhr?: XMLHttpRequest;
    }>).detail;
    if (detail?.elt === elements.doomscrollForm) {
        if (detail.successful) {
            elements.doomscrollResult.textContent = '';
            elements.doomscrollDialog.close();
        } else {
            const message = detail.xhr?.responseText?.match(/<p class="run-error">([^<]+)<\/p>/)?.[1]
                ?? 'Could not start doomscroll. Check Activity for details.';
            elements.doomscrollResult.textContent = message.trim();
        }
    }
    if (detail?.elt === elements.instagramDoomscrollForm) {
        if (detail.successful) {
            elements.instagramDoomscrollResult.textContent = '';
            elements.instagramDoomscrollDialog.close();
        } else {
            const message = detail.xhr?.responseText?.match(/<p class="run-error">([^<]+)<\/p>/)?.[1]
                ?? 'Could not start doomscroll. Check Activity for details.';
            elements.instagramDoomscrollResult.textContent = message.trim();
        }
    }
});

function containContentBox(
    element: HTMLElement,
    mediaWidth: number,
    mediaHeight: number,
): { left: number; top: number; width: number; height: number; elementWidth: number; elementHeight: number } {
    const rect = element.getBoundingClientRect();
    const mw = mediaWidth > 0 ? mediaWidth : rect.width;
    const mh = mediaHeight > 0 ? mediaHeight : rect.height;
    const scale = Math.min(rect.width / mw, rect.height / mh);
    const width = mw * scale;
    const height = mh * scale;
    return {
        left: rect.left + (rect.width - width) / 2,
        top: rect.top + (rect.height - height) / 2,
        width,
        height,
        elementWidth: rect.width,
        elementHeight: rect.height,
    };
}

/** Map a pointer event on an object-fit:contain image to device points. */
function pointFromContainedMedia(
    event: PointerEvent | MouseEvent,
    img: HTMLImageElement,
    deviceSize: ScreenSize,
): Point {
    const mediaW = img.naturalWidth || deviceSize.width;
    const mediaH = img.naturalHeight || deviceSize.height;
    const box = containContentBox(img, mediaW, mediaH);
    if (box.width <= 0 || box.height <= 0) {
        throw new Error('Screen content size is unavailable');
    }
    const x = ((event.clientX - box.left) / box.width) * deviceSize.width;
    const y = ((event.clientY - box.top) / box.height) * deviceSize.height;
    return {
        x: Math.max(0, Math.min(deviceSize.width, Math.round(x))),
        y: Math.max(0, Math.min(deviceSize.height, Math.round(y))),
    };
}

function pointFromEvent(event: PointerEvent): Point {
    if (!screenSize) throw new Error('Screen dimensions are unavailable');
    return pointFromContainedMedia(event, elements.screen, screenSize);
}

async function sendAction(action: RemoteAction): Promise<void> {
    setStatus('Sending input…');
    elements.remoteButtons.forEach((button) => { button.disabled = true; });
    try {
        await jsonRequest(`/api/devices/${encodeURIComponent(udid)}/remote/action`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(action),
        });
        if (trainRecording) recordTrainEvent(action);
        setStatus(action.type === 'tap' ? `Tapped (${action.x}, ${action.y})` : 'Remote connected', 'ready');
    } catch (error) {
        setStatus(errorMessage(error), 'error');
    } finally {
        elements.remoteButtons.forEach((button) => { button.disabled = false; });
    }
}

function directionalSwipe(direction: SwipeDirection): RemoteAction | undefined {
    if (!screenSize) {
        setStatus('Screen dimensions are unavailable', 'error');
        return;
    }
    const left = Math.round(screenSize.width * 0.22);
    const right = Math.round(screenSize.width * 0.78);
    const top = Math.round(screenSize.height * 0.25);
    const bottom = Math.round(screenSize.height * 0.75);
    const centerX = Math.round(screenSize.width / 2);
    const centerY = Math.round(screenSize.height / 2);
    const points: Record<SwipeDirection, [number, number, number, number]> = {
        left: [right, centerY, left, centerY],
        right: [left, centerY, right, centerY],
        up: [centerX, bottom, centerX, top],
        down: [centerX, top, centerX, bottom],
    };
    const [startX, startY, endX, endY] = points[direction];
    return { type: 'swipe', startX, startY, endX, endY, durationMs: 350 };
}

elements.remoteButtons.forEach((button) => {
    button.addEventListener('click', () => {
        const action = button.dataset.remoteAction;
        if (action === 'home' || action === 'lock' || action === 'wake'
            || action === 'unlock' || action === 'volumeUp' || action === 'volumeDown') {
            void sendAction({ type: action });
            return;
        }
        if (action === 'left' || action === 'right' || action === 'up' || action === 'down') {
            const swipe = directionalSwipe(action);
            if (swipe) void sendAction(swipe);
        }
    });
});

elements.screen.addEventListener('pointerdown', (event) => {
    if (!screenSize) return;
    elements.screen.setPointerCapture(event.pointerId);
    pointerStart = { ...pointFromEvent(event), time: performance.now() };
});
elements.screen.addEventListener('pointerup', (event) => {
    if (!pointerStart || !screenSize) return;
    const end = pointFromEvent(event);
    const start = pointerStart;
    pointerStart = undefined;
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    if (distance < 12) {
        void sendAction({ type: 'tap', x: end.x, y: end.y });
    } else {
        const durationMs = Math.max(150, Math.min(1200, Math.round(performance.now() - (start.time ?? 0))));
        void sendAction({
            type: 'swipe',
            startX: start.x,
            startY: start.y,
            endX: end.x,
            endY: end.y,
            durationMs,
        });
    }
});
elements.screen.addEventListener('pointercancel', () => { pointerStart = undefined; });
elements.screen.addEventListener('load', () => setStatus('Live video connected', 'ready'));
elements.screen.addEventListener('error', () => {
    if (paused) return;
    elements.screen.removeAttribute('src');
    setStatus('Video stream disconnected; checking the phone connection…', 'error');
    void pollConnection();
});
elements.refresh.addEventListener('click', async () => {
    elements.refresh.disabled = true;
    window.clearTimeout(connectionPoll);
    elements.screen.removeAttribute('src');
    setStatus('Restarting the phone connection…');
    try {
        await jsonRequest(`/api/devices/${encodeURIComponent(udid)}/reconnect`, { method: 'POST' });
        elements.refresh.disabled = false;
        void pollConnection(true);
    } catch (error) {
        setStatus(errorMessage(error), 'error');
        elements.refresh.disabled = false;
    }
});
elements.toggle.addEventListener('click', () => {
    paused = !paused;
    elements.toggle.textContent = paused ? 'Resume stream' : 'Pause stream';
    if (paused) {
        elements.screen.removeAttribute('src');
        setStatus('Video stream paused');
    } else {
        void connectRemote();
    }
});

function renderMedia(): void {
    elements.mediaList.replaceChildren(...orderedMedia.map((file, index) => {
        const item = document.createElement('li');
        const name = document.createElement('span');
        name.textContent = `${index + 1}. ${file.name}`;
        const up = document.createElement('button');
        up.type = 'button'; up.textContent = '↑'; up.title = 'Move earlier'; up.disabled = index === 0;
        const down = document.createElement('button');
        down.type = 'button'; down.textContent = '↓'; down.title = 'Move later'; down.disabled = index === orderedMedia.length - 1;
        const remove = document.createElement('button');
        remove.type = 'button'; remove.textContent = 'Remove';
        up.addEventListener('click', () => { [orderedMedia[index - 1], orderedMedia[index]] = [orderedMedia[index]!, orderedMedia[index - 1]!]; renderMedia(); });
        down.addEventListener('click', () => { [orderedMedia[index], orderedMedia[index + 1]] = [orderedMedia[index + 1]!, orderedMedia[index]!]; renderMedia(); });
        remove.addEventListener('click', () => { orderedMedia.splice(index, 1); renderMedia(); });
        item.append(name, up, down, remove);
        return item;
    }));
}

function renderInstagramMedia(): void {
    elements.instagramMediaList.replaceChildren(...instagramOrderedMedia.map((file, index) => {
        const item = document.createElement('li');
        const name = document.createElement('span');
        name.textContent = `${index + 1}. ${file.name}`;
        const up = document.createElement('button');
        up.type = 'button'; up.textContent = '↑'; up.title = 'Move earlier'; up.disabled = index === 0;
        const down = document.createElement('button');
        down.type = 'button'; down.textContent = '↓'; down.title = 'Move later'; down.disabled = index === instagramOrderedMedia.length - 1;
        const remove = document.createElement('button');
        remove.type = 'button'; remove.textContent = 'Remove';
        up.addEventListener('click', () => {
            [instagramOrderedMedia[index - 1], instagramOrderedMedia[index]] = [instagramOrderedMedia[index]!, instagramOrderedMedia[index - 1]!];
            renderInstagramMedia();
        });
        down.addEventListener('click', () => {
            [instagramOrderedMedia[index], instagramOrderedMedia[index + 1]] = [instagramOrderedMedia[index + 1]!, instagramOrderedMedia[index]!];
            renderInstagramMedia();
        });
        remove.addEventListener('click', () => { instagramOrderedMedia.splice(index, 1); renderInstagramMedia(); });
        item.append(name, up, down, remove);
        return item;
    }));
}

function selectedDestination(): 'draft' | 'publish' {
    return (elements.postForm.elements.namedItem('destination') as RadioNodeList).value as 'draft' | 'publish';
}

function selectedInstagramDestination(): 'draft' | 'publish' {
    return (elements.instagramPostForm.elements.namedItem('destination') as RadioNodeList).value as 'draft' | 'publish';
}

function postTiming(): Record<string, unknown> {
    const kind = elements.postRecurring.checked ? elements.postFrequency.value : elements.postStartKind.value;
    if (kind === 'now') return { kind };
    if (kind === 'once') {
        if (!elements.postRunAt.value) throw new Error('Choose a one-time start date');
        return { kind, runAt: new Date(elements.postRunAt.value).toISOString() };
    }
    if (kind === 'daily') return { kind, localTime: elements.postLocalTime.value, timezone: browserTimezone };
    const weekdays = selectedWeekdays(elements.postWeekdayInputs);
    if (weekdays.length === 0) throw new Error('Choose at least one recurring day');
    return {
        kind: 'weekly', localTime: elements.postLocalTime.value, timezone: browserTimezone,
        weekdays,
    };
}

function instagramPostTiming(): Record<string, unknown> {
    const kind = elements.instagramPostRecurring.checked
        ? elements.instagramPostFrequency.value
        : elements.instagramPostStartKind.value;
    if (kind === 'now') return { kind };
    if (kind === 'once') {
        if (!elements.instagramPostRunAt.value) throw new Error('Choose a one-time start date');
        return { kind, runAt: new Date(elements.instagramPostRunAt.value).toISOString() };
    }
    if (kind === 'daily') return { kind, localTime: elements.instagramPostLocalTime.value, timezone: browserTimezone };
    const weekdays = selectedWeekdays(elements.instagramPostWeekdayInputs);
    if (weekdays.length === 0) throw new Error('Choose at least one recurring day');
    return {
        kind: 'weekly', localTime: elements.instagramPostLocalTime.value, timezone: browserTimezone,
        weekdays,
    };
}

function updateDestination(): void {
    const publishing = selectedDestination() === 'publish';
    elements.publishConfirm.classList.toggle('visible', publishing);
    if (!publishing) elements.confirmPublish.checked = false;
    elements.submitPost.textContent = publishing ? 'Post publicly' : 'Save to Drafts';
}

function updateInstagramDestination(): void {
    const publishing = selectedInstagramDestination() === 'publish';
    elements.instagramPublishConfirm.classList.toggle('visible', publishing);
    if (!publishing) elements.instagramConfirmPublish.checked = false;
    elements.submitInstagramPost.textContent = publishing ? 'Post publicly' : 'Save to Drafts';
}

async function pollPost(): Promise<void> {
    try {
        const run = await jsonRequest<PostRun>(`/api/devices/${encodeURIComponent(udid)}/posts/current`);
        elements.postResult.textContent = run.status === 'running'
            ? 'Post automation is running. Follow its live output in the Automation log.'
            : '';
        if (run.status === 'running') {
            postPoll = window.setTimeout(() => void pollPost(), 1000);
        } else {
            elements.submitPost.disabled = false;
            elements.postResult.textContent = run.status === 'succeeded'
                ? `Completed: ${run.destination === 'publish' ? 'post submitted' : 'draft saved'}.`
                : 'Automation failed. Review the Automation log and the phone screen.';
        }
    } catch (error) {
        elements.postResult.textContent = errorMessage(error);
        elements.submitPost.disabled = false;
    }
}

async function pollInstagramPost(): Promise<void> {
    try {
        const run = await jsonRequest<PostRun>(`/api/devices/${encodeURIComponent(udid)}/instagram/posts/current`);
        elements.instagramPostResult.textContent = run.status === 'running'
            ? 'Post automation is running. Follow its live output in the Automation log.'
            : '';
        if (run.status === 'running') {
            instagramPostPoll = window.setTimeout(() => void pollInstagramPost(), 1000);
        } else {
            elements.submitInstagramPost.disabled = false;
            elements.instagramPostResult.textContent = run.status === 'succeeded'
                ? `Completed: ${run.destination === 'publish' ? 'post submitted' : 'draft saved'}.`
                : 'Automation failed. Review the Automation log and the phone screen.';
        }
    } catch (error) {
        elements.instagramPostResult.textContent = errorMessage(error);
        elements.submitInstagramPost.disabled = false;
    }
}

function formatDate(value: string | null): string {
    return value ? new Date(value).toLocaleString() : '—';
}

function taskActionButton(label: string, action: () => Promise<void>): HTMLButtonElement {
    const buttonElement = document.createElement('button');
    buttonElement.className = 'icon-button';
    buttonElement.type = 'button';
    buttonElement.textContent = label;
    buttonElement.addEventListener('click', () => {
        void (async () => {
            try {
                await action();
                await loadDeviceTasks();
            } catch (error) {
                window.alert(errorMessage(error));
            }
        })();
    });
    return buttonElement;
}

function pluginLabel(pluginId: SocialPluginId | undefined): string {
    if (pluginId === 'com.git-agni.instagram') return 'Instagram';
    if (pluginId === 'com.git-agni.tiktok') return 'TikTok';
    return pluginId ? pluginId.replace(/^com\.git-agni\./, '') : 'Task';
}

function taskTitle(taskType: DeviceSchedule['taskType'], payload?: DeviceSchedule['payload'], pluginId?: SocialPluginId): string {
    const app = pluginLabel(pluginId);
    if (taskType === 'doomscroll' || taskType === 'doomscroll-following') {
        const label = taskType === 'doomscroll-following' ? 'doomscroll following' : 'doomscroll';
        const details = payload?.durationMinutes ? ` · ${payload.durationMinutes} min` : '';
        return `${app} ${label}${details}`;
    }
    const destination = payload?.destination === 'publish' ? 'Post publicly' : 'Save to drafts';
    return payload?.account ? `${app} · ${destination} · ${payload.account}` : `${app} · ${destination}`;
}

function timingDescription(timing: DeviceSchedule['timing']): string {
    if (timing.kind === 'once') return `Once · ${formatDate(timing.runAt ?? null)}`;
    if (timing.kind === 'daily') return `Daily · ${timing.localTime ?? '—'} · ${timing.timezone ?? 'local time'}`;
    if (timing.kind === 'weekly') {
        const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const days = timing.weekdays?.map((day) => names[day] ?? String(day)).join(', ') || 'no days';
        return `Weekly ${days} · ${timing.localTime ?? '—'} · ${timing.timezone ?? 'local time'}`;
    }
    return 'Run immediately';
}

function renderDeviceSchedules(schedules: DeviceSchedule[]): void {
    if (!schedules.length) {
        elements.deviceSchedules.className = 'task-list empty-state';
        elements.deviceSchedules.textContent = 'No schedules for this device.';
        return;
    }
    elements.deviceSchedules.className = 'task-list';
    elements.deviceSchedules.replaceChildren(...schedules.map((schedule) => {
        const row = document.createElement('article');
        row.className = 'task-row';
        const copy = document.createElement('div');
        const title = document.createElement('h3');
        title.textContent = taskTitle(schedule.taskType, schedule.payload, schedule.pluginId);
        const meta = document.createElement('p');
        meta.textContent = `${timingDescription(schedule.timing)} · next ${formatDate(schedule.nextRunAt)}`;
        copy.append(title, meta);
        const state = document.createElement('span');
        state.className = `status ${schedule.status}`;
        state.textContent = schedule.status;
        const actions = document.createElement('div');
        actions.className = 'inline-actions';
        if (schedule.status === 'active') actions.append(taskActionButton('Pause', async () => {
            await jsonRequest(`/api/schedules/${schedule.id}/pause`, { method: 'POST' });
        }));
        if (schedule.status === 'paused') actions.append(taskActionButton('Resume', async () => {
            await jsonRequest(`/api/schedules/${schedule.id}/resume`, { method: 'POST' });
        }));
        if (schedule.status !== 'cancelled' && schedule.status !== 'completed') {
            actions.append(taskActionButton('Cancel', async () => {
                await jsonRequest(`/api/schedules/${schedule.id}/cancel`, { method: 'POST' });
            }));
        }
        row.append(copy, state, actions);
        return row;
    }));
}

function renderDeviceExecutions(executions: DeviceExecution[]): void {
    const running = executions.filter((execution) => execution.status === 'running').length;
    const queued = executions.filter((execution) => execution.status === 'queued').length;
    if (running || queued) {
        elements.deviceQueueStatus.textContent = `Queue: ${running} running · ${queued} waiting`;
        elements.clearDeviceQueue.disabled = false;
    } else {
        elements.deviceQueueStatus.textContent = 'Queue: empty — nothing running or waiting';
        elements.clearDeviceQueue.disabled = true;
    }
    if (!executions.length) {
        elements.deviceExecutions.className = 'task-list empty-state';
        elements.deviceExecutions.textContent = 'No task runs for this device yet.';
        return;
    }
    elements.deviceExecutions.className = 'task-list';
    elements.deviceExecutions.replaceChildren(...executions.map((execution) => {
        const row = document.createElement('article');
        row.className = 'task-row';
        const copy = document.createElement('div');
        const title = document.createElement('h3');
        title.textContent = taskTitle(execution.taskType, undefined, execution.pluginId);
        const meta = document.createElement('p');
        meta.textContent = `${formatDate(execution.scheduledFor)}${execution.error ? ` · ${execution.error}` : ''}`;
        copy.append(title, meta);
        const state = document.createElement('span');
        state.className = `status ${execution.status}`;
        state.textContent = execution.status;
        const actions = document.createElement('div');
        actions.className = 'inline-actions';
        if (execution.status === 'queued' || (execution.status === 'running' && (
            execution.taskType === 'doomscroll' || execution.taskType === 'doomscroll-following'
        ))) {
            actions.append(taskActionButton(execution.status === 'queued' ? 'Cancel' : 'Stop', async () => {
                await jsonRequest(`/api/executions/${execution.id}/stop`, { method: 'POST' });
            }));
        }
        if (execution.status === 'failed' || execution.status === 'stopped') {
            actions.append(taskActionButton('Retry', async () => {
                if (execution.taskType === 'post') {
                    const app = pluginLabel(execution.pluginId);
                    if (!window.confirm(`The post may already have reached ${app}. Retry only after checking the device.`)) return;
                }
                await jsonRequest(`/api/executions/${execution.id}/retry`, { method: 'POST' });
            }));
        }
        row.append(copy, state, actions);
        return row;
    }));
}

async function loadDeviceTasks(): Promise<void> {
    try {
        const query = `deviceUdid=${encodeURIComponent(udid)}`;
        const [scheduleData, executionData] = await Promise.all([
            jsonRequest<{ schedules: DeviceSchedule[] }>(`/api/schedules?${query}`),
            jsonRequest<{ executions: DeviceExecution[] }>(`/api/executions?${query}`),
        ]);
        renderDeviceSchedules(scheduleData.schedules);
        renderDeviceExecutions(executionData.executions);
    } catch (error) {
        const message = errorMessage(error);
        elements.deviceSchedules.className = 'task-list empty-state';
        elements.deviceSchedules.textContent = message;
        elements.deviceExecutions.className = 'task-list empty-state';
        elements.deviceExecutions.textContent = message;
    }
}

elements.openPost.addEventListener('click', () => elements.postDialog.showModal());
elements.closePost.addEventListener('click', () => elements.postDialog.close());
elements.cancelPost.addEventListener('click', () => elements.postDialog.close());
elements.media.addEventListener('change', () => {
    orderedMedia = Array.from(elements.media.files ?? []);
    renderMedia();
});
elements.postForm.addEventListener('change', (event) => {
    if ((event.target as HTMLInputElement).name === 'destination') updateDestination();
});
elements.postForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const destination = selectedDestination();
    if (orderedMedia.length === 0) { elements.postResult.textContent = 'Choose media first.'; return; }
    if (orderedMedia.length > 3) { elements.postResult.textContent = 'Choose no more than three slideshow images.'; return; }
    const videos = orderedMedia.filter(({ type }) => type.startsWith('video/'));
    const images = orderedMedia.filter(({ type }) => type.startsWith('image/'));
    if (!((videos.length === 1 && orderedMedia.length === 1) || images.length === orderedMedia.length)) {
        elements.postResult.textContent = 'Choose exactly one video, or only slideshow images.'; return;
    }
    if (destination === 'publish' && !elements.confirmPublish.checked) {
        elements.postResult.textContent = 'Confirm public publishing before continuing.'; return;
    }
    const form = new FormData();
    for (const file of orderedMedia) form.append('media', file, file.name);
    form.append('destination', destination);
    form.append('musicUrl', elements.musicUrl.value);
    form.append('caption', elements.caption.value);
    form.append('account', elements.postAccount.value);
    try {
        form.append('timing', JSON.stringify(postTiming()));
    } catch (error) {
        elements.postResult.textContent = errorMessage(error); return;
    }
    form.append('runWindowMinutes', elements.postRunWindow.value);
    form.append('recurringPublishConfirmed', String(destination !== 'publish' || elements.confirmPublish.checked));
    elements.submitPost.disabled = true;
    elements.postResult.textContent = 'Uploading media to the automation server…';
    try {
        const result = await jsonRequest<{ status: string }>(`/api/devices/${encodeURIComponent(udid)}/posts`, { method: 'POST', body: form });
        window.clearTimeout(postPoll);
        if (result.status === 'running') {
            await pollPost();
        } else {
            elements.submitPost.disabled = false;
            elements.postResult.textContent = 'Post automation scheduled. Follow its status and live output in the Automation log.';
        }
        void loadDeviceTasks();
    } catch (error) {
        elements.postResult.textContent = errorMessage(error);
        elements.submitPost.disabled = false;
    }
});

elements.openInstagramPost.addEventListener('click', () => elements.instagramPostDialog.showModal());
elements.closeInstagramPost.addEventListener('click', () => elements.instagramPostDialog.close());
elements.cancelInstagramPost.addEventListener('click', () => elements.instagramPostDialog.close());
elements.instagramMedia.addEventListener('change', () => {
    instagramOrderedMedia = Array.from(elements.instagramMedia.files ?? []);
    renderInstagramMedia();
});
elements.instagramPostForm.addEventListener('change', (event) => {
    if ((event.target as HTMLInputElement).name === 'destination') updateInstagramDestination();
});
elements.instagramPostForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const destination = selectedInstagramDestination();
    if (instagramOrderedMedia.length === 0) { elements.instagramPostResult.textContent = 'Choose media first.'; return; }
    if (instagramOrderedMedia.length > 3) { elements.instagramPostResult.textContent = 'Choose no more than three slideshow images.'; return; }
    const videos = instagramOrderedMedia.filter(({ type }) => type.startsWith('video/'));
    const images = instagramOrderedMedia.filter(({ type }) => type.startsWith('image/'));
    if (!((videos.length === 1 && instagramOrderedMedia.length === 1) || images.length === instagramOrderedMedia.length)) {
        elements.instagramPostResult.textContent = 'Choose exactly one video, or only slideshow images.'; return;
    }
    if (destination === 'publish' && !elements.instagramConfirmPublish.checked) {
        elements.instagramPostResult.textContent = 'Confirm public publishing before continuing.'; return;
    }
    const form = new FormData();
    for (const file of instagramOrderedMedia) form.append('media', file, file.name);
    form.append('destination', destination);
    form.append('musicUrl', elements.instagramMusicUrl.value);
    form.append('caption', elements.instagramCaption.value);
    form.append('account', elements.instagramPostAccount.value);
    try {
        form.append('timing', JSON.stringify(instagramPostTiming()));
    } catch (error) {
        elements.instagramPostResult.textContent = errorMessage(error); return;
    }
    form.append('runWindowMinutes', elements.instagramPostRunWindow.value);
    form.append('recurringPublishConfirmed', String(destination !== 'publish' || elements.instagramConfirmPublish.checked));
    elements.submitInstagramPost.disabled = true;
    elements.instagramPostResult.textContent = 'Uploading media to the automation server…';
    try {
        const result = await jsonRequest<{ status: string }>(
            `/api/devices/${encodeURIComponent(udid)}/instagram/posts`,
            { method: 'POST', body: form },
        );
        window.clearTimeout(instagramPostPoll);
        if (result.status === 'running') {
            await pollInstagramPost();
        } else {
            elements.submitInstagramPost.disabled = false;
            elements.instagramPostResult.textContent = 'Post automation scheduled. Follow its status and live output in the Automation log.';
        }
        void loadDeviceTasks();
    } catch (error) {
        elements.instagramPostResult.textContent = errorMessage(error);
        elements.submitInstagramPost.disabled = false;
    }
});

elements.accountsForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    elements.accountsResult.textContent = 'Saving…';
    try {
        const result = await jsonRequest<{ accounts: string[] }>(`/api/devices/${encodeURIComponent(udid)}/accounts`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ accounts: elements.deviceAccounts.value.split(',') }),
        });
        const previousDoomscroll = (document.querySelector<HTMLSelectElement>('#doomscroll-account'))?.value ?? '';
        elements.postAccount.replaceChildren(new Option('Choose an account…', '', false, true));
        elements.postAccount.options[0]!.disabled = true;
        const doomscrollAccount = element<HTMLSelectElement>('#doomscroll-account');
        doomscrollAccount.replaceChildren(new Option("Don't switch", ''));
        for (const account of result.accounts) {
            elements.postAccount.add(new Option(account, account));
            doomscrollAccount.add(new Option(account, account));
        }
        if (result.accounts.includes(previousDoomscroll)) doomscrollAccount.value = previousDoomscroll;
        elements.deviceAccounts.value = result.accounts.join(', ');
        elements.accountsResult.textContent = result.accounts.length ? 'Accounts saved.' : 'Account switching is optional.';
    } catch (error) {
        elements.accountsResult.textContent = errorMessage(error);
    }
});

elements.instagramAccountsForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    elements.instagramAccountsResult.textContent = 'Saving…';
    try {
        const result = await jsonRequest<{ accounts: string[] }>(
            `/api/devices/${encodeURIComponent(udid)}/instagram/accounts`,
            {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ accounts: elements.instagramDeviceAccounts.value.split(',') }),
            },
        );
        const previousDoomscroll = (document.querySelector<HTMLSelectElement>('#instagram-doomscroll-account'))?.value ?? '';
        elements.instagramPostAccount.replaceChildren(new Option('Choose an account…', '', false, true));
        elements.instagramPostAccount.options[0]!.disabled = true;
        const doomscrollAccount = element<HTMLSelectElement>('#instagram-doomscroll-account');
        doomscrollAccount.replaceChildren(new Option("Don't switch", ''));
        for (const account of result.accounts) {
            elements.instagramPostAccount.add(new Option(account, account));
            doomscrollAccount.add(new Option(account, account));
        }
        if (result.accounts.includes(previousDoomscroll)) doomscrollAccount.value = previousDoomscroll;
        elements.instagramDeviceAccounts.value = result.accounts.join(', ');
        elements.instagramAccountsResult.textContent = result.accounts.length ? 'Accounts saved.' : 'Account switching is optional.';
    } catch (error) {
        elements.instagramAccountsResult.textContent = errorMessage(error);
    }
});

interface CalPoint { name: string; label: string; default: Point; current: Point; overridden: boolean }

const cal = {
    app: 'tiktok' as CalibrateApp,
    screen: undefined as { width: number; height: number } | undefined,
    points: [] as CalPoint[],
    overrides: {} as Record<string, { x: number; y: number }>,
    armed: undefined as string | undefined,
};

function calValue(name: string): { x: number; y: number } {
    const point = cal.points.find((entry) => entry.name === name)!;
    return cal.overrides[name] ?? point.default;
}

function renderCalPoints(): void {
    elements.calPoints.replaceChildren(...cal.points.map((point) => {
        const value = calValue(point.name);
        const overridden = point.name in cal.overrides;
        const li = document.createElement('li');
        li.className = `cal-point${overridden ? ' overridden' : ''}${cal.armed === point.name ? ' armed' : ''}`;
        const pick = document.createElement('button');
        pick.type = 'button'; pick.className = 'cal-pick';
        pick.textContent = cal.armed === point.name ? `${point.label} — click the screen` : point.label;
        pick.addEventListener('click', () => { cal.armed = cal.armed === point.name ? undefined : point.name; renderCal(); });
        const xy = document.createElement('span');
        xy.className = 'cal-xy'; xy.textContent = `${value.x}, ${value.y}`;
        const reset = document.createElement('button');
        reset.type = 'button'; reset.className = 'cal-reset'; reset.title = 'Reset to profile'; reset.textContent = '↺';
        reset.addEventListener('click', () => { delete cal.overrides[point.name]; renderCal(); });
        li.append(pick, xy, reset);
        return li;
    }));
}

function renderCalMarkers(): void {
    if (!cal.screen) return;
    const mediaW = elements.calScreen.naturalWidth || cal.screen.width;
    const mediaH = elements.calScreen.naturalHeight || cal.screen.height;
    const box = containContentBox(elements.calScreen, mediaW, mediaH);
    elements.calMarkers.replaceChildren(...cal.points.map((point) => {
        const value = calValue(point.name);
        const marker = document.createElement('span');
        marker.className = `m${point.name in cal.overrides ? ' overridden' : ''}${cal.armed === point.name ? ' armed' : ''}`;
        const left = box.elementWidth <= 0 ? 0
            : ((box.left - elements.calScreen.getBoundingClientRect().left)
                + (value.x / cal.screen!.width) * box.width) / box.elementWidth * 100;
        const top = box.elementHeight <= 0 ? 0
            : ((box.top - elements.calScreen.getBoundingClientRect().top)
                + (value.y / cal.screen!.height) * box.height) / box.elementHeight * 100;
        marker.style.left = `${left}%`;
        marker.style.top = `${top}%`;
        marker.title = point.label;
        return marker;
    }));
}

function renderCal(): void {
    renderCalPoints();
    renderCalMarkers();
}

async function loadCalibratePoints(app: CalibrateApp): Promise<void> {
    const data = await jsonRequest<{
        app: CalibrateApp;
        profile: string;
        screenSize: { width: number; height: number };
        points: CalPoint[];
    }>(`/api/devices/${encodeURIComponent(udid)}/coordinates?app=${encodeURIComponent(app)}`);
    cal.app = data.app;
    cal.screen = data.screenSize;
    cal.points = data.points;
    cal.overrides = {};
    for (const point of data.points) if (point.overridden) cal.overrides[point.name] = point.current;
    cal.armed = undefined;
    elements.calApp.value = data.app;
    elements.calProfile.textContent = `${data.profile} · ${data.app === 'instagram' ? 'Instagram' : 'TikTok'}`;
    renderCal();
}

async function openCalibrate(): Promise<void> {
    elements.calStatus.textContent = 'Loading…';
    elements.calibrateDialog.showModal();
    try {
        elements.calControl.checked = false;
        elements.calScreen.parentElement?.classList.remove('controlling');
        await loadCalibratePoints(elements.calApp.value as CalibrateApp);
        elements.calScreen.src = `/api/devices/${encodeURIComponent(udid)}/remote/stream?t=${Date.now()}`;
        elements.calStatus.textContent = '';
    } catch (error) {
        elements.calStatus.textContent = errorMessage(error);
    }
}

function closeCalibrate(): void {
    elements.calScreen.src = '';
    elements.calibrateDialog.close();
}

elements.openCalibrate.addEventListener('click', () => void openCalibrate());
elements.closeCalibrate.addEventListener('click', closeCalibrate);
elements.calCancel.addEventListener('click', closeCalibrate);
elements.calApp.addEventListener('change', () => {
    if (!elements.calibrateDialog.open) return;
    elements.calStatus.textContent = 'Loading…';
    void loadCalibratePoints(elements.calApp.value as CalibrateApp)
        .then(() => { elements.calStatus.textContent = ''; })
        .catch((error) => { elements.calStatus.textContent = errorMessage(error); });
});

elements.openTasks.addEventListener('click', () => {
    void loadDeviceTasks();
    elements.tasksDialog.showModal();
});
elements.closeTasks.addEventListener('click', () => elements.tasksDialog.close());
elements.clearDeviceQueue.addEventListener('click', async () => {
    if (!window.confirm('Cancel every queued job and stop every running automation on this device?')) return;
    elements.clearDeviceQueue.disabled = true;
    elements.deviceQueueStatus.textContent = 'Clearing queue…';
    try {
        const result = await jsonRequest<{ cancelled: number; stopping: number }>(
            `/api/devices/${encodeURIComponent(udid)}/queue/clear`,
            { method: 'POST' },
        );
        elements.deviceQueueStatus.textContent =
            `Cleared ${result.cancelled} queued · stopping ${result.stopping} running`;
        await loadDeviceTasks();
        const activityResponse = await fetch(`/api/devices/${encodeURIComponent(udid)}/fragments/activity`);
        if (activityResponse.ok) {
            const html = await activityResponse.text();
            const current = document.querySelector('#device-activity');
            if (current) current.outerHTML = html;
        }
    } catch (error) {
        elements.deviceQueueStatus.textContent = errorMessage(error);
        elements.clearDeviceQueue.disabled = false;
    }
});
elements.openAccounts.addEventListener('click', () => elements.accountsDialog.showModal());
elements.closeAccounts.addEventListener('click', () => elements.accountsDialog.close());
elements.openInstagramAccounts.addEventListener('click', () => elements.instagramAccountsDialog.showModal());
elements.closeInstagramAccounts.addEventListener('click', () => elements.instagramAccountsDialog.close());
elements.openPasscode.addEventListener('click', () => {
    elements.passcodeResult.textContent = '';
    elements.passcodeDialog.showModal();
});
elements.closePasscode.addEventListener('click', () => elements.passcodeDialog.close());
elements.openRemove.addEventListener('click', () => {
    elements.removeResult.textContent = '';
    elements.removeDialog.showModal();
});
elements.closeRemove.addEventListener('click', () => elements.removeDialog.close());
elements.calResetAll.addEventListener('click', () => {
    if (!confirm('Reset all touch points to the profile defaults?')) return;
    cal.overrides = {}; cal.armed = undefined; renderCal();
});
function calPointFromEvent(event: PointerEvent | MouseEvent): Point {
    if (!cal.screen) throw new Error('Calibration screen size is unavailable');
    return pointFromContainedMedia(event, elements.calScreen, cal.screen);
}

async function calSendAction(action: RemoteAction): Promise<void> {
    elements.calStatus.textContent = 'Sending input…';
    try {
        await jsonRequest(`/api/devices/${encodeURIComponent(udid)}/remote/action`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(action),
        });
        elements.calStatus.textContent = action.type === 'tap' ? `Tapped (${action.x}, ${action.y})` : 'Sent.';
    } catch (error) {
        elements.calStatus.textContent = errorMessage(error);
    }
}

let calPointerStart: (Point & { time: number }) | undefined;

elements.calControl.addEventListener('change', () => {
    elements.calScreen.parentElement?.classList.toggle('controlling', elements.calControl.checked);
    if (elements.calControl.checked) { cal.armed = undefined; renderCal(); }
});

elements.calUnlock.addEventListener('click', () => void calSendAction({ type: 'unlock' }));

elements.calScreen.addEventListener('click', (event) => {
    if (elements.calControl.checked || !cal.armed || !cal.screen) return;
    cal.overrides[cal.armed] = calPointFromEvent(event);
    cal.armed = undefined;
    renderCal();
});
elements.calScreen.addEventListener('pointerdown', (event) => {
    if (!elements.calControl.checked || !cal.screen) return;
    elements.calScreen.setPointerCapture(event.pointerId);
    calPointerStart = { ...calPointFromEvent(event), time: performance.now() };
});
elements.calScreen.addEventListener('pointerup', (event) => {
    if (!calPointerStart || !cal.screen) return;
    const start = calPointerStart;
    const end = calPointFromEvent(event);
    calPointerStart = undefined;
    if (Math.hypot(end.x - start.x, end.y - start.y) < 12) {
        void calSendAction({ type: 'tap', x: end.x, y: end.y });
    } else {
        const durationMs = Math.max(150, Math.min(1200, Math.round(performance.now() - start.time)));
        void calSendAction({ type: 'swipe', startX: start.x, startY: start.y, endX: end.x, endY: end.y, durationMs });
    }
});
elements.calScreen.addEventListener('pointercancel', () => { calPointerStart = undefined; });
elements.calSave.addEventListener('click', async () => {
    elements.calSave.disabled = true;
    elements.calStatus.textContent = 'Saving…';
    try {
        const body = cal.app === 'instagram'
            ? { instagramCoordinates: cal.overrides }
            : { coordinates: cal.overrides };
        await jsonRequest(`/api/devices/${encodeURIComponent(udid)}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
        });
        const count = Object.keys(cal.overrides).length;
        elements.calStatus.textContent = count ? `Saved ${count} override${count === 1 ? '' : 's'}.` : 'Cleared all overrides.';
        for (const point of cal.points) point.overridden = point.name in cal.overrides;
        renderCal();
    } catch (error) {
        elements.calStatus.textContent = errorMessage(error);
    } finally {
        elements.calSave.disabled = false;
    }
});

async function patchPasscode(passcode: string, pending: string, done: string): Promise<void> {
    elements.passcodeResult.textContent = pending;
    try {
        const response = await fetch(`/api/devices/${encodeURIComponent(udid)}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ passcode }),
        });
        if (!response.ok) {
            const data = await response.json().catch(() => ({})) as { error?: string };
            throw new Error(data.error ?? `Request failed (${response.status})`);
        }
        const data = await response.json() as { hasPasscode?: boolean };
        elements.passcodeState.textContent = data.hasPasscode ? '· set' : '· not set';
        elements.devicePasscode.value = '';
        elements.passcodeResult.textContent = done;
    } catch (error) {
        elements.passcodeResult.textContent = errorMessage(error);
    }
}

elements.passcodeForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = elements.devicePasscode.value.trim();
    if (!/^\d{4,}$/.test(value)) {
        elements.passcodeResult.textContent = 'Enter at least four digits.';
        return;
    }
    void patchPasscode(value, 'Saving…', 'Passcode saved.');
});

elements.passcodeClear.addEventListener('click', () => {
    if (!confirm('Clear this device’s passcode? Automation will not be able to unlock a locked phone.')) return;
    void patchPasscode('', 'Clearing…', 'Passcode cleared.');
});

elements.removeDevice.addEventListener('click', async () => {
    elements.removeDevice.disabled = true;
    elements.removeResult.textContent = 'Removing…';
    try {
        const response = await fetch(`/api/devices/${encodeURIComponent(udid)}`, { method: 'DELETE' });
        if (!response.ok) {
            const data = await response.json().catch(() => ({})) as { error?: string };
            throw new Error(data.error ?? `Request failed (${response.status})`);
        }
        location.href = '/';
    } catch (error) {
        elements.removeDevice.disabled = false;
        elements.removeResult.textContent = errorMessage(error);
    }
});

updateDestination();
updateInstagramDestination();
updateDoomscrollSchedule();
updateInstagramDoomscrollSchedule();
updatePostSchedule();
updateInstagramPostSchedule();
setInterval(() => { if (elements.tasksDialog.open) void loadDeviceTasks(); }, 5_000);

const loadedSummary = document.querySelector<HTMLElement>('#device-summary[data-screen-width]');
if (loadedSummary) useDeviceSummary(loadedSummary);

// --- Workflow train / following doomscroll ---------------------------------

elements.trainToggle.addEventListener('click', () => {
    setTrainRecording(!trainRecording);
});
elements.trainClear.addEventListener('click', () => {
    trainEvents = [];
    setTrainRecording(false);
});
elements.trainSave.addEventListener('click', () => {
    if (trainEvents.length === 0) return;
    elements.trainSaveResult.textContent = '';
    elements.trainWorkflowName.value = elements.trainWorkflowName.value || 'following-engage';
    elements.trainSaveDialog.showModal();
});
elements.closeTrainSave.addEventListener('click', () => elements.trainSaveDialog.close());
elements.cancelTrainSave.addEventListener('click', () => elements.trainSaveDialog.close());
elements.trainSaveForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    elements.trainSaveResult.textContent = 'Saving…';
    try {
        await jsonRequest(`/api/devices/${encodeURIComponent(udid)}/tiktok/workflows`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                name: elements.trainWorkflowName.value.trim(),
                events: trainEvents,
                meta: { feed: elements.trainWorkflowFeed.value, source: 'recording' },
            }),
        });
        elements.trainSaveResult.textContent = 'Saved.';
        trainEvents = [];
        setTrainRecording(false);
        elements.trainSaveDialog.close();
        await loadWorkflows();
    } catch (error) {
        elements.trainSaveResult.textContent = errorMessage(error);
    }
});

interface StoredWorkflow {
    id: string;
    name: string;
    createdAt: string;
    steps: unknown[];
}

async function loadWorkflows(): Promise<void> {
    elements.workflowList.classList.add('loading-card');
    elements.workflowList.innerHTML = '<span class="spinner" aria-hidden="true"></span>Loading workflows…';
    try {
        const data = await jsonRequest(`/api/devices/${encodeURIComponent(udid)}/tiktok/workflows`) as { workflows: StoredWorkflow[] };
        const workflows = data.workflows ?? [];
        if (workflows.length === 0) {
            elements.workflowList.classList.remove('loading-card');
            elements.workflowList.textContent = 'No trained workflows yet. Use Train workflow on the live screen.';
            return;
        }
        elements.workflowList.classList.remove('loading-card');
        elements.workflowList.innerHTML = '';
        for (const workflow of workflows) {
            const row = document.createElement('div');
            row.className = 'task-row';
            row.innerHTML = `<div><strong>${workflow.name}</strong><div class="run-meta">${workflow.steps.length} steps · ${new Date(workflow.createdAt).toLocaleString()}</div></div>`;
            const actions = document.createElement('div');
            actions.className = 'inline-actions';
            const replay = document.createElement('button');
            replay.type = 'button';
            replay.className = 'button secondary';
            replay.textContent = 'Replay 5m';
            replay.addEventListener('click', async () => {
                replay.disabled = true;
                try {
                    const form = new FormData();
                    form.set('workflowId', workflow.id);
                    form.set('durationMinutes', '5');
                    const response = await fetch(`/api/devices/${encodeURIComponent(udid)}/fragments/workflow-replay-run`, {
                        method: 'POST',
                        body: form,
                    });
                    if (!response.ok) throw new Error(`Replay failed (${response.status})`);
                    const html = await response.text();
                    const activity = document.querySelector('#device-activity');
                    if (activity) activity.outerHTML = html;
                } catch (error) {
                    setStatus(errorMessage(error), 'error');
                } finally {
                    replay.disabled = false;
                }
            });
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'button secondary';
            remove.textContent = 'Delete';
            remove.addEventListener('click', async () => {
                if (!confirm(`Delete workflow “${workflow.name}”?`)) return;
                await jsonRequest(`/api/devices/${encodeURIComponent(udid)}/tiktok/workflows/${encodeURIComponent(workflow.id)}`, {
                    method: 'DELETE',
                });
                await loadWorkflows();
            });
            actions.append(replay, remove);
            row.append(actions);
            elements.workflowList.append(row);
        }
    } catch (error) {
        elements.workflowList.classList.remove('loading-card');
        elements.workflowList.textContent = errorMessage(error);
    }
}

elements.refreshWorkflows.addEventListener('click', () => { void loadWorkflows(); });
void loadWorkflows();

elements.openFollowingDoomscroll.addEventListener('click', () => elements.followingDoomscrollDialog.showModal());
elements.closeFollowingDoomscroll.addEventListener('click', () => elements.followingDoomscrollDialog.close());
elements.cancelFollowingDoomscroll.addEventListener('click', () => elements.followingDoomscrollDialog.close());
elements.followingDoomscrollDurationButtons.forEach((button) => {
    button.addEventListener('click', () => {
        elements.followingDoomscrollDuration.value = button.dataset.followingDoomscrollDuration ?? '5';
    });
});
elements.followingCommentEnabled.addEventListener('change', () => {
    elements.followingCommentText.disabled = !elements.followingCommentEnabled.checked;
    if (elements.followingCommentEnabled.checked && !elements.followingCommentText.value.trim()) {
        elements.followingCommentText.value = '🔥';
    }
});
elements.followingDoomscrollForm.addEventListener('htmx:afterRequest', ((event: CustomEvent) => {
    const detail = event.detail as { successful?: boolean; xhr?: XMLHttpRequest };
    if (detail.successful) {
        elements.followingDoomscrollResult.textContent = 'Started.';
        elements.followingDoomscrollDialog.close();
    } else {
        elements.followingDoomscrollResult.textContent = detail.xhr?.responseText
            ? 'Could not start — check Activity.'
            : 'Request failed.';
    }
}) as EventListener);

