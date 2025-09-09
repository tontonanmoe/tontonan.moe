// src/routes/api/yt-proxy/[...path]/+server.ts

// ✅ PERBAIKAN UTAMA: Impor dari './$types' lokal, bukan '@sveltejs/kit' generik.
// Ini memberikan tipe yang "sadar" akan rute saat ini.
import type { RequestHandler } from './$types';

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
	'x-goog-authuser',
	'Accept-Language',
	'Range',
	'Referer'
];

function copyHeader(headerName: string, to: Headers, from: Headers) {
	const value = from.get(headerName);
	if (value) to.set(headerName, value);
}

// Tipe `RequestHandler` dari `./$types` sekarang tahu bahwa `params` memiliki properti `path`.
const handler: RequestHandler = async ({ request, params }) => {
	const origin = request.headers.get('origin') || new URL(request.url).origin;

	if (request.method === 'OPTIONS') {
		return new Response(null, {
			status: 204,
			headers: {
				'Access-Control-Allow-Origin': origin,
				'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
				'Access-Control-Allow-Headers': ALLOWED_HEADERS.join(', '),
				'Access-Control-Max-Age': '86400',
				'Access-Control-Allow-Credentials': 'true'
			}
		});
	}

	const requestUrl = new URL(request.url);
	const targetHost = requestUrl.searchParams.get('__host');
	if (!targetHost) {
		return new Response('Parameter __host tidak ditemukan', { status: 400 });
	}

	// ✅ Kode ini sekarang sepenuhnya type-safe. TypeScript tahu `params.path` itu ada.
	const targetUrl = new URL(`https://${targetHost}/${params.path}`);
	targetUrl.search = requestUrl.search;
	targetUrl.searchParams.delete('__host');

	const headers = new Headers();
	ALLOWED_HEADERS.forEach((header) => copyHeader(header, headers, request.headers));
	headers.set('origin', 'https://www.youtube.com');
	headers.set('referer', 'https://www.youtube.com/');

	const response = await fetch(targetUrl.toString(), {
		method: request.method,
		headers: headers,
		body: request.body
	});

	const responseHeaders = new Headers({
		'Access-Control-Allow-Origin': origin,
		'Access-Control-Allow-Credentials': 'true'
	});

	copyHeader('content-length', responseHeaders, response.headers);
	copyHeader('content-type', responseHeaders, response.headers);
	copyHeader('accept-ranges', responseHeaders, response.headers);
	copyHeader('content-range', responseHeaders, response.headers);

	return new Response(response.body, {
		status: response.status,
		headers: responseHeaders
	});
};

export const GET = handler;
export const POST = handler;
export const OPTIONS = handler;
