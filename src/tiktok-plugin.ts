import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';

import type { PhoneFarmPlugin, TaskDefinition, TaskExecutionContext } from './plugin.js';
import type { JsonObject, JsonValue, ScheduleTiming } from './types.js';
import {
    resolveDeviceCoordinates,
} from './devices/coordinates.js';
import {
    createWorkflowPattern,
    listWorkflowsFromPluginData,
    parseRecordedEvents,
    parseWorkflowPattern,
    parseWorkflowStep,
    replaceWorkflowsInPluginData,
    type WorkflowPattern,
    type WorkflowTimedStep,
} from './tiktok/workflows.js';

export interface TikTokPluginConfiguration {
    doomscrollEntrypoint?: string;
    doomscrollFollowingEntrypoint?: string;
    workflowReplayEntrypoint?: string;
    postEntrypoint?: string;
    bundleId?: string;
}

type DoomscrollPayload = JsonObject & {
    durationMinutes: number;
    personality: 'skimmer' | 'casual' | 'engaged' | 'dialed';
    likeEnabled: boolean;
    saveEnabled: boolean;
    commentEnabled?: boolean;
    commentText?: string;
    account?: string;
};

type FollowingDoomscrollPayload = JsonObject & {
    durationMinutes: number;
    personality: 'skimmer' | 'casual' | 'engaged' | 'dialed';
    likeEnabled: boolean;
    saveEnabled: boolean;
    commentEnabled: boolean;
    commentText?: string;
    account?: string;
};

type WorkflowReplayPayload = JsonObject & {
    workflowId: string;
    durationMinutes?: number;
    loops?: number;
    commentText?: string;
};

type PostMedia = JsonObject & {
    assetId: string;
    name: string;
    mimeType: string;
};

type PostPayload = JsonObject & {
    media: PostMedia[];
    destination: 'draft' | 'publish';
    account: string;
    caption?: string;
    musicUrl?: string;
    recurringPublishConfirmed?: boolean;
};

function objectPayload(value: JsonValue): Record<string, JsonValue> {
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('Payload must be an object');
    return value;
}

function optionalString(value: JsonValue | undefined, name: string): string | undefined {
    if (value === undefined) return;
    if (typeof value !== 'string') throw new Error(`${name} must be a string`);
    return value;
}

function createDoomscrollTask(configuration: TikTokPluginConfiguration): TaskDefinition<DoomscrollPayload> {
    return {
        type: 'doomscroll', version: 1, displayName: 'TikTok doomscroll',
        validate(value) {
            const input = objectPayload(value);
            const durationMinutes = input.durationMinutes;
            const personality = input.personality;
            if (!Number.isInteger(durationMinutes) || typeof durationMinutes !== 'number' || durationMinutes < 1 || durationMinutes > 180) {
                throw new Error('durationMinutes must be between 1 and 180');
            }
            if (personality !== 'skimmer' && personality !== 'casual' && personality !== 'engaged' && personality !== 'dialed') {
                throw new Error('Invalid personality');
            }
            if (typeof input.likeEnabled !== 'boolean' || typeof input.saveEnabled !== 'boolean') {
                throw new Error('Engagement settings must be boolean');
            }
            const commentEnabled = typeof input.commentEnabled === 'boolean' ? input.commentEnabled : false;
            const commentText = optionalString(input.commentText, 'commentText');
            if (commentEnabled && !commentText?.trim()) {
                throw new Error('commentText is required when commentEnabled is true');
            }
            const account = optionalString(input.account, 'account');
            return {
                durationMinutes, personality, likeEnabled: input.likeEnabled, saveEnabled: input.saveEnabled,
                commentEnabled,
                ...(commentText ? { commentText } : {}),
                ...(account ? { account } : {}),
            };
        },
        summarize: (payload) => `Doomscroll · ${payload.personality} · ${payload.durationMinutes} min`,
        estimateDurationMs: (payload) => payload.durationMinutes * 60_000,
        retryPolicy: () => ({ retryLimit: 2, retryDelaySeconds: 60, retryBackoff: true }),
        supportsStop: () => true,
        execute: (context, payload) => context.runProcess({
            entrypoint: configuration.doomscrollEntrypoint ?? fileURLToPath(new URL('./tiktok/doomscroll.ts', import.meta.url)),
            env: {
                IOS_UDID: context.device.udid,
                TIKTOK_BUNDLE_ID: configuration.bundleId ?? 'com.zhiliaoapp.musically',
                DOOMSCROLL_DURATION_MINUTES: String(payload.durationMinutes),
                DOOMSCROLL_PERSONALITY: payload.personality,
                DOOMSCROLL_LIKE_ENABLED: String(payload.likeEnabled),
                DOOMSCROLL_SAVE_ENABLED: String(payload.saveEnabled),
                DOOMSCROLL_COMMENT_ENABLED: String(payload.commentEnabled ?? false),
                ...(payload.commentText ? { DOOMSCROLL_COMMENT_TEXT: payload.commentText } : {}),
                ...(payload.account ? { TIKTOK_SWITCH_ACCOUNT: payload.account } : {}),
            },
        }),
    };
}

