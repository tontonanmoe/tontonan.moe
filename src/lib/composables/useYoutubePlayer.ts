import shaka from 'shaka-player/dist/shaka-player.ui';
import { type ApiResponse, Constants, Utils, YT } from 'youtubei.js/web';

import { SabrStreamingAdapter } from 'googlevideo/sabr-streaming-adapter';
import type { ReloadPlaybackContext } from 'googlevideo/protos';
import { buildSabrFormat } from 'googlevideo/utils';

import { botguardService } from '$lib/services/botguard';
import { makePlayerRequest } from '$lib/services/onesie';
import { ShakaPlayerAdapter } from '$lib/streaming/ShakaPlayerAdapter';

import { useInnertube } from './useInnertube';
import { useOnesieConfig } from './useOnesieConfig';

import { page } from '$app/state';
import { onDestroy } from 'svelte';

const VOLUME_KEY = 'youtube_player_volume';
const PLAYBACK_POSITION_KEY = 'youtube_playback_positions';
const SAVE_POSITION_INTERVAL_MS = 5000;
const WIDEVINE_DRM_SYSTEM = 'com.widevine.alpha';
const INNERTUBE_DRM_LICENSE_URL =
	'https://www.youtube.com/youtubei/v1/player/get_drm_license?prettyPrint=false&alt=json';
const ENABLE_PLAYBACK_TRACKING = true;

const DEFAULT_ABR_CONFIG = {
	enabled: true,
	// NOTE: This is reset when playback starts (limiting the resolution initially improves load times).
	restrictions: { maxHeight: 480 },
	switchInterval: 4, // Switch as soon as the above is reset.
	useNetworkInformation: false // Still unreliable.
};

type PlayerState = 'loading' | 'ready' | 'error' | 'buffering';

interface PlayerComponents {
	player: shaka.Player | null;
	ui: shaka.ui.Overlay | null;
	sabrAdapter: SabrStreamingAdapter | null;
	videoElement: HTMLVideoElement | null;
	shakaContainer: HTMLElement | null;
	customSpinner: HTMLElement | null;
}

let playerComponents: PlayerComponents = {
	player: null,
	ui: null,
	sabrAdapter: null,
	videoElement: null,
	shakaContainer: null,
	customSpinner: null
};

let playerState: PlayerState = 'loading';

let sessionPoToken: string | undefined;
let coldStartToken: string | undefined;

