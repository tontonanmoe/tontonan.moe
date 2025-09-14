<script lang="ts">
	import { getContext, onDestroy, onMount } from 'svelte';
	import shaka from 'shaka-player/dist/shaka-player.ui';
	import type Innertube from 'youtubei.js';
	import { SabrStreamingAdapter } from 'googlevideo/sabr-streaming-adapter';
	import { ShakaPlayerAdapter } from '$lib/streaming/ShakaPlayerAdapter';
	import { Constants, Utils, YT, type ApiResponse } from 'youtubei.js';
	import { botguardService } from '$lib/services/botguard';
	import type { ReloadPlaybackContext } from 'googlevideo/protos';
	import type { OnesieHotConfig } from '$lib/utils/helpers';
	import { makePlayerRequest } from '$lib/services/onesie';
	import { buildSabrFormat } from 'googlevideo/utils';
	import { browser } from '$app/environment';

	let { videoId, container } = $props();

	let player: shaka.Player | null = null;
	let sabrAdapter: SabrStreamingAdapter | null = null;
	let videoElement: HTMLVideoElement | null = null;
	let shakaContainer: HTMLElement | null = null;
	let customSpinner: HTMLElement | null = null;

	let playerState: 'loading' | 'ready' | 'error' | 'buffering' = 'loading';
	let sessionPoToken: string | undefined = undefined;
	let coldStartToken: string | undefined = undefined;

	let drmParams: string | undefined = undefined;
	let sessionPoTokenContentBinding: string | undefined = undefined;
	let sessionPoTokenCreationLock: boolean = false;
	let currentVideoId: string = '';

	const clientPlaybackNonce: string = Utils.generateRandomString(12);
	const sessionId: string = Array.from(Array(16), () =>
		Math.floor(Math.random() * 36).toString(36)
	).join('');

	const WIDEVINE_DRM_SYSTEM = 'com.widevine.alpha';
	const INNERTUBE_DRM_LICENSE_URL =
		'https://www.youtube.com/youtubei/v1/player/get_drm_license?prettyPrint=false&alt=json';

	const DEFAULT_ABR_CONFIG = {
		enabled: true,
		restrictions: {
			minHeight: 1080
		},
		switchInterval: 4,
		useNetworkInformation: false
	} as shaka.extern.AbrConfiguration;

	$effect(() => {
		if (customSpinner) {
			const isVisible = ['loading', 'buffering'].includes(playerState);
			customSpinner.style.display = isVisible ? 'flex' : 'none';
		}
	});

	async function initializeShakaPlayer(): Promise<void> {
		shakaContainer = document.createElement('div');
		shakaContainer.className = 'yt-player';

		videoElement = document.createElement('video');
		videoElement.autoplay = true;
		videoElement.style.width = '100%';
		videoElement.style.height = '100%';
		shakaContainer.appendChild(videoElement);

		const loadingOverlay = document.createElement('div');
		loadingOverlay.className = 'loading-overlay';

		const spinner = document.createElement('div');
		spinner.className = 'spinner';
		loadingOverlay.appendChild(spinner);
		shakaContainer.appendChild(loadingOverlay);
		customSpinner = loadingOverlay;

		player = new shaka.Player();

		player?.configure({
			preferredAudioLanguage: 'en-US',
			abr: DEFAULT_ABR_CONFIG,
			streaming: {
				failureCallback: (error: shaka.util.Error) => {
					console.error('Streaming failure:', error);
					playerState = 'error';
					player?.retryStreaming(5);
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

		videoElement.addEventListener('playing', () =>
			player?.configure('abr.restrictions.maxHeight', Infinity)
		);

		interface ShakaBufferingEvent extends Event {
			buffering: boolean;
		}

		player?.addEventListener('buffering', (event: Event) => {
			const bufferingEvent = event as ShakaBufferingEvent;
			playerState = player?.isBuffering() || bufferingEvent.buffering ? 'buffering' : 'ready';
		});

		await player?.attach(videoElement);
	}

	const getInnertube = getContext<() => Promise<Innertube>>('innertube');
	const getClientConfig = getContext<() => Promise<OnesieHotConfig>>('onesieHotConfig');

	async function cleanupPreviousVideo(): Promise<void> {
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
			sabrAdapter = null;
		}

		drmParams = undefined;
	}

	async function mintSessionPoToken(): Promise<void> {
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
		} catch (error) {
			console.error('[Player]', 'Error minting session PO token', error);
		} finally {
			sessionPoTokenCreationLock = false;
		}
	}

	async function fetchVideoInfo(
		videoId: string,
		reloadPlaybackContext?: ReloadPlaybackContext
	): Promise<ApiResponse | undefined> {
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

	async function initializeSabrAdapter(): Promise<void> {
		const innertube = await getInnertube();
		if (!player || !innertube) return;

		sabrAdapter = new SabrStreamingAdapter({
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
				mintSessionPoToken().then();
			}

			return sessionPoToken || coldStartToken || '';
		});

		sabrAdapter.onReloadPlayerResponse(async (reloadPlaybackContext: ReloadPlaybackContext) => {
			const apiResponse = await fetchVideoInfo(currentVideoId, reloadPlaybackContext);

			if (!apiResponse) {
				console.error('[Player]', 'Failed to reload player response');
				return;
			}

			const videoInfo = new YT.VideoInfo([apiResponse], innertube.actions, clientPlaybackNonce);
			sabrAdapter?.setStreamingURL(
				innertube.session.player!.decipher(videoInfo.streaming_data?.server_abr_streaming_url)
			);
			sabrAdapter?.setUstreamerConfig(
				videoInfo.player_config?.media_common_config.media_ustreamer_request_config
					?.video_playback_ustreamer_config
			);
		});

		sabrAdapter.attach(player);
	}

	async function setupRequestFilters(): Promise<void> {
		const networkingEngine = player?.getNetworkingEngine();
		if (!networkingEngine) return;

		networkingEngine.registerRequestFilter(
			async (type: shaka.net.NetworkingEngine.RequestType, request: shaka.extern.Request) => {
				let url = new URL(request.uris[0]);

				if (url.host.endsWith('.googlevideo.com') || url.href.includes('drm')) {
					const newUrl = new URL('/api/proxy', window.location.origin);
					newUrl.pathname = `/api/proxy${url.pathname}`;
					newUrl.searchParams.set('__host', url.host);
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
						licenseRequest: shaka.util.Uint8ArrayUtils.toBase64(request.body as ArrayBuffer),
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
						(await botguardService.integrityTokenBasedMinter?.mintAsWebsafeString(
							currentVideoId
						)) || ''
					);
					url.search = params.toString();
				}

				request.uris[0] = url.toString();
			}
		);

		networkingEngine.registerResponseFilter(
			async (type: shaka.net.NetworkingEngine.RequestType, response: shaka.extern.Response) => {
				if (type === shaka.net.NetworkingEngine.RequestType.LICENSE) {
					const wrapped = JSON.parse(shaka.util.StringUtils.fromUTF8(response.data as ArrayBuffer));
					response.data = shaka.util.Uint8ArrayUtils.fromBase64(wrapped.license);
				}
			}
		);
	}

	async function loadManifest(apiResponse: ApiResponse): Promise<void> {
		const innertube = await getInnertube();
		if (!player || !sabrAdapter || !videoElement || !innertube) return;

		const videoInfo = new YT.VideoInfo([apiResponse], innertube.actions, clientPlaybackNonce);
		const isPostLiveDVR =
			!!videoInfo.basic_info.is_post_live_dvr ||
			(videoInfo.basic_info.is_live_content &&
				!!(
					videoInfo.streaming_data?.dash_manifest_url || videoInfo.streaming_data?.hls_manifest_url
				));

		drmParams = (apiResponse.data.streamingData as any)?.drmParams;

		if (drmParams) {
			player.configure({ drm: { servers: { [WIDEVINE_DRM_SYSTEM]: INNERTUBE_DRM_LICENSE_URL } } });
		}

		if (videoInfo.streaming_data && !isPostLiveDVR) {
			sabrAdapter.setServerAbrFormats(
				videoInfo.streaming_data.adaptive_formats.map(buildSabrFormat)
			);
		}

		sabrAdapter.setStreamingURL(
			innertube.session.player!.decipher(videoInfo.streaming_data?.server_abr_streaming_url)
		);
		sabrAdapter.setUstreamerConfig(
			videoInfo.player_config?.media_common_config.media_ustreamer_request_config
				?.video_playback_ustreamer_config
		);

		let manifestUri: string | undefined;
		if (videoInfo.streaming_data) {
			if (isPostLiveDVR) {
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

		// Handle start time from URL query parameter
		const startTime = 0;

		await player.load(manifestUri, startTime);

		videoElement.play().catch((err) => {
			if (err instanceof DOMException && err.name === 'NotAllowedError') {
				console.warn('[Player]', 'Autoplay was prevented by the browser.', err);
			}
		});
	}

	async function loadVideo(videoId: string): Promise<void> {
		if (!videoId) return;

		currentVideoId = videoId;
		playerState = 'loading';

		try {
			if (!player) {
				await initializeShakaPlayer();
			} else {
				player.configure('abr', DEFAULT_ABR_CONFIG);
			}

			if (shakaContainer && container && shakaContainer.parentElement !== container) {
				container.appendChild(shakaContainer);
			}

			const innertube = await getInnertube();
			if (!innertube) return;

			sessionPoTokenContentBinding = innertube.session.context.client.visitorData || '';

			await cleanupPreviousVideo();
			await initializeSabrAdapter();
			await setupRequestFilters();

			const videoInfo = await fetchVideoInfo(videoId);

			if (!videoInfo || videoInfo.data.playabilityStatus?.status !== 'OK') {
				console.error(
					'[Player]',
					'Unplayable:',
					videoInfo?.data.playabilityStatus?.reason || 'Unknown reason'
				);
				playerState = 'error';
				return;
			}

			await loadManifest(videoInfo);
			playerState = 'ready';
		} catch (error) {
			console.error(error);
			playerState = 'error';
		}
	}

	onMount(() => {
		if (videoId && browser) {
			loadVideo(videoId);
		}
	});

	$effect.pre(() => {
		if (videoId && videoId !== currentVideoId) {
			loadVideo(videoId);
		}
	});

	onDestroy(() => {
		if (shakaContainer) shakaContainer.remove();

		cleanupPreviousVideo();
	});
</script>
