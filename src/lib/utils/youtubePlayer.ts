// src/lib/utils/youtubePlayer.ts
import { browser } from '$app/environment';
import { Innertube, UniversalCache, ClientType } from 'youtubei.js';

let youtube: Innertube | undefined;

/**
 * Helper fetch yang secara otomatis membangun ulang URL untuk diarahkan ke proxy catch-all kita.
 */
async function proxyFetch(input: Request | URL | string, init?: RequestInit) {
	const originalUrl = new URL(
		typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
	);

	const baseUrl = import.meta.env.VITE_BASE_URL || 'http://localhost:5173';

	// ✅ PERBAIKAN UTAMA DI SINI: Membangun URL baru dari awal.
	// Kita gabungkan base URL kita, path ke proxy, dan path asli dari permintaan.
	const proxyUrl = new URL(`/api/yt-proxy${originalUrl.pathname}`, baseUrl);

	// Salin semua parameter query asli
	proxyUrl.search = originalUrl.search;
	// Tambahkan parameter __host yang dibutuhkan oleh proxy kita
	proxyUrl.searchParams.set('__host', originalUrl.host);

	// `youtubei.js` mungkin mengirim objek Request, jadi kita salin
	const request = new Request(proxyUrl, input instanceof Request ? input : undefined);

	return fetch(request, init);
}

async function getClient() {
	if (!browser) {
		throw new Error('youtubePlayer hanya bisa digunakan di lingkungan browser.');
	}
	if (youtube) return youtube;

	console.log('[YouTube Player] Menginisialisasi sesi Innertube baru di browser...');
	youtube = await Innertube.create({
		client_type: ClientType.WEB,
		fetch: proxyFetch,
		cache: new UniversalCache(false)
	});
	console.log('[YouTube Player] Sesi berhasil dibuat.');
	return youtube;
}

const urlCache = new Map<string, string>();

export async function getVideoUrl(videoId: string): Promise<string | null> {
	if (!browser) return null;

	if (urlCache.has(videoId)) {
		return urlCache.get(videoId)!;
	}
	try {
		const client = await getClient();
		const info = await client.getBasicInfo(videoId);

		if (!info.streaming_data) {
			const reason = info.playability_status?.reason ?? 'Alasan tidak diketahui';
			console.warn(`[YouTube Player] Tidak ada data streaming untuk ${videoId}. Pesan: ${reason}`);
			return null;
		}

		const format =
			info.streaming_data?.formats.find((f) => f.quality_label?.includes('720p')) ||
			info.streaming_data?.formats[0];
		const streamingUrl = format?.url;

		if (streamingUrl) {
			urlCache.set(videoId, streamingUrl);
			// Kita tidak perlu mem-proxy URL video, karena tag <video> bisa menanganinya
			// dengan atribut crossorigin="anonymous"
			return streamingUrl;
		}
		return null;
	} catch (error: any) {
		console.error(`[YouTube Player] Error saat mengambil info untuk ${videoId}:`, error.message);
		return null;
	}
}