export function useYoutubePlayer() {
	const getInnertube = useInnertube();
	const getClientConfig = useOnesieConfig();

	let drmParams: string | undefined;
	let sessionPoTokenContentBinding: string | undefined;
	let sessionPoTokenCreationLock = false;
	let savePositionInterval: number | null = null;
	let playbackTrackerInterval: number | null = null;
	let currentVideoId = '';
	let isLive = false;

	const startTime = Math.floor(Date.now() / 1000);
	const clientPlaybackNonce = Utils.generateRandomString(12);
	const sessionId = Array.from(Array(16), () => Math.floor(Math.random() * 36).toString(36)).join(
		''
	);

	function savePlaybackPosition(videoId: string, time: number) {
		if (!videoId || time < 1) return;
		try {
			const positions = getPlaybackPositions();
			positions[videoId] = time;
			localStorage.setItem(PLAYBACK_POSITION_KEY, JSON.stringify(positions));
		} catch (error) {
			console.error('[Player]', 'Error saving playback position:', error);
		}
	}

	function getPlaybackPositions(): Record<string, number> {
		try {
			const positions = localStorage.getItem(PLAYBACK_POSITION_KEY);
			return positions ? JSON.parse(positions) : {};
		} catch (error) {
			console.error('[Player]', 'Error reading playback positions:', error);
			return {};
		}
	}

	function getPlaybackPosition(videoId: string): number {
		const positions = getPlaybackPositions();
		return positions[videoId] || 0;
	}

	function startSavingPosition() {
		if (savePositionInterval) {
			clearInterval(savePositionInterval);
		}

		savePositionInterval = window.setInterval(() => {
			const { videoElement } = playerComponents;
			if (videoElement && currentVideoId && !videoElement.paused) {
				savePlaybackPosition(currentVideoId, videoElement.currentTime);
			}
		}, SAVE_POSITION_INTERVAL_MS);
	}

	function getSavedVolume(): number {
		try {
			const volume = localStorage.getItem(VOLUME_KEY);
			return volume ? parseFloat(volume) : 1;
		} catch (error) {
			console.error('[Player]', 'Error reading saved volume:', error);
			return 1;
		}
	}

	function saveVolume(volume: number) {
		try {
			localStorage.setItem(VOLUME_KEY, volume.toString());
		} catch (error) {
			console.error('[Player]', 'Error saving volume:', error);
		}
	}

	async function mintSessionPoToken() {
		if (!sessionPoTokenContentBinding || sessionPoTokenCreationLock) return;

		sessionPoTokenCreationLock = true;
		try {
			coldStartToken = botguardService.mintColdStartToken(sessionPoTokenContentBinding);
			console.info(
				'[Player]',
				`Cold start token created (Content binding: ${decodeURIComponent(sessionPoTokenContentBinding)})`
			);

			if (!botguardService.isInitialized()) await botguardService.reinit();

			if (botguardService.integrityTokenBasedMinter) {
				sessionPoToken = await botguardService.integrityTokenBasedMinter.mintAsWebsafeString(
					decodeURIComponent(sessionPoTokenContentBinding)
				);
				console.info(
					'[Player]',
					`Session PO token created (Content binding: ${decodeURIComponent(sessionPoTokenContentBinding)})`
				);
			}
		} catch (err) {
			console.error('[Player]', 'Error minting session PO token', err);
		} finally {
			sessionPoTokenCreationLock = false;
		}
	}

	async function cleanupPreviousVideo() {
		const { player, sabrAdapter } = playerComponents;

		if (player) {
			await player.unload();
			const networkingEngine = player.getNetworkingEngine();
			if (networkingEngine) {
				networkingEngine.clearAllRequestFilters();
				networkingEngine.clearAllResponseFilters();
			}
		}

		if (sabrAdapter) {
			sabrAdapter.dispose();
			playerComponents.sabrAdapter = null;
		}

		if (playbackTrackerInterval) {
			clearInterval(playbackTrackerInterval);
			playbackTrackerInterval = null;
		}

		if (savePositionInterval) {
			clearInterval(savePositionInterval);
			savePositionInterval = null;
		}

		drmParams = undefined;
	}

	async function initializeShakaPlayer() {
		const shakaContainer = document.createElement('div');
		shakaContainer.className = 'yt-player';

		const videoEl = document.createElement('video');
		videoEl.autoplay = true;

		// Let's make sure this thing scales to the host container.
		videoEl.style.width = '100%';
		videoEl.style.height = '100%';
		shakaContainer.appendChild(videoEl);

		const loadingOverlay = document.createElement('div');
		loadingOverlay.className = 'loading-overlay';

		const spinner = document.createElement('div');
		spinner.className = 'spinner';

		loadingOverlay.appendChild(spinner);
		shakaContainer.appendChild(loadingOverlay);

		const player = new shaka.Player();

		player.configure({
			preferredAudioLanguage: 'en-US',
			abr: DEFAULT_ABR_CONFIG,
			streaming: {
				failureCallback: (error: shaka.util.Error) => {
					// Always retry after retries are exhausted (the default behaviour was to give up).
					console.error('Streaming failure:', error);
					playerState = 'error';
					player.retryStreaming(5);
				},
				bufferingGoal: 120,
				rebufferingGoal: 0.01,
				bufferBehind: 300,
				retryParameters: {
					maxAttempts: 8,
					fuzzFactor: 0.5,
					timeout: 30 * 1000
				}
			}
		});

		videoEl.volume = getSavedVolume();
		videoEl.addEventListener('volumechange', () => saveVolume(videoEl.volume));
		videoEl.addEventListener('playing', () =>
			player.configure('abr.restrictions.maxHeight', Infinity)
		);
		videoEl.addEventListener('pause', () => {
			if (currentVideoId) {
				savePlaybackPosition(currentVideoId, videoEl.currentTime);
			}
		});

		player.addEventListener('buffering', (event: Event) => {
			playerState = player.isBuffering() || (event as any).buffering ? 'buffering' : 'ready';
		});

		await player.attach(videoEl);
		const ui = new shaka.ui.Overlay(player, shakaContainer, videoEl);

		ui.configure({
			addBigPlayButton: false,
			overflowMenuButtons: [
				'captions',
				'quality',
				'language',
				'chapter',
				'picture_in_picture',
				'playback_rate',
				'loop',
				'recenter_vr',
				'toggle_stereoscopic',
				'save_video_frame'
			],
			customContextMenu: true
		});

		const volumeContainer = shakaContainer.getElementsByClassName('shaka-volume-bar-container');
		volumeContainer[0].addEventListener('mousewheel', (event) => {
			event.preventDefault();
			const delta = Math.sign((event as any).deltaY);
			const newVolume = Math.max(0, Math.min(1, videoEl.volume - delta * 0.05));
			videoEl.volume = newVolume;
			saveVolume(newVolume);
		});

		playerComponents.player = player;
		playerComponents.ui = ui;
		playerComponents.videoElement = videoEl;
		playerComponents.shakaContainer = shakaContainer;
		playerComponents.customSpinner = loadingOverlay;
	}

	async function initializeSabrAdapter() {
		const innertube = await getInnertube();
		const { player } = playerComponents;
		if (!player || !innertube) return;

		const sabrAdapter = new SabrStreamingAdapter({
			playerAdapter: new ShakaPlayerAdapter(),
			clientInfo: {
				osName: innertube.session.context.client.osName,
				osVersion: innertube.session.context.client.osVersion,
				clientName: parseInt(
					Constants.CLIENT_NAME_IDS[
						innertube.session.context.client.clientName as keyof typeof Constants.CLIENT_NAME_IDS
					]
				),
				clientVersion: innertube.session.context.client.clientVersion
			}
		});

		sabrAdapter.onMintPoToken(async () => {
			if (!sessionPoToken) {
				// For live streams, we must block and wait for the PO token as it's sometimes required for playback to start.
				// For VODs, we can mint the token in the background to avoid delaying playback, as it's not immediately required.
				// While BotGuard is pretty darn fast, it still makes a difference in user experience (from my own testing).
				if (isLive) {
					await mintSessionPoToken();
				} else {
					mintSessionPoToken().then();
				}
			}

			return sessionPoToken || coldStartToken || '';
		});

		sabrAdapter.onReloadPlayerResponse(async (reloadPlaybackContext) => {
			const apiResponse = await fetchVideoInfo(currentVideoId, reloadPlaybackContext);

			if (!apiResponse) {
				console.error('[Player]', 'Failed to reload player response');
				return;
			}

			const videoInfo = new YT.VideoInfo([apiResponse], innertube.actions, clientPlaybackNonce);
			sabrAdapter.setStreamingURL(
				innertube.session.player!.decipher(videoInfo.streaming_data?.server_abr_streaming_url)
			);
			sabrAdapter.setUstreamerConfig(
				videoInfo.player_config?.media_common_config.media_ustreamer_request_config
					?.video_playback_ustreamer_config
			);
		});

		sabrAdapter.attach(player);
		playerComponents.sabrAdapter = sabrAdapter;
	}

	async function setupRequestFilters() {
		const { player } = playerComponents;
		const networkingEngine = player?.getNetworkingEngine();
		if (!networkingEngine) return;

		networkingEngine.registerRequestFilter(async (type, request) => {
			let url = new URL(request.uris[0]);

			if (url.host.endsWith('.googlevideo.com') || url.href.includes('drm')) {
				const newUrl = new URL(url.toString());
				newUrl.searchParams.set('__host', url.host);

				const { host, protocol, port } = window.location;
				newUrl.host = host;
				newUrl.port = port;
				newUrl.port = '8080';
				newUrl.protocol = protocol;
				// newUrl.pathname = `/api/proxy${url.pathname}`;
				url = newUrl;
			}

			if (type === shaka.net.NetworkingEngine.RequestType.LICENSE) {
				const innertube = await getInnertube();

				const wrapped = {
					context: innertube.session.context,
					cpn: clientPlaybackNonce,
					drmParams: decodeURIComponent(drmParams || ''),
					drmSystem: 'DRM_SYSTEM_WIDEVINE',
					drmVideoFeature: 'DRM_VIDEO_FEATURE_SDR',
					licenseRequest: shaka.util.Uint8ArrayUtils.toBase64(
						request.body as ArrayBuffer | ArrayBufferView
					),
					sessionId: sessionId,
					videoId: currentVideoId
				};

				request.body = shaka.util.StringUtils.toUTF8(JSON.stringify(wrapped));
			} else if (request.contentType === 'text' && url.href.includes('timedtext')) {
				const innertube = await getInnertube();
				const params = new URLSearchParams(url.search);
				params.set('c', innertube.session.context.client.clientName);
				params.set('cver', innertube.session.context.client.clientVersion);
				params.set('potc', '1');
				params.set(
					'pot',
					(await botguardService.integrityTokenBasedMinter?.mintAsWebsafeString(currentVideoId)) ||
						''
				);
				url.search = params.toString();
			}

			request.uris[0] = url.toString();
		});

		networkingEngine.registerResponseFilter(async (type, response) => {
			if (type === shaka.net.NetworkingEngine.RequestType.LICENSE) {
				const wrapped = JSON.parse(shaka.util.StringUtils.fromUTF8(response.data));
				response.data = shaka.util.Uint8ArrayUtils.fromBase64(wrapped.license);
			}
		});
	}

	async function fetchVideoInfo(
		videoId: string,
		reloadPlaybackContext?: ReloadPlaybackContext
	): Promise<ApiResponse> {
		const innertube = await getInnertube();
		const clientConfig = await getClientConfig();

		const requestParams: Record<string, any> = {
			videoId,
			contentCheckOk: true,
			racyCheckOk: true,
			playbackContext: {
				adPlaybackContext: {
					pyv: true
				},
				contentPlaybackContext: {
					signatureTimestamp: innertube.session.player?.sts
				}
			}
		};

		const savedPosition = getPlaybackPosition(currentVideoId);
		if (savedPosition > 0) {
			requestParams.startTimeSecs = Math.floor(savedPosition);
		}

		if (reloadPlaybackContext) {
			requestParams.playbackContext.reloadPlaybackContext = reloadPlaybackContext;
		}

		try {
			return await makePlayerRequest({
				clientConfig,
				innertubeRequest: { context: innertube.session.context, ...requestParams }
			});
		} catch (error) {
			console.error('[Player]', 'Onesie request failed, falling back to Innertube:', error);
			return await innertube.actions.execute('/player', { ...requestParams, parse: false });
		}
	}

	async function reportWatchTimeStats(watchtimeUrl: string) {
		try {
			const innertube = await getInnertube();

			if (!playerComponents.videoElement) return;

			const relativeTime = Math.floor(Date.now() / 1000) - startTime;
			const currentTime = playerComponents.videoElement.currentTime;

			const params: Record<string, any> = {
				cpn: clientPlaybackNonce,
				rt: relativeTime,
				rti: relativeTime,
				cmt: currentTime,
				cbr: 'Chrome',
				cbrver: '115.0.0.0',
				cplayer: 'UNIPLAYER',
				cos: 'Windows',
				cosver: '11',
				cplatform: 'DESKTOP',
				hl: 'en_US',
				cr: 'US',
				et: currentTime,
				st: startTime,
				state: playerComponents.videoElement.paused ? 'paused' : 'playing',
				volume: playerComponents.videoElement.volume,
				ver: 2,
				muted: playerComponents.videoElement.muted ? 1 : 0,
				fmt: 0
			};

			if (playerComponents.videoElement.paused) {
				params.rtn = relativeTime + 20;
			} else {
				params.final = 1;
			}

			const clientInfo = {
				client_name: innertube.session.context.client.clientName,
				client_version: innertube.session.context.client.clientVersion
			};

			return innertube.actions.stats(watchtimeUrl, clientInfo, params);
		} catch (err) {
			console.error('[Player]', 'Failed to report stats', err);
		}
	}

	async function reportPlaybackStats(videostatsPlaybackUrl: string) {
		try {
			const innertube = await getInnertube();

			if (!playerComponents.videoElement) return;

			const relativeTime = Math.floor(Date.now() / 1000) - startTime;

			const params = {
				cpn: clientPlaybackNonce,
				rt: relativeTime,
				rtn: relativeTime,
				volume: playerComponents.videoElement.volume,
				muted: playerComponents.videoElement.muted ? 1 : 0,
				fmt: 0
			};

			const clientInfo = {
				client_name: innertube.session.context.client.clientName,
				client_version: innertube.session.context.client.clientVersion
			};

			return innertube.actions.stats(videostatsPlaybackUrl, clientInfo, params);
		} catch (err) {
			console.error('[Player]', 'Failed to report stats', err);
		}
	}

	async function loadManifest(apiResponse: ApiResponse) {
		const { player, sabrAdapter, videoElement } = playerComponents;
		const innertube = await getInnertube();
		if (!player || !sabrAdapter || !videoElement || !innertube) return;

		const videoInfo = new YT.VideoInfo([apiResponse], innertube.actions, clientPlaybackNonce);
		const isPostLiveDVR =
			!!videoInfo.basic_info.is_post_live_dvr ||
			(videoInfo.basic_info.is_live_content &&
				!!(
					videoInfo.streaming_data?.dash_manifest_url || videoInfo.streaming_data?.hls_manifest_url
				));
		const playbackTracking = videoInfo.page[0].playback_tracking;
		const playbackStartConfig = (apiResponse.data?.playerConfig as any)?.playbackStartConfig as
			| {
					startSeconds?: number;
			  }
			| undefined;

		isLive = !!videoInfo.basic_info.is_live;
		drmParams = (apiResponse.data.streamingData as any)?.drmParams;

		if (drmParams) {
			player.configure({ drm: { servers: { [WIDEVINE_DRM_SYSTEM]: INNERTUBE_DRM_LICENSE_URL } } });
		}

		if (videoInfo.streaming_data && !isPostLiveDVR && !isLive) {
			sabrAdapter.setStreamingURL(
				innertube.session.player!.decipher(videoInfo.streaming_data?.server_abr_streaming_url)
			);
			sabrAdapter.setServerAbrFormats(
				videoInfo.streaming_data.adaptive_formats.map(buildSabrFormat)
			);
			sabrAdapter.setUstreamerConfig(
				videoInfo.player_config?.media_common_config.media_ustreamer_request_config
					?.video_playback_ustreamer_config
			);
		}

		let manifestUri: string | undefined;
		if (videoInfo.streaming_data) {
			if (isLive) {
				manifestUri = videoInfo.streaming_data.dash_manifest_url
					? `${videoInfo.streaming_data.dash_manifest_url}/mpd_version/7`
					: videoInfo.streaming_data.hls_manifest_url;
			} else if (isPostLiveDVR) {
				manifestUri =
					videoInfo.streaming_data.hls_manifest_url ||
					`${videoInfo.streaming_data.dash_manifest_url}/mpd_version/7`;
			} else {
				manifestUri = `data:application/dash+xml;base64,${btoa(
					await videoInfo.toDash({
						manifest_options: {
							is_sabr: true,
							captions_format: 'vtt',
							include_thumbnails: false
						}
					})
				)}`;
			}
		}

		if (!manifestUri) throw new Error('Could not find a valid manifest URI.');

		try {
			// Allows YouTube to show/improve recommendations, etc.
			if (playbackTracking && ENABLE_PLAYBACK_TRACKING) {
				reportPlaybackStats(playbackTracking.videostats_playback_url).then(() => {
					reportWatchTimeStats(playbackTracking!.videostats_watchtime_url);
					playbackTrackerInterval = setInterval(
						() => reportWatchTimeStats(playbackTracking!.videostats_watchtime_url),
						30000
					) as unknown as number;
				});
			}
		} catch (err) {
			console.error('[Player]', 'Error reporting playback stats', err);
		}

		await player.load(manifestUri, isLive ? undefined : startTime);

		videoElement.play().catch((err) => {
			if (err instanceof DOMException && err.name === 'NotAllowedError') {
				console.warn('[Player]', 'Autoplay was prevented by the browser.', err);
			}
		});
	}

	async function loadVideo(videoId: string, targetContainer: HTMLElement) {
		if (!videoId) return;

		currentVideoId = videoId;
		playerState = 'loading';

		try {
			if (!playerComponents.player) {
				await initializeShakaPlayer();
			} else {
				// Reset Shaka player configuration to default ABR behavior.
				// This is necessary because the player instance is
				// reused across videos for better performance.
				playerComponents.player.configure('abr', DEFAULT_ABR_CONFIG);
			}

			const { shakaContainer } = playerComponents;
			if (shakaContainer && shakaContainer.parentElement !== targetContainer) {
				targetContainer.appendChild(shakaContainer);
			}

			const innertube = await getInnertube();
			if (!innertube) return;

			sessionPoTokenContentBinding = innertube.session.context.client.visitorData || '';

			await cleanupPreviousVideo();
			await initializeSabrAdapter();
			await setupRequestFilters();

			const videoInfo = await fetchVideoInfo(videoId);
			if (videoInfo.data.playabilityStatus?.status !== 'OK') {
				console.error(
					'[Player]',
					'Unplayable:',
					videoInfo.data.playabilityStatus?.reason || 'Unknown reason'
				);
				playerState = 'error';
				return;
			}

			await loadManifest(videoInfo);

			startSavingPosition();
			playerState = 'ready';
		} catch (error) {
			console.error(error);
			playerState = 'error';
		}
	}

	onDestroy(async () => {
		const { videoElement, shakaContainer } = playerComponents;

		if (videoElement && currentVideoId) {
			savePlaybackPosition(currentVideoId, videoElement.currentTime);
		}

		if (shakaContainer) shakaContainer.remove();

		await cleanupPreviousVideo();
	});

	return { player: playerComponents.player, ui: playerComponents.ui, playerState, loadVideo };
}