function createFollowingDoomscrollTask(configuration: TikTokPluginConfiguration): TaskDefinition<FollowingDoomscrollPayload> {
    return {
        type: 'doomscroll-following', version: 1, displayName: 'TikTok doomscroll following',
        validate(value) {
            const input = objectPayload(value);
            const durationMinutes = input.durationMinutes;
            const personality = input.personality;
            if (!Number.isInteger(durationMinutes) || typeof durationMinutes !== 'number' || durationMinutes < 1 || durationMinutes > 180) {
                throw new Error('durationMinutes must be between 1 and 180');
            }
            if (personality !== 'skimmer' && personality !== 'casual' && personality !== 'engaged' && personality !== 'dialed') {
                throw new Error('Invalid personality');
            }
            if (typeof input.likeEnabled !== 'boolean' || typeof input.saveEnabled !== 'boolean') {
                throw new Error('Engagement settings must be boolean');
            }
            if (typeof input.commentEnabled !== 'boolean') {
                throw new Error('commentEnabled must be boolean');
            }
            const account = optionalString(input.account, 'account');
            const commentText = optionalString(input.commentText, 'commentText');
            if (commentText && commentText.length > 150) throw new Error('commentText must be 150 characters or fewer');
            if (input.commentEnabled && !commentText?.trim()) {
                throw new Error('commentText is required when commentEnabled is true');
            }
            return {
                durationMinutes, personality, likeEnabled: input.likeEnabled, saveEnabled: input.saveEnabled,
                commentEnabled: input.commentEnabled,
                ...(commentText ? { commentText } : {}),
                ...(account ? { account } : {}),
            };
        },
        summarize: (payload) => `Following · ${payload.personality} · ${payload.durationMinutes} min`,
        estimateDurationMs: (payload) => payload.durationMinutes * 60_000,
        retryPolicy: () => ({ retryLimit: 2, retryDelaySeconds: 60, retryBackoff: true }),
        supportsStop: () => true,
        execute: (context, payload) => context.runProcess({
            entrypoint: configuration.doomscrollFollowingEntrypoint
                ?? fileURLToPath(new URL('./tiktok/doomscroll-following.ts', import.meta.url)),
            env: {
                IOS_UDID: context.device.udid,
                TIKTOK_BUNDLE_ID: configuration.bundleId ?? 'com.zhiliaoapp.musically',
                DOOMSCROLL_DURATION_MINUTES: String(payload.durationMinutes),
                DOOMSCROLL_PERSONALITY: payload.personality,
                DOOMSCROLL_LIKE_ENABLED: String(payload.likeEnabled),
                DOOMSCROLL_SAVE_ENABLED: String(payload.saveEnabled),
                DOOMSCROLL_COMMENT_ENABLED: String(payload.commentEnabled),
                ...(payload.commentText ? { DOOMSCROLL_COMMENT_TEXT: payload.commentText } : {}),
                ...(payload.account ? { TIKTOK_SWITCH_ACCOUNT: payload.account } : {}),
            },
        }),
    };
}

