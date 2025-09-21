<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import * as m from '$lib/paraglide/messages';
	import { setContext } from 'svelte';
	import { base64ToU8 } from 'googlevideo/utils';

	import type { Innertube } from 'youtubei.js/web';

	import type {
		CLIENT_CONFIG_STORAGE_KEY,
		OnesieHotConfig,
		isConfigValid,
		loadCachedClientConfig
	} from '$lib/utils/helpers';
	import { browser } from '$app/environment';

	$: user = page.data.user;

	let innertubePromise: Promise<Innertube | undefined> | undefined;
	let clientConfigPromise: Promise<OnesieHotConfig | undefined> | undefined;
	let innertubeInstance: Innertube | undefined = undefined;
	let clientConfigObject: OnesieHotConfig | undefined = undefined;

	async function initInnertube() {
		const { isFirstTime, fetchFunction, REDIRECTOR_STORAGE_KEY } = await import(
			'$lib/utils/helpers'
		);
		const { Innertube, UniversalCache } = await import('youtubei.js/web');
		const { botguardService } = await import('$lib/services/botguard');
		const firstTime = await isFirstTime();

		try {
			console.info('[App]', `Initializing InnerTube API [firstTime=${firstTime}]`);

			const instance = await Innertube.create({
				cache: new UniversalCache(true),
				fetch: fetchFunction
			});

			botguardService.init().then((bgClient) => {
				console.info('[App]', 'BotGuard client initialized');
				Object.assign(window, { botguardService, bgClient }); // For testing and stuff.
			});

			// Preload the redirector URL to avoid extra delays later...
			const redirectorResponse = await fetchFunction(
				`https://redirector.googlevideo.com/initplayback?source=youtube&itag=0&pvi=0&pai=0&owc=yes&cmo:sensitive_content=yes&alr=yes&id=${Math.round(Math.random() * 1e5)}`,
				{ method: 'GET' }
			);
			const redirectorResponseUrl = await redirectorResponse.text();

			if (redirectorResponseUrl.startsWith('https://')) {
				localStorage.setItem(REDIRECTOR_STORAGE_KEY, redirectorResponseUrl);
			}

			innertubeInstance = instance;
			return instance;
		} catch (error) {
			console.error('[App]', 'Failed to initialize Innertube', error);
			innertubePromise = undefined;

			// YouTube.js will fall back to local session generation if this is the first
			// time the app is loaded, and the request to /sw.js_data fails for some reason.
			// Since local sessions may cause playback issues, delete the IndexedDB database
			// to force it to regenerate.
			// @TODO: Add a setting in YouTube.js to disable this crap (local session fallback).
			if (firstTime) {
				const request = indexedDB.deleteDatabase('youtubei.js');
				request.onsuccess = () => console.info('[App]', 'Deleted bad session cache.');
			}

			return undefined;
		}
	}

	async function fetchOnesieHotConfig(): Promise<OnesieHotConfig | undefined> {
		const { loadCachedClientConfig, fetchFunction, CLIENT_CONFIG_STORAGE_KEY } = await import(
			'$lib/utils/helpers'
		);
		const cachedConfig = loadCachedClientConfig();
		if (cachedConfig) {
			clientConfigObject = cachedConfig;
			return cachedConfig;
		}

		try {
			const tvConfigResponse = await fetchFunction(
				'https://www.youtube.com/tv_config?action_get_config=true&client=lb4&theme=cl',
				{
					method: 'GET',
					headers: {
						'User-Agent': 'Mozilla/5.0 (ChromiumStylePlatform) Cobalt/Version'
					}
				}
			);

			const tvConfigJson = JSON.parse((await tvConfigResponse.text()).slice(4));
			const webPlayerContextConfig =
				tvConfigJson.webPlayerContextConfig.WEB_PLAYER_CONTEXT_CONFIG_ID_LIVING_ROOM_WATCH;
			const onesieHotConfig = webPlayerContextConfig.onesieHotConfig;

			const config = {
				clientKeyData: base64ToU8(onesieHotConfig.clientKey),
				keyExpiresInSeconds: onesieHotConfig.keyExpiresInSeconds,
				encryptedClientKey: base64ToU8(onesieHotConfig.encryptedClientKey),
				onesieUstreamerConfig: base64ToU8(onesieHotConfig.onesieUstreamerConfig),
				baseUrl: onesieHotConfig.baseUrl,
				timestamp: Date.now()
			};

			localStorage.setItem(CLIENT_CONFIG_STORAGE_KEY, JSON.stringify(config));

			clientConfigObject = config;
			return config;
		} catch (error) {
			console.error('[App]', 'Failed to fetch Onesie client config', error);
			clientConfigPromise = undefined;
			return undefined;
		}
	}

	async function getInnertube() {
		if (innertubeInstance) return innertubeInstance;
		if (!innertubePromise) innertubePromise = initInnertube();
		return innertubePromise;
	}

	async function getClientConfig() {
		const { isConfigValid, CLIENT_CONFIG_STORAGE_KEY } = await import('$lib/utils/helpers');
		if (clientConfigObject) {
			if (!isConfigValid(clientConfigObject)) {
				clientConfigPromise = undefined;
				clientConfigObject = undefined;
				localStorage.removeItem(CLIENT_CONFIG_STORAGE_KEY);
				return fetchOnesieHotConfig();
			}
			return clientConfigObject;
		}

		if (!clientConfigPromise) clientConfigPromise = fetchOnesieHotConfig();
		return clientConfigPromise;
	}

	if (browser) {
		setContext('innertube', getInnertube);
		setContext('onesieHotConfig', getClientConfig);
		// innertubePromise = initInnertube();
		// clientConfigPromise = fetchOnesieHotConfig();
	}
</script>

<div class="min-h-screen bg-transparent text-slate-50 antialiased">
	<header
		class="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-lg dark:border-slate-800 dark:bg-slate-900/80"
	>
		<nav class="container mx-auto flex h-16 items-center justify-between px-4">
			<a href="/" class="text-xl font-bold tracking-tight">
				tontonan<span class="text-indigo-500">.moe</span>
			</a>
			<div class="flex items-center gap-x-4">
				{#if user}
					<a
						href="/dashboard"
						class="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
					>
						{m.button_go_to_dashboard()}
					</a>
				{:else}
					<a href="/login" class="text-sm font-semibold hover:text-indigo-500">
						{m.button_login()}
					</a>
					<a
						href="/register"
						class="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
					>
						{m.button_register()}
					</a>
				{/if}
			</div>
		</nav>
	</header>

	<main>
		<slot />
	</main>

	<footer class="border-t border-slate-200 dark:border-slate-800">
		<div class="container mx-auto px-4 py-8 text-center text-sm text-slate-500">
			<p>&copy; {new Date().getFullYear()} tontonan.moe - Dibuat dengan ❤️ untuk komunitas.</p>
		</div>
	</footer>
</div>
