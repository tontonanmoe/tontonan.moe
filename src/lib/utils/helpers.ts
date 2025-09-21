import shaka from 'shaka-player/dist/shaka-player.ui';

export interface OnesieHotConfig {
	clientKeyData: Uint8Array;
	encryptedClientKey: Uint8Array;
	onesieUstreamerConfig: Uint8Array;
	baseUrl: string;
	keyExpiresInSeconds: number;
	timestamp?: number;
}

export interface EncryptedRequest {
	encrypted: Uint8Array;
	hmac: Uint8Array;
	iv: Uint8Array;
}

export const REDIRECTOR_STORAGE_KEY = 'googlevideo_redirector';
export const CLIENT_CONFIG_STORAGE_KEY = 'yt_client_config';

export function isFirstTime() {
	try {
		return indexedDB.databases().then((dbs) => !dbs.some((db) => db.name === 'youtubei.js'));
	} catch (error) {
		console.error('[App]', 'Failed to check IndexedDB databases', error);
		return true;
	}
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
			data as any
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

export function isConfigValid(config: OnesieHotConfig): boolean {
	if (!config.timestamp || !config.keyExpiresInSeconds) {
		return false;
	}

	const currentTime = Date.now();
	const expirationTime = config.timestamp + config.keyExpiresInSeconds * 1000;
	return currentTime < expirationTime;
}

export function loadCachedClientConfig(): OnesieHotConfig | null {
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
		// Since Edge incorrectly returns the header with a leading new line
		// character ('\n'), we trim the header here.
		headersObj[key.trim()] = value;
	});
	return headersObj;
}

export function makeResponse(
	headers: Record<string, string>,
	data: BufferSource,
	status: number,
	uri: string,
	responseURL: string,
	request: shaka.extern.Request,
	requestType: shaka.net.NetworkingEngine.RequestType
): shaka.extern.Response & { originalRequest: shaka.extern.Request } {
	if (status >= 200 && status <= 299 && status !== 202) {
		return {
			uri: responseURL || uri,
			originalUri: uri,
			data,
			status,
			headers,
			originalRequest: request,
			fromCache: !!headers['x-shaka-from-cache']
		};
	}

	let responseText: string | null = null;
	try {
		responseText = shaka.util.StringUtils.fromBytesAutoDetect(data);
	} catch {
		/* no-op */
	}

	const severity =
		status === 401 || status === 403
			? shaka.util.Error.Severity.CRITICAL
			: shaka.util.Error.Severity.RECOVERABLE;

	throw new shaka.util.Error(
		severity,
		shaka.util.Error.Category.NETWORK,
		shaka.util.Error.Code.BAD_HTTP_STATUS,
		uri,
		status,
		responseText,
		headers,
		requestType,
		responseURL || uri
	);
}

export function createRecoverableError(message: string, info?: Record<string, any>) {
	return new shaka.util.Error(
		shaka.util.Error.Severity.RECOVERABLE,
		shaka.util.Error.Category.NETWORK,
		shaka.util.Error.Code.HTTP_ERROR,
		message,
		{ info }
	);
}

export async function fetchFunction(
	input: string | Request | URL,
	init?: RequestInit
): Promise<Response> {
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

	url.searchParams.set('__headers', JSON.stringify([...headers]));
	url.searchParams.set('__host', url.host);
	url.host = window.location.host;
	// url.port = window.location.port;
	url.port = '8080';
	url.protocol = window.location.protocol;
	// url.pathname = '/api/proxy' + url.pathname;

	const request = new Request(url, input instanceof Request ? input : undefined);
	headers.delete('user-agent');

	return fetch(request, requestInit);
}
