import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';

import type { PhoneFarmPlugin, TaskDefinition, TaskExecutionContext } from './plugin.js';
import type { JsonObject, JsonValue, ScheduleTiming } from './types.js';

export interface InstagramPluginConfiguration {
    doomscrollEntrypoint?: string;
    doomscrollFollowingEntrypoint?: string;
    postEntrypoint?: string;
    bundleId?: string;
}

type DoomscrollPayload = JsonObject & {
    durationMinutes: number;
    personality: 'skimmer' | 'casual' | 'engaged' | 'dialed';
    likeEnabled: boolean;
    commentEnabled: boolean;
    commentText?: string;
    account?: string;
};

type PostMedia = JsonObject & {
    assetId: string;
    name: string;
    mimeType: string;
};

type PostPayload = JsonObject & {
    media: PostMedia[];
    destination: 'draft' | 'publish';
    account?: string;
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

function validateDoomscrollPayload(value: JsonValue): DoomscrollPayload {
    const input = objectPayload(value);
    const durationMinutes = input.durationMinutes;
    const personality = input.personality;
    if (!Number.isInteger(durationMinutes) || typeof durationMinutes !== 'number' || durationMinutes < 1 || durationMinutes > 180) {
        throw new Error('durationMinutes must be between 1 and 180');
    }
    if (personality !== 'skimmer' && personality !== 'casual' && personality !== 'engaged' && personality !== 'dialed') {
        throw new Error('Invalid personality');
    }
    if (typeof input.likeEnabled !== 'boolean') {
        throw new Error('likeEnabled must be boolean');
    }
    if (typeof input.commentEnabled !== 'boolean') {
        throw new Error('commentEnabled must be boolean');
    }
    const commentText = optionalString(input.commentText, 'commentText');
    if (commentText && commentText.length > 150) throw new Error('commentText must be 150 characters or fewer');
    if (input.commentEnabled && !commentText?.trim()) {
        throw new Error('commentText is required when commentEnabled is true');
    }
    const account = optionalString(input.account, 'account');
    return {
        durationMinutes, personality, likeEnabled: input.likeEnabled,
        commentEnabled: input.commentEnabled,
        ...(commentText ? { commentText } : {}),
        ...(account ? { account } : {}),
    };
}

function createDoomscrollTask(configuration: InstagramPluginConfiguration): TaskDefinition<DoomscrollPayload> {
    return {
        type: 'doomscroll', version: 1, displayName: 'Instagram warmup',
        validate: (value) => validateDoomscrollPayload(value),
        summarize: (payload) => `Warmup · ${payload.personality} · ${payload.durationMinutes} min`,
        estimateDurationMs: (payload) => payload.durationMinutes * 60_000,
        retryPolicy: () => ({ retryLimit: 2, retryDelaySeconds: 60, retryBackoff: true }),
        supportsStop: () => true,
        execute: (context, payload) => context.runProcess({
            entrypoint: configuration.doomscrollEntrypoint ?? fileURLToPath(new URL('./instagram/doomscroll.ts', import.meta.url)),
            env: {
                IOS_UDID: context.device.udid,
                INSTAGRAM_BUNDLE_ID: configuration.bundleId ?? 'com.burbn.instagram',
                DOOMSCROLL_DURATION_MINUTES: String(payload.durationMinutes),
                DOOMSCROLL_PERSONALITY: payload.personality,
                DOOMSCROLL_LIKE_ENABLED: String(payload.likeEnabled),
                DOOMSCROLL_COMMENT_ENABLED: String(payload.commentEnabled),
                ...(payload.commentText ? { DOOMSCROLL_COMMENT_TEXT: payload.commentText } : {}),
                ...(payload.account ? { INSTAGRAM_SWITCH_ACCOUNT: payload.account } : {}),
            },
        }),
    };
}

function createDoomscrollFollowingTask(configuration: InstagramPluginConfiguration): TaskDefinition<DoomscrollPayload> {
    return {
        type: 'doomscroll-following', version: 1, displayName: 'Instagram engage following',
        validate: (value) => validateDoomscrollPayload(value),
        summarize: (payload) => `Engage following · ${payload.personality} · ${payload.durationMinutes} min`,
        estimateDurationMs: (payload) => payload.durationMinutes * 60_000,
        retryPolicy: () => ({ retryLimit: 2, retryDelaySeconds: 60, retryBackoff: true }),
        supportsStop: () => true,
        execute: (context, payload) => context.runProcess({
            entrypoint: configuration.doomscrollFollowingEntrypoint
                ?? fileURLToPath(new URL('./instagram/doomscroll-following.ts', import.meta.url)),
            env: {
                IOS_UDID: context.device.udid,
                INSTAGRAM_BUNDLE_ID: configuration.bundleId ?? 'com.burbn.instagram',
                DOOMSCROLL_DURATION_MINUTES: String(payload.durationMinutes),
                DOOMSCROLL_PERSONALITY: payload.personality,
                DOOMSCROLL_LIKE_ENABLED: String(payload.likeEnabled),
                DOOMSCROLL_COMMENT_ENABLED: String(payload.commentEnabled),
                ...(payload.commentText ? { DOOMSCROLL_COMMENT_TEXT: payload.commentText } : {}),
                ...(payload.account ? { INSTAGRAM_SWITCH_ACCOUNT: payload.account } : {}),
            },
        }),
    };
}

function createPostTask(configuration: InstagramPluginConfiguration): TaskDefinition<PostPayload> {
    return {
        type: 'post', version: 1, displayName: 'Instagram post',
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
            const account = optionalString(input.account, 'account')?.trim();
            if (account && !/^@[A-Za-z0-9._]{1,64}$/.test(account)) {
                throw new Error('Instagram handles may contain letters, numbers, periods, and underscores');
            }
            const caption = optionalString(input.caption, 'caption');
            if (caption && caption.length > 2200) throw new Error('Caption must be 2,200 characters or fewer');
            const musicUrl = optionalString(input.musicUrl, 'musicUrl');
            if (musicUrl) {
                const parsed = new URL(musicUrl);
                if (parsed.protocol !== 'https:' || !/(^|\.)instagram\.com$/i.test(parsed.hostname)) {
                    throw new Error('Music URL must be an HTTPS Instagram URL');
                }
            }
            const recurring = context.timingKind === 'daily' || context.timingKind === 'weekly';
            if (recurring && input.destination === 'publish' && input.recurringPublishConfirmed !== true) {
                throw new Error('Recurring public posts require explicit confirmation');
            }
            return {
                media, destination: input.destination,
                ...(account ? { account } : {}),
                ...(caption ? { caption } : {}), ...(musicUrl ? { musicUrl } : {}),
                ...(input.recurringPublishConfirmed === true ? { recurringPublishConfirmed: true } : {}),
            };
        },
        summarize: (payload) => `Upload · ${payload.media.length} media`,
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
                device: context.device, files, destination: payload.destination,
                ...(payload.account ? { account: payload.account } : {}),
                ...(payload.caption ? { caption: payload.caption } : {}),
                ...(payload.musicUrl ? { musicUrl: payload.musicUrl } : {}),
            }));
            return context.runProcess({
                entrypoint: configuration.postEntrypoint ?? fileURLToPath(new URL('./instagram/post.ts', import.meta.url)),
                args: [manifestPath],
                env: {
                    INSTAGRAM_BUNDLE_ID: configuration.bundleId ?? 'com.burbn.instagram',
                },
            });
        },
    };
}

