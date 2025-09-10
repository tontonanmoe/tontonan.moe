const ALLOWED_HEADERS = [
	'Origin',
	'X-Requested-With',
	'Content-Type',
	'Accept',
	'Authorization',
	'x-goog-visitor-id',
	'x-goog-api-key',
	'x-origin',
	'x-youtube-client-version',
	'x-youtube-client-name',
	'x-goog-api-format-version',
	'x-goog-authuser',
	'x-user-agent',
	'Accept-Language',
	'X-Goog-FieldMask',
	'Range',
	'Referer',
	'Cookie'
].join(', ');

function copyHeader(headerName: string, to: Headers, from: Headers) {
	const hdrVal = from.get(headerName);
	if (hdrVal) {
		to.set(headerName, hdrVal);
	}
}

export async function GET({ url, request, params }) {
	const origin = request.headers.get('origin') || '*';

	if (request.method === 'OPTIONS') {
		return new Response('', {
			status: 200,
			headers: new Headers({
				'Access-Control-Allow-Origin': origin,
				'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
				'Access-Control-Allow-Headers': ALLOWED_HEADERS,
				'Access-Control-Max-Age': '86400',
				'Access-Control-Allow-Credentials': 'true'
			})
		});
	}

	const targetHost = url.searchParams.get('__host');
	const headersParam = url.searchParams.get('__headers');

	if (!targetHost) {
		return new Response(
			'Request is formatted incorrectly. Please include __host in the query string.',
			{ status: 400 }
		);
	}

	const targetPath = params.path || '';
	const targetUrl = new URL(`https://${targetHost}/${targetPath}`);

	url.searchParams.forEach((value, key) => {
		if (!['__host', '__headers'].includes(key)) {
			targetUrl.searchParams.set(key, value);
		}
	});

	const requestHeaders = new Headers();
	if (headersParam) {
		try {
			const headersArray = JSON.parse(headersParam);
			headersArray.forEach(([key, value]: [string, string]) => {
				if (value) requestHeaders.set(key, value);
			});
		} catch (e) {
			console.error('Failed to parse headers:', e);
		}
	}

	copyHeader('range', requestHeaders, request.headers);

	if (targetHost.includes('youtube')) {
		requestHeaders.set('origin', 'https://www.youtube.com');
		requestHeaders.set('referer', 'https://www.youtube.com/');
	}

	if (request.headers.has('Authorization')) {
		requestHeaders.set('Authorization', request.headers.get('Authorization')!);
	}

	try {
		const fetchRes = await fetch(targetUrl.toString(), {
			method: 'GET',
			headers: requestHeaders
		});

		const responseHeaders = new Headers();

		copyHeader('content-length', responseHeaders, fetchRes.headers);
		copyHeader('content-type', responseHeaders, fetchRes.headers);
		copyHeader('content-disposition', responseHeaders, fetchRes.headers);
		copyHeader('accept-ranges', responseHeaders, fetchRes.headers);
		copyHeader('content-range', responseHeaders, fetchRes.headers);

		responseHeaders.set('Access-Control-Allow-Origin', origin);
		responseHeaders.set('Access-Control-Allow-Headers', ALLOWED_HEADERS);
		responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
		responseHeaders.set('Access-Control-Allow-Credentials', 'true');

		return new Response(fetchRes.body, {
			status: fetchRes.status,
			headers: responseHeaders
		});
	} catch (error) {
		console.error('Proxy error:', error);
		return new Response('Proxy error', { status: 500 });
	}
}

export async function POST({ url, request, params }) {
	const origin = request.headers.get('origin') || '*';

	const targetHost = url.searchParams.get('__host');
	const headersParam = url.searchParams.get('__headers');

	if (!targetHost) {
		return new Response(
			'Request is formatted incorrectly. Please include __host in the query string.',
			{ status: 400 }
		);
	}

	const targetPath = params.path || '';
	const targetUrl = new URL(`https://${targetHost}/${targetPath}`);

	url.searchParams.forEach((value, key) => {
		if (!['__host', '__headers'].includes(key)) {
			targetUrl.searchParams.set(key, value);
		}
	});

	const requestHeaders = new Headers();
	if (headersParam) {
		try {
			const headersArray = JSON.parse(headersParam);
			headersArray.forEach(([key, value]: [string, string]) => {
				if (value) requestHeaders.set(key, value);
			});
		} catch (e) {
			console.error('Failed to parse headers:', e);
		}
	}

	if (targetHost.includes('youtube')) {
		requestHeaders.set('origin', 'https://www.youtube.com');
		requestHeaders.set('referer', 'https://www.youtube.com/');
	}

	if (request.headers.has('Authorization')) {
		requestHeaders.set('Authorization', request.headers.get('Authorization')!);
	}

	try {
		const body = await request.text();

		const fetchRes = await fetch(targetUrl.toString(), {
			method: 'POST',
			headers: requestHeaders,
			body: body
		});

		const responseHeaders = new Headers();

		copyHeader('content-length', responseHeaders, fetchRes.headers);
		copyHeader('content-type', responseHeaders, fetchRes.headers);
		copyHeader('content-disposition', responseHeaders, fetchRes.headers);
		copyHeader('accept-ranges', responseHeaders, fetchRes.headers);
		copyHeader('content-range', responseHeaders, fetchRes.headers);

		responseHeaders.set('Access-Control-Allow-Origin', origin);
		responseHeaders.set('Access-Control-Allow-Headers', ALLOWED_HEADERS);
		responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
		responseHeaders.set('Access-Control-Allow-Credentials', 'true');

		return new Response(fetchRes.body, {
			status: fetchRes.status,
			headers: responseHeaders
		});
	} catch (error) {
		console.error('Proxy error:', error);
		return new Response('Proxy error', { status: 500 });
	}
}

export async function fallback({ request }) {
	return new Response(`Method ${request.method} not allowed`, {
		status: 405,
		headers: {
			Allow: 'GET, POST, OPTIONS'
		}
	});
}
