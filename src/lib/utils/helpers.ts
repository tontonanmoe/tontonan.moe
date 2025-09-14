export const isFirstTime = async (): Promise<boolean> => {
	if (typeof window === 'undefined') return true;

	try {
		// @ts-ignore
		if (indexedDB.databases) {
			const dbs = await indexedDB.databases();
			return !dbs.some((db) => db.name === 'youtubei.js');
		}
		return true;
	} catch (error) {
		console.error(error);
		return true;
	}
};

export const fetchFunction = async (
	input: string | Request | URL,
	init?: RequestInit
): Promise<Response> => {
	if (typeof window === 'undefined') return fetch(input, init);

	const url = input instanceof URL ? input : new URL(typeof input === 'string' ? input : input.url);
	const headers = new Headers(
		init?.headers ?? (input instanceof Request ? input.headers : undefined)
	);
	const requestInit = { ...init, headers };

	if (url.pathname.includes('v1/player')) {
		url.searchParams.set(
			'$fields',
			'playerConfig,storyboards,captions,playabilityStatus,streamingData,responseContext.mainAppWebResponseContext.datasyncId,videoDetails.isLive,videoDetails.isLiveContent,videoDetails.title,videoDetails.author,videoDetails.thumbnail'
		);
	}

	const proxyUrl = new URL('/api/proxy', window.location.origin);

	proxyUrl.pathname = `/api/proxy${url.pathname}`;

	proxyUrl.searchParams.set('__host', url.host);
	proxyUrl.searchParams.set('__headers', JSON.stringify([...headers]));

	url.searchParams.forEach((value, key) => {
		proxyUrl.searchParams.set(key, value);
	});

	const proxyRequest = new Request(proxyUrl.toString(), {
		method: requestInit.method || 'GET',
		headers: requestInit.headers,
		body: requestInit.body
	});

	return fetch(proxyRequest);
};

export const REDIRECTOR_STORAGE_KEY = 'googlevideo_redirector';

export interface OnesieHotConfig {
	clientKeyData: Uint8Array;
	encryptedClientKey: Uint8Array;
	onesieUstreamerConfig: Uint8Array;
	baseUrl: string;
	keyExpiresInSeconds: number;
	timestamp?: number;
}

export const CLIENT_CONFIG_STORAGE_KEY = 'yt_client_config';

export function isConfigValid(config: OnesieHotConfig): boolean {
	if (!config.timestamp || !config.keyExpiresInSeconds) {
		return false;
	}

	const currentTime = Date.now();
	const expirationTime = config.timestamp + config.keyExpiresInSeconds * 1000;
	return currentTime < expirationTime;
}

export function loadCachedClientConfig(): OnesieHotConfig | null {
	if (typeof window === 'undefined') return null;

	try {
		const cachedData = localStorage.getItem(CLIENT_CONFIG_STORAGE_KEY);
		if (!cachedData) return null;

		const parsed = JSON.parse(cachedData);

		if (!isConfigValid(parsed)) {
			localStorage.removeItem(CLIENT_CONFIG_STORAGE_KEY);
			return null;
		}

		return {
			...parsed,
			clientKeyData: new Uint8Array(Object.values(parsed.clientKeyData)),
			encryptedClientKey: new Uint8Array(Object.values(parsed.encryptedClientKey)),
			onesieUstreamerConfig: new Uint8Array(Object.values(parsed.onesieUstreamerConfig))
		};
	} catch (error) {
		console.error('[App]', 'Failed to load cached client config', error);
		localStorage.removeItem(CLIENT_CONFIG_STORAGE_KEY);
		return null;
	}
}

export function asMap<K, V>(object: Record<string, V>): Map<K, V> {
	const map = new Map<K, V>();
	for (const key of Object.keys(object)) {
		map.set(key as K, object[key]);
	}
	return map;
}

export function headersToGenericObject(headers: Headers): Record<string, string> {
	const headersObj: Record<string, string> = {};
	headers.forEach((value, key) => {
		headersObj[key.trim()] = value;
	});
	return headersObj;
}

export interface EncryptedRequest {
	encrypted: Uint8Array;
	hmac: Uint8Array;
	iv: Uint8Array;
}

export async function encryptRequest(
	clientKey: Uint8Array,
	data: Uint8Array
): Promise<EncryptedRequest> {
	if (clientKey.length !== 32) throw new Error('Invalid client key length');

	const aesKeyData = clientKey.slice(0, 16);
	const hmacKeyData = clientKey.slice(16, 32);

	const iv = window.crypto.getRandomValues(new Uint8Array(16));

	const aesKey = await window.crypto.subtle.importKey(
		'raw',
		aesKeyData,
		{ name: 'AES-CTR', length: 128 },
		false,
		['encrypt']
	);

	const encrypted = new Uint8Array(
		await window.crypto.subtle.encrypt(
			{ name: 'AES-CTR', counter: iv, length: 128 },
			aesKey,
			data.slice()
		)
	);

	const hmacKey = await window.crypto.subtle.importKey(
		'raw',
		hmacKeyData,
		{ name: 'HMAC', hash: { name: 'SHA-256' } },
		false,
		['sign']
	);

	const hmac = new Uint8Array(
		await window.crypto.subtle.sign('HMAC', hmacKey, new Uint8Array([...encrypted, ...iv]))
	);

	return { encrypted, hmac, iv };
}