export function createInstagramPlugin(configuration: InstagramPluginConfiguration = {}): PhoneFarmPlugin {
    return {
        id: 'com.git-agni.instagram',
        version: '0.1.0',
        displayName: 'Instagram automation',
        tasks: [createDoomscrollTask(configuration), createDoomscrollFollowingTask(configuration), createPostTask(configuration)],
        devicePanels: [{
            id: 'instagram-controls', title: 'Instagram',
            fragmentPath: fileURLToPath(new URL('../static/instagram/device-panel.html', import.meta.url)), order: 100,
        }],
        async registerRoutes(context) {
            const deviceData = async (udid: string) => (await context.loadDevices()).find((device) => device.udid === udid);
            context.app.patch<{ Params: { udid: string }; Body: { accounts?: string[] } }>('/api/devices/:udid/instagram/accounts', async (request, reply) => {
                if (!Array.isArray(request.body.accounts)) return reply.code(400).send({ error: 'accounts must be an array' });
                const accounts = [...new Set(request.body.accounts.map((value) => value.trim()).filter(Boolean)
                    .map((value) => value.startsWith('@') ? value : `@${value}`))];
                if (accounts.some((value) => !/^@[A-Za-z0-9._]{1,64}$/.test(value))) {
                    return reply.code(400).send({ error: 'Instagram handles may contain letters, numbers, periods, and underscores' });
                }
                const found = await context.mutateDevices((devices) => {
                    const device = devices.find(({ udid }) => udid === request.params.udid);
                    if (!device) return false;
                    device.pluginData = { ...device.pluginData, 'com.git-agni.instagram': { ...device.pluginData['com.git-agni.instagram'], accounts } };
                    return true;
                });
                if (!found) return reply.code(404).send({ error: 'Device is not registered' });
                return { accounts };
            });

            context.app.post<{ Params: { udid: string }; Body: Record<string, string> }>(
                '/api/devices/:udid/instagram/fragments/scroll-run', async (request, reply) => {
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
                                pluginId === 'com.git-agni.instagram' && taskType === 'doomscroll'
                            ));
                            if (mine.some(({ status }) => status === 'running')) {
                                throw new Error('A warmup session is already running on this device. Stop it from Activity, then start again.');
                            }
                            await context.scheduler.clearDeviceQueue(device.udid, {
                                pluginId: 'com.git-agni.instagram',
                                taskType: 'doomscroll',
                                onlyQueued: true,
                            });
                        }
                        await context.scheduler.createTask({
                            deviceUdid: device.udid,
                            task: {
                                pluginId: 'com.git-agni.instagram', taskType: 'doomscroll', taskVersion: 1,
                                payload: {
                                    durationMinutes: Number(body.durationMinutes), personality: body.personality,
                                    likeEnabled: body.likeEnabled === 'on',
                                    commentEnabled: body.commentEnabled === 'on',
                                    ...(body.commentText?.trim() ? { commentText: body.commentText.trim() } : {}),
                                    ...(body.account?.trim() ? { account: body.account.trim() } : {}),
                                },
                            },
                            timing,
                            runWindowMinutes: body.runWindowMinutes ? Number(body.runWindowMinutes) : undefined,
                        }, device.pluginData['com.git-agni.instagram'] ?? {});
                        return reply.code(202).type('text/html').send(await context.renderActivity(device.udid));
                    } catch (error) {
                        const message = error instanceof Error ? error.message : String(error);
                        return reply.code(409).type('text/html').send(await context.renderActivity(device.udid, message));
                    }
                },
            );

            context.app.post<{ Params: { udid: string }; Body: Record<string, string> }>(
                '/api/devices/:udid/instagram/fragments/following-scroll-run', async (request, reply) => {
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
                                pluginId === 'com.git-agni.instagram' && taskType === 'doomscroll-following'
                            ));
                            if (mine.some(({ status }) => status === 'running')) {
                                throw new Error('An engage following session is already running on this device. Stop it from Activity, then start again.');
                            }
                            await context.scheduler.clearDeviceQueue(device.udid, {
                                pluginId: 'com.git-agni.instagram',
                                taskType: 'doomscroll-following',
                                onlyQueued: true,
                            });
                        }
                        await context.scheduler.createTask({
                            deviceUdid: device.udid,
                            task: {
                                pluginId: 'com.git-agni.instagram', taskType: 'doomscroll-following', taskVersion: 1,
                                payload: {
                                    durationMinutes: Number(body.durationMinutes), personality: body.personality,
                                    likeEnabled: body.likeEnabled === 'on',
                                    commentEnabled: body.commentEnabled === 'on',
                                    ...(body.commentText?.trim() ? { commentText: body.commentText.trim() } : {}),
                                    ...(body.account?.trim() ? { account: body.account.trim() } : {}),
                                },
                            },
                            timing,
                            runWindowMinutes: body.runWindowMinutes ? Number(body.runWindowMinutes) : undefined,
                        }, device.pluginData['com.git-agni.instagram'] ?? {});
                        return reply.code(202).type('text/html').send(await context.renderActivity(device.udid));
                    } catch (error) {
                        const message = error instanceof Error ? error.message : String(error);
                        return reply.code(409).type('text/html').send(await context.renderActivity(device.udid, message));
                    }
                },
            );

            context.app.get<{ Params: { udid: string } }>('/api/devices/:udid/instagram/posts/current', async (request) => {
                const latest = (await context.scheduler.listExecutions(25, request.params.udid))
                    .find(({ pluginId, taskType }) => pluginId === 'com.git-agni.instagram' && taskType === 'post');
                if (!latest) return { status: 'idle', logs: [] };
                const detail = await context.scheduler.execution(latest.id);
                return { ...latest, destination: latest.payload.destination ?? null, logs: detail?.logs ?? [] };
            });

            context.app.post<{ Params: { udid: string } }>('/api/devices/:udid/instagram/posts', async (request, reply) => {
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
                    const account = fields.get('account')?.trim() || undefined;
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
                            pluginId: 'com.git-agni.instagram', taskType: 'post', taskVersion: 1,
                            payload: {
                                media: stored.map(({ id, name, mimeType }) => ({ assetId: id, name, mimeType })),
                                destination,
                                ...(account ? { account } : {}),
                                ...(fields.get('caption')?.trim() ? { caption: fields.get('caption')!.trim() } : {}),
                                ...(fields.get('musicUrl')?.trim() ? { musicUrl: fields.get('musicUrl')!.trim() } : {}),
                                ...(fields.get('recurringPublishConfirmed') === 'true' ? { recurringPublishConfirmed: true } : {}),
                            },
                        },
                        timing,
                        runWindowMinutes: fields.get('runWindowMinutes') ? Number(fields.get('runWindowMinutes')) : undefined,
                    }, device.pluginData['com.git-agni.instagram'] ?? {}, new Date(), assetIds);
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
