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

export async function GET({ request, url: requestUrl, params }): Promise<Response> {
	return handleRequest(request, requestUrl, params);
}

export async function POST({ request, url: requestUrl, params }): Promise<Response> {
	return handleRequest(request, requestUrl, params);
}

export async function OPTIONS({ request }): Promise<Response> {
	const origin = request.headers.get('origin') || '';
	return new Response('', {
		status: 200,
		headers: {
			'Access-Control-Allow-Origin': origin,
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': ALLOWED_HEADERS,
			'Access-Control-Max-Age': '86400',
			'Access-Control-Allow-Credentials': 'true'
		}
	});
}

async function handleRequest(request: Request, requestUrl: URL, params: any): Promise<Response> {
	const origin = request.headers.get('origin') || '';

	if (!requestUrl.searchParams.has('__host')) {
		return new Response(
			'Request is formatted incorrectly. Please include __host in the query string.',
			{ status: 400 }
		);
	}

	const targetHost = requestUrl.searchParams.get('__host')!;
	const targetPath = params.path || '';
	const targetUrl = new URL(`https://${targetHost}/${targetPath}`);

	requestUrl.searchParams.forEach((value, key) => {
		if (key !== '__host' && key !== '__headers') {
			targetUrl.searchParams.set(key, value);
		}
	});

	const requestHeaders = new Headers(JSON.parse(requestUrl.searchParams.get('__headers') || '{}'));
	copyHeader('range', requestHeaders, request.headers);

	if (!requestHeaders.has('user-agent')) {
		copyHeader('user-agent', requestHeaders, request.headers);
	}

	if (targetUrl.host.includes('youtube')) {
		requestHeaders.set('origin', 'https://www.youtube.com');
		requestHeaders.set('referer', 'https://www.youtube.com/');
	}

	if (request.headers.has('Authorization')) {
		requestHeaders.set('Authorization', request.headers.get('Authorization')!);
	}

	const fetchOptions: any = {
		method: request.method,
		headers: requestHeaders,
		redirect: 'manual'
	};

	const methodsWithBody = ['POST', 'PUT', 'PATCH', 'DELETE'];
	if (methodsWithBody.includes(request.method)) {
		fetchOptions.body = request.body;
		fetchOptions.duplex = 'half';
	}

	const fetchRes = await fetch(targetUrl.toString(), fetchOptions);

	const headers = new Headers();

	copyHeader('content-type', headers, fetchRes.headers);
	copyHeader('content-disposition', headers, fetchRes.headers);
	copyHeader('accept-ranges', headers, fetchRes.headers);
	copyHeader('content-range', headers, fetchRes.headers);

	headers.set('Access-Control-Allow-Origin', origin);
	headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS);
	headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
	headers.set('Access-Control-Allow-Credentials', 'true');

	return new Response(fetchRes.body, {
		status: fetchRes.status,
		headers
	});
}