function createWorkflowReplayTask(configuration: TikTokPluginConfiguration): TaskDefinition<WorkflowReplayPayload> {
    return {
        type: 'workflow-replay', version: 1, displayName: 'TikTok workflow replay',
        validate(value) {
            const input = objectPayload(value);
            if (typeof input.workflowId !== 'string' || !input.workflowId.trim()) {
                throw new Error('workflowId is required');
            }
            const durationMinutes = input.durationMinutes;
            const loops = input.loops;
            if (durationMinutes !== undefined) {
                if (!Number.isInteger(durationMinutes) || typeof durationMinutes !== 'number'
                    || durationMinutes < 1 || durationMinutes > 180) {
                    throw new Error('durationMinutes must be between 1 and 180');
                }
            }
            if (loops !== undefined) {
                if (!Number.isInteger(loops) || typeof loops !== 'number' || loops < 1 || loops > 500) {
                    throw new Error('loops must be between 1 and 500');
                }
            }
            if (durationMinutes === undefined && loops === undefined) {
                throw new Error('Provide durationMinutes or loops');
            }
            const commentText = optionalString(input.commentText, 'commentText');
            if (commentText && commentText.length > 150) throw new Error('commentText must be 150 characters or fewer');
            return {
                workflowId: input.workflowId.trim(),
                ...(durationMinutes !== undefined ? { durationMinutes } : {}),
                ...(loops !== undefined ? { loops } : {}),
                ...(commentText ? { commentText } : {}),
            };
        },
        summarize: (payload) => payload.durationMinutes
            ? `Replay · ${payload.durationMinutes} min`
            : `Replay · ${payload.loops} loops`,
        estimateDurationMs: (payload) => (payload.durationMinutes ?? Math.min(payload.loops ?? 1, 30)) * 60_000,
        retryPolicy: () => ({ retryLimit: 1, retryDelaySeconds: 30, retryBackoff: true }),
        supportsStop: () => true,
        execute: (context, payload) => context.runProcess({
            entrypoint: configuration.workflowReplayEntrypoint
                ?? fileURLToPath(new URL('./tiktok/workflow-replay.ts', import.meta.url)),
            env: {
                IOS_UDID: context.device.udid,
                TIKTOK_BUNDLE_ID: configuration.bundleId ?? 'com.zhiliaoapp.musically',
                WORKFLOW_ID: payload.workflowId,
                ...(payload.durationMinutes !== undefined
                    ? { WORKFLOW_DURATION_MINUTES: String(payload.durationMinutes) }
                    : {}),
                ...(payload.loops !== undefined ? { WORKFLOW_LOOPS: String(payload.loops) } : {}),
                ...(payload.commentText ? { WORKFLOW_COMMENT_TEXT: payload.commentText } : {}),
            },
        }),
    };
}

function createPostTask(configuration: TikTokPluginConfiguration): TaskDefinition<PostPayload> {
    return {
        type: 'post', version: 1, displayName: 'TikTok post',
        validate(value, context) {
            const input = objectPayload(value);
            if (!Array.isArray(input.media) || input.media.length < 1 || input.media.length > 3) {
                throw new Error('Choose one to three media files');
            }
            const media = input.media.map((item) => {
                const candidate = objectPayload(item);
                if (typeof candidate.assetId !== 'string' || typeof candidate.name !== 'string' || typeof candidate.mimeType !== 'string') {
                    throw new Error('Invalid media item');
                }
                return { assetId: candidate.assetId, name: candidate.name, mimeType: candidate.mimeType };
            });
            if (input.destination !== 'draft' && input.destination !== 'publish') throw new Error('Invalid post destination');
            if (typeof input.account !== 'string' || !input.account.trim()) throw new Error('Choose a TikTok account');
            const caption = optionalString(input.caption, 'caption');
            if (caption && caption.length > 2200) throw new Error('Caption must be 2,200 characters or fewer');
            const musicUrl = optionalString(input.musicUrl, 'musicUrl');
            if (musicUrl) {
                const parsed = new URL(musicUrl);
                if (parsed.protocol !== 'https:' || !/(^|\.)tiktok\.com$/i.test(parsed.hostname)) {
                    throw new Error('Music URL must be an HTTPS TikTok URL');
                }
            }
            const recurring = context.timingKind === 'daily' || context.timingKind === 'weekly';
            if (recurring && input.destination === 'publish' && input.recurringPublishConfirmed !== true) {
                throw new Error('Recurring public posts require explicit confirmation');
            }
            return {
                media, destination: input.destination, account: input.account,
                ...(caption ? { caption } : {}), ...(musicUrl ? { musicUrl } : {}),
                ...(input.recurringPublishConfirmed === true ? { recurringPublishConfirmed: true } : {}),
            };
        },
        summarize: (payload) => `Post · ${payload.destination === 'publish' ? 'public' : 'draft'} · ${payload.media.length} media`,
        estimateDurationMs: () => 60_000,
        retryPolicy: () => ({ retryLimit: 0, retryDelaySeconds: 0, retryBackoff: false }),
        supportsStop: () => false,
        async execute(context: TaskExecutionContext, payload) {
            const byId = new Map(context.assets.map((asset) => [asset.id, asset]));
            const files = payload.media.map((media) => {
                const asset = byId.get(media.assetId);
                if (!asset) throw new Error(`Scheduled media asset ${media.assetId} is missing`);
                return { path: asset.path, name: media.name, mimeType: media.mimeType };
            });
            const manifestPath = path.join(context.workspaceDirectory, 'manifest.json');
            await writeFile(manifestPath, JSON.stringify({
                device: context.device, files, destination: payload.destination, account: payload.account,
                ...(payload.caption ? { caption: payload.caption } : {}),
                ...(payload.musicUrl ? { musicUrl: payload.musicUrl } : {}),
            }));
            return context.runProcess({
                entrypoint: configuration.postEntrypoint ?? fileURLToPath(new URL('./tiktok/post.ts', import.meta.url)),
                args: [manifestPath],
            });
        },
    };
}

export function createTikTokPlugin(configuration: TikTokPluginConfiguration = {}): PhoneFarmPlugin {
    return {
        id: 'com.git-agni.tiktok',
        version: '0.1.0',
        displayName: 'TikTok automation',
        tasks: [
            createDoomscrollTask(configuration),
            createFollowingDoomscrollTask(configuration),
            createWorkflowReplayTask(configuration),
            createPostTask(configuration),
        ],
        devicePanels: [{
            id: 'tiktok-controls', title: 'TikTok',
            fragmentPath: fileURLToPath(new URL('../static/tiktok/device-panel.html', import.meta.url)), order: 100,
        }],
        async registerRoutes(context) {
            const deviceData = async (udid: string) => (await context.loadDevices()).find((device) => device.udid === udid);
            const tiktokPluginData = (device: { pluginData: Record<string, JsonObject | undefined> }) => (
                device.pluginData['com.git-agni.tiktok'] ?? {}
            );

            context.app.get<{ Params: { udid: string } }>('/api/devices/:udid/tiktok/workflows', async (request, reply) => {
                const device = await deviceData(request.params.udid);
                if (!device) return reply.code(404).send({ error: 'Device is not registered' });
                return { workflows: listWorkflowsFromPluginData(tiktokPluginData(device) as Record<string, unknown>) };
            });

            context.app.post<{
                Params: { udid: string };
                Body: { name?: string; events?: unknown; steps?: unknown; meta?: WorkflowPattern['meta'] };
            }>('/api/devices/:udid/tiktok/workflows', async (request, reply) => {
                const device = await deviceData(request.params.udid);
                if (!device) return reply.code(404).send({ error: 'Device is not registered' });
                try {
                    const coords = resolveDeviceCoordinates(
                        device.coordinateProfile,
                        device.coordinates,
                    ).tiktok;
                    const body = request.body;
                    const name = typeof body.name === 'string' ? body.name : '';
                    let pattern: WorkflowPattern;
                    if (Array.isArray(body.steps)) {
                        const steps = body.steps.map((item, index) => {
                            if (!item || typeof item !== 'object' || Array.isArray(item)) {
                                throw new Error(`steps[${index}] must be an object`);
                            }
                            const timed = item as Record<string, unknown>;
                            if (typeof timed.t !== 'number') throw new Error(`steps[${index}].t must be a number`);
                            return { t: Math.round(timed.t), step: parseWorkflowStep(timed.step) };
                        }) as WorkflowTimedStep[];
                        pattern = createWorkflowPattern({ name, events: [], coords, steps, meta: body.meta });
                    } else {
                        pattern = createWorkflowPattern({
                            name,
                            events: parseRecordedEvents(body.events),
                            coords,
                            meta: body.meta,
                        });
                    }
                    await context.mutateDevices((devices) => {
                        const target = devices.find(({ udid }) => udid === request.params.udid);
                        if (!target) return false;
                        const current = listWorkflowsFromPluginData(
                            (target.pluginData['com.git-agni.tiktok'] ?? {}) as Record<string, unknown>,
                        );
                        target.pluginData = {
                            ...target.pluginData,
                            'com.git-agni.tiktok': replaceWorkflowsInPluginData(
                                target.pluginData['com.git-agni.tiktok'] as Record<string, unknown> | undefined,
                                [...current, pattern],
                            ) as JsonObject,
                        };
                        return true;
                    });
                    return reply.code(201).send(pattern);
                } catch (error) {
                    return reply.code(400).send({ error: error instanceof Error ? error.message : String(error) });
                }
            });

            context.app.get<{ Params: { udid: string; id: string } }>(
                '/api/devices/:udid/tiktok/workflows/:id',
                async (request, reply) => {
                    const device = await deviceData(request.params.udid);
                    if (!device) return reply.code(404).send({ error: 'Device is not registered' });
                    const workflow = listWorkflowsFromPluginData(tiktokPluginData(device) as Record<string, unknown>)
                        .find(({ id }) => id === request.params.id);
                    if (!workflow) return reply.code(404).send({ error: 'Workflow not found' });
                    return workflow;
                },
            );

            context.app.patch<{
                Params: { udid: string; id: string };
                Body: { name?: string; steps?: unknown; meta?: WorkflowPattern['meta'] };
            }>('/api/devices/:udid/tiktok/workflows/:id', async (request, reply) => {
                const device = await deviceData(request.params.udid);
                if (!device) return reply.code(404).send({ error: 'Device is not registered' });
                try {
                    let updated: WorkflowPattern | undefined;
                    const found = await context.mutateDevices((devices) => {
                        const target = devices.find(({ udid }) => udid === request.params.udid);
                        if (!target) return false;
                        const current = listWorkflowsFromPluginData(
                            (target.pluginData['com.git-agni.tiktok'] ?? {}) as Record<string, unknown>,
                        );
                        const index = current.findIndex(({ id }) => id === request.params.id);
                        if (index < 0) return false;
                        const existing = current[index]!;
                        const name = request.body.name !== undefined
                            ? String(request.body.name).trim()
                            : existing.name;
                        if (!name) throw new Error('Workflow name is required');
                        const steps = request.body.steps !== undefined
                            ? (request.body.steps as unknown[]).map((item, i) => {
                                if (!item || typeof item !== 'object' || Array.isArray(item)) {
                                    throw new Error(`steps[${i}] must be an object`);
                                }
                                const timed = item as Record<string, unknown>;
                                if (typeof timed.t !== 'number') throw new Error(`steps[${i}].t must be a number`);
                                return { t: Math.round(timed.t), step: parseWorkflowStep(timed.step) };
                            })
                            : existing.steps;
                        updated = parseWorkflowPattern({
                            ...existing,
                            name,
                            steps,
                            ...(request.body.meta !== undefined ? { meta: request.body.meta } : {}),
                        });
                        const next = [...current];
                        next[index] = updated;
                        target.pluginData = {
                            ...target.pluginData,
                            'com.git-agni.tiktok': replaceWorkflowsInPluginData(
                                target.pluginData['com.git-agni.tiktok'] as Record<string, unknown> | undefined,
                                next,
                            ) as JsonObject,
                        };
                        return true;
                    });
                    if (!found || !updated) return reply.code(404).send({ error: 'Workflow not found' });
                    return updated;
                } catch (error) {
                    return reply.code(400).send({ error: error instanceof Error ? error.message : String(error) });
                }
            });

            context.app.delete<{ Params: { udid: string; id: string } }>(
                '/api/devices/:udid/tiktok/workflows/:id',
                async (request, reply) => {
                    const found = await context.mutateDevices((devices) => {
                        const target = devices.find(({ udid }) => udid === request.params.udid);
                        if (!target) return false;
                        const current = listWorkflowsFromPluginData(
                            (target.pluginData['com.git-agni.tiktok'] ?? {}) as Record<string, unknown>,
                        );
                        const next = current.filter(({ id }) => id !== request.params.id);
                        if (next.length === current.length) return false;
                        target.pluginData = {
                            ...target.pluginData,
                            'com.git-agni.tiktok': replaceWorkflowsInPluginData(
                                target.pluginData['com.git-agni.tiktok'] as Record<string, unknown> | undefined,
                                next,
                            ) as JsonObject,
                        };
                        return true;
                    });
                    if (!found) return reply.code(404).send({ error: 'Workflow not found' });
                    return reply.code(204).send();
                },
            );

            context.app.post<{ Params: { udid: string }; Body: Record<string, string> }>(
                '/api/devices/:udid/fragments/following-scroll-run', async (request, reply) => {
                    const device = await deviceData(request.params.udid);
                    if (!device) return reply.code(404).send({ error: 'Device is not registered' });
                    if (device.disabled) {
                        return reply.code(409).send({ error: 'This device is disconnected — reconnect it before scheduling automation' });
                    }
                    const body = request.body;
                    const kind = body.scheduleKind ?? 'now';
                    const timing: ScheduleTiming = kind === 'now' ? { kind: 'now' }
                        : kind === 'once' ? { kind: 'once', runAt: body.runAt ?? '' }
                            : kind === 'daily' ? { kind: 'daily', localTime: body.localTime ?? '', timezone: body.timezone ?? 'UTC' }
                                : { kind: 'weekly', localTime: body.localTime ?? '', timezone: body.timezone ?? 'UTC', weekdays: (body.weekdays ?? '').split(',').filter(Boolean).map(Number) };
                    try {
                        if (kind === 'now') {
                            const recent = await context.scheduler.listExecutions(50, device.udid);
                            const mine = recent.filter(({ pluginId, taskType }) => (
                                pluginId === 'com.git-agni.tiktok' && taskType === 'doomscroll-following'
                            ));
                            if (mine.some(({ status }) => status === 'running')) {
                                throw new Error('A Following doomscroll is already running on this device. Stop it from Activity, then start again.');
                            }
                            await context.scheduler.clearDeviceQueue(device.udid, {
                                pluginId: 'com.git-agni.tiktok',
                                taskType: 'doomscroll-following',
                                onlyQueued: true,
                            });
                        }
                        await context.scheduler.createTask({
                            deviceUdid: device.udid,
                            task: {
                                pluginId: 'com.git-agni.tiktok', taskType: 'doomscroll-following', taskVersion: 1,
                                payload: {
                                    durationMinutes: Number(body.durationMinutes),
                                    personality: body.personality,
                                    likeEnabled: body.likeEnabled === 'on',
                                    saveEnabled: body.saveEnabled === 'on',
                                    commentEnabled: body.commentEnabled === 'on',
                                    ...(body.commentText?.trim() ? { commentText: body.commentText.trim() } : {}),
                                    ...(body.account?.trim() ? { account: body.account.trim() } : {}),
                                },
                            },
                            timing,
                            runWindowMinutes: body.runWindowMinutes ? Number(body.runWindowMinutes) : undefined,
                        }, device.pluginData['com.git-agni.tiktok'] ?? {});
                        return reply.code(202).type('text/html').send(await context.renderActivity(device.udid));
                    } catch (error) {
                        const message = error instanceof Error ? error.message : String(error);
                        return reply.code(409).type('text/html').send(await context.renderActivity(device.udid, message));
                    }
                },
            );

            context.app.post<{ Params: { udid: string }; Body: Record<string, string> }>(
                '/api/devices/:udid/fragments/workflow-replay-run', async (request, reply) => {
                    const device = await deviceData(request.params.udid);
                    if (!device) return reply.code(404).send({ error: 'Device is not registered' });
                    if (device.disabled) {
                        return reply.code(409).send({ error: 'This device is disconnected — reconnect it before scheduling automation' });
                    }
                    const body = request.body;
                    try {
                        await context.scheduler.createTask({
                            deviceUdid: device.udid,
                            task: {
                                pluginId: 'com.git-agni.tiktok', taskType: 'workflow-replay', taskVersion: 1,
                                payload: {
                                    workflowId: body.workflowId ?? '',
                                    ...(body.durationMinutes ? { durationMinutes: Number(body.durationMinutes) } : {}),
                                    ...(body.loops ? { loops: Number(body.loops) } : {}),
                                    ...(body.commentText?.trim() ? { commentText: body.commentText.trim() } : {}),
                                },
                            },
                            timing: { kind: 'now' },
                        }, device.pluginData['com.git-agni.tiktok'] ?? {});
                        return reply.code(202).type('text/html').send(await context.renderActivity(device.udid));
                    } catch (error) {
                        const message = error instanceof Error ? error.message : String(error);
                        return reply.code(409).type('text/html').send(await context.renderActivity(device.udid, message));
                    }
                },
            );

            context.app.patch<{ Params: { udid: string }; Body: { accounts?: string[] } }>('/api/devices/:udid/accounts', async (request, reply) => {
                if (!Array.isArray(request.body.accounts)) return reply.code(400).send({ error: 'accounts must be an array' });
                const accounts = [...new Set(request.body.accounts.map((value) => value.trim()).filter(Boolean)
                    .map((value) => value.startsWith('@') ? value : `@${value}`))];
                if (accounts.some((value) => !/^@[A-Za-z0-9._]{1,64}$/.test(value))) {
                    return reply.code(400).send({ error: 'TikTok handles may contain letters, numbers, periods, and underscores' });
                }
                const found = await context.mutateDevices((devices) => {
                    const device = devices.find(({ udid }) => udid === request.params.udid);
                    if (!device) return false;
                    device.pluginData = { ...device.pluginData, 'com.git-agni.tiktok': { ...device.pluginData['com.git-agni.tiktok'], accounts } };
                    return true;
                });
                if (!found) return reply.code(404).send({ error: 'Device is not registered' });
                return { accounts };
            });

            context.app.post<{ Params: { udid: string }; Body: Record<string, string> }>(
                '/api/devices/:udid/fragments/scroll-run', async (request, reply) => {
                    const device = await deviceData(request.params.udid);
                    if (!device) return reply.code(404).send({ error: 'Device is not registered' });
                    if (device.disabled) return reply.code(409).send({ error: 'This device is disconnected — reconnect it before scheduling automation' });
                    const body = request.body;
                    const kind = body.scheduleKind ?? 'now';
                    const timing: ScheduleTiming = kind === 'now' ? { kind: 'now' }
                        : kind === 'once' ? { kind: 'once', runAt: body.runAt ?? '' }
                            : kind === 'daily' ? { kind: 'daily', localTime: body.localTime ?? '', timezone: body.timezone ?? 'UTC' }
                                : { kind: 'weekly', localTime: body.localTime ?? '', timezone: body.timezone ?? 'UTC', weekdays: (body.weekdays ?? '').split(',').filter(Boolean).map(Number) };
                    try {
                        if (kind === 'now') {
                            const recent = await context.scheduler.listExecutions(50, device.udid);
                            const mine = recent.filter(({ pluginId, taskType }) => (
                                pluginId === 'com.git-agni.tiktok' && taskType === 'doomscroll'
                            ));
                            if (mine.some(({ status }) => status === 'running')) {
                                throw new Error('A TikTok doomscroll is already running on this device. Stop it from Activity, then start again.');
                            }
                            await context.scheduler.clearDeviceQueue(device.udid, {
                                pluginId: 'com.git-agni.tiktok',
                                taskType: 'doomscroll',
                                onlyQueued: true,
                            });
                        }
                        await context.scheduler.createTask({
                            deviceUdid: device.udid,
                            task: {
                                pluginId: 'com.git-agni.tiktok', taskType: 'doomscroll', taskVersion: 1,
                                payload: {
                                    durationMinutes: Number(body.durationMinutes), personality: body.personality,
                                    likeEnabled: body.likeEnabled === 'on', saveEnabled: body.saveEnabled === 'on',
                                    commentEnabled: body.commentEnabled === 'on',
                                    ...(body.commentText?.trim() ? { commentText: body.commentText.trim() } : {}),
                                    ...(body.account?.trim() ? { account: body.account.trim() } : {}),
                                },
                            },
                            timing,
                            runWindowMinutes: body.runWindowMinutes ? Number(body.runWindowMinutes) : undefined,
                        }, device.pluginData['com.git-agni.tiktok'] ?? {});
                        return reply.code(202).type('text/html').send(await context.renderActivity(device.udid));
                    } catch (error) {
                        const message = error instanceof Error ? error.message : String(error);
                        return reply.code(409).type('text/html').send(await context.renderActivity(device.udid, message));
                    }
                },
            );

            context.app.get<{ Params: { udid: string } }>('/api/devices/:udid/posts/current', async (request) => {
                const latest = (await context.scheduler.listExecutions(25, request.params.udid))
                    .find(({ pluginId, taskType }) => pluginId === 'com.git-agni.tiktok' && taskType === 'post');
                if (!latest) return { status: 'idle', logs: [] };
                const detail = await context.scheduler.execution(latest.id);
                return { ...latest, destination: latest.payload.destination ?? null, logs: detail?.logs ?? [] };
            });

            context.app.post<{ Params: { udid: string } }>('/api/devices/:udid/posts', async (request, reply) => {
                const device = await deviceData(request.params.udid);
                if (!device) return reply.code(404).send({ error: 'Device is not registered' });
                if (device.disabled) return reply.code(409).send({ error: 'This device is disconnected — reconnect it before posting' });
                const dataRoot = path.resolve(process.env.SCHEDULER_DATA_DIR ?? '.scheduler-data');
                const assetRoot = path.join(dataRoot, 'assets');
                await mkdir(assetRoot, { recursive: true });
                const directory = await mkdtemp(path.join(assetRoot, 'post-'));
                const files: Array<{ path: string; name: string; mimeType: string }> = [];
                const fields = new Map<string, string>();
                let assetIds: string[] = [];
                try {
                    for await (const part of request.parts()) {
                        if (part.type === 'field') { fields.set(part.fieldname, String(part.value)); continue; }
                        if (part.fieldname !== 'media') continue;
                        const name = path.basename(part.filename || `upload-${files.length + 1}`).replace(/[^a-zA-Z0-9._-]/g, '_');
                        const filePath = path.join(directory, `${String(files.length).padStart(2, '0')}-${name}`);
                        await pipeline(part.file, createWriteStream(filePath, { flags: 'wx' }));
                        if (part.file.truncated) throw new Error(`${name} exceeds the upload limit`);
                        files.push({ path: filePath, name, mimeType: part.mimetype });
                    }
                    if (files.length < 1 || files.length > 3) throw new Error('Choose one to three media files');
                    const videos = files.filter(({ mimeType }) => mimeType.startsWith('video/'));
                    const images = files.filter(({ mimeType }) => mimeType.startsWith('image/'));
                    if (!((videos.length === 1 && files.length === 1) || images.length === files.length)) {
                        throw new Error('Upload exactly one video, or upload only slideshow images');
                    }
                    const destination = fields.get('destination');
                    if (destination !== 'draft' && destination !== 'publish') throw new Error('Choose Draft or Post');
                    const account = fields.get('account')?.trim();
                    if (!account) throw new Error('Choose a TikTok account');
                    const timing = fields.has('timing') ? JSON.parse(fields.get('timing')!) as ScheduleTiming : { kind: 'now' } as const;
                    const stored = await context.scheduler.registerAssets(await Promise.all(files.map(async (file) => ({
                        relativePath: path.relative(dataRoot, file.path), originalName: file.name, mimeType: file.mimeType,
                        size: (await stat(file.path)).size,
                        sha256: await new Promise<string>((resolve, reject) => {
                            const hash = crypto.createHash('sha256');
                            createReadStream(file.path).on('data', (chunk) => hash.update(chunk)).once('error', reject).once('end', () => resolve(hash.digest('hex')));
                        }),
                    }))));
                    assetIds = stored.map(({ id }) => id);
                    const schedule = await context.scheduler.createTask({
                        deviceUdid: device.udid,
                        task: {
                            pluginId: 'com.git-agni.tiktok', taskType: 'post', taskVersion: 1,
                            payload: {
                                media: stored.map(({ id, name, mimeType }) => ({ assetId: id, name, mimeType })),
                                destination, account,
                                ...(fields.get('caption')?.trim() ? { caption: fields.get('caption')!.trim() } : {}),
                                ...(fields.get('musicUrl')?.trim() ? { musicUrl: fields.get('musicUrl')!.trim() } : {}),
                                ...(fields.get('recurringPublishConfirmed') === 'true' ? { recurringPublishConfirmed: true } : {}),
                            },
                        },
                        timing,
                        runWindowMinutes: fields.get('runWindowMinutes') ? Number(fields.get('runWindowMinutes')) : undefined,
                    }, device.pluginData['com.git-agni.tiktok'] ?? {}, new Date(), assetIds);
                    return reply.code(202).send(schedule);
                } catch (error) {
                    if (assetIds.length) await context.scheduler.deleteAssets(assetIds);
                    await rm(directory, { recursive: true, force: true });
                    return reply.code(400).send({ error: error instanceof Error ? error.message : String(error) });
                }
            });
        },
    };
}
