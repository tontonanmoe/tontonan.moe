import { db } from '$lib/server/db';
import { animeIndexTable, animeCacheTable } from '$lib/server/db/schema';
import { inArray } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { fetchHomepageDataFromApi, batchEnrichAnimeData } from '$lib/server/sync';
import type { EnrichedAnime } from '$lib/server/db/schema';

function notNull<T>(value: T | null | undefined): value is T {
	return value !== null && value !== undefined;
}

function getCurrentSeason() {
	const now = new Date();
	const year = now.getFullYear();
	const month = now.getMonth();
	let name: 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL';

	if (month <= 2) name = 'WINTER';
	else if (month <= 5) name = 'SPRING';
	else if (month <= 8) name = 'SUMMER';
	else name = 'FALL';

	return { name, year };
}

export const load: PageServerLoad = async () => {
	const currentSeason = getCurrentSeason();
	const { trending, trendingWithStatus, popularMovie } = await fetchHomepageDataFromApi();

	const processTrendingResults = async (trendingResult: { id: number }[]) => {
		const trendingIds = trendingResult.map((t) => t.id);
		if (trendingIds.length === 0) return [];
		const animeFromIndex = await db
			.select()
			.from(animeIndexTable)
			.where(inArray(animeIndexTable.anilistId, trendingIds));
		const existingCache = await db
			.select({
				anilistId: animeCacheTable.anilistId,
				coverImage: animeCacheTable.coverImage,
				bannerUrl: animeCacheTable.bannerUrl,
				trailerId: animeCacheTable.trailerId
			})
			.from(animeCacheTable)
			.where(inArray(animeCacheTable.anilistId, trendingIds));
		const existingCacheIds = new Set(existingCache.map((a) => a.anilistId));
		const missingIds = trendingIds.filter((id) => !existingCacheIds.has(id));
		let newCacheData: {
			anilistId: number;
			coverImage: string | null;
			bannerUrl: string | null;
			trailerId: string | null;
		}[] = [];
		if (missingIds.length > 0) {
			const enrichedResults: EnrichedAnime[] = await batchEnrichAnimeData(missingIds);
			if (enrichedResults.length > 0) {
				db.insert(animeCacheTable).values(enrichedResults).onConflictDoNothing();
				newCacheData = enrichedResults.map((d) => ({
					anilistId: d.anilistId,
					coverImage: d.coverImage,
					bannerUrl: d.bannerUrl,
					trailerId: d.trailerId
				}));
			}
		}
		const fullCache = [...existingCache, ...newCacheData];
		const cacheMap = new Map(
			fullCache.map((a) => [
				a.anilistId,
				{ coverImage: a.coverImage, bannerUrl: a.bannerUrl, trailerId: a.trailerId }
			])
		);
		const combinedAnime = animeFromIndex.map((anime) => {
			const cacheEntry = cacheMap.get(anime.anilistId);
			return {
				...anime,
				coverImage: cacheEntry?.coverImage ?? null,
				bannerUrl: cacheEntry?.bannerUrl ?? null,
				trailerId: cacheEntry?.trailerId ?? null
			};
		});
		const animeMap = new Map(combinedAnime.map((anime) => [anime.anilistId, anime]));
		return trendingIds.map((id) => animeMap.get(id)).filter(notNull);
	};

	// ✅ PERBAIKAN UTAMA ADA DI SINI: Menyelaraskan logika penggabungan data
	const processPopularResults = async (
		trendingWithStatusResult: { id: number; status: string }[]
	) => {
		const finishedTrending = trendingWithStatusResult
			.filter((anime) => anime.status === 'FINISHED')
			.slice(0, 12);
		const finishedIds = finishedTrending.map((a) => a.id);
		if (finishedIds.length === 0) return [];

		const [animeFromIndex, existingCache] = await Promise.all([
			db.select().from(animeIndexTable).where(inArray(animeIndexTable.anilistId, finishedIds)),
			db
				.select({
					anilistId: animeCacheTable.anilistId,
					coverImage: animeCacheTable.coverImage,
					trailerId: animeCacheTable.trailerId
				})
				.from(animeCacheTable)
				.where(inArray(animeCacheTable.anilistId, finishedIds))
		]);

		const existingCacheIds = new Set(existingCache.map((a) => a.anilistId));
		const missingIds = finishedIds.filter((id) => !existingCacheIds.has(id));
		let newCacheData: { anilistId: number; coverImage: string | null; trailerId: string | null }[] =
			[];

		if (missingIds.length > 0) {
			const enrichedResults: EnrichedAnime[] = await batchEnrichAnimeData(missingIds);
			if (enrichedResults.length > 0) {
				db.insert(animeCacheTable).values(enrichedResults).onConflictDoNothing();
				newCacheData = enrichedResults.map((d) => ({
					anilistId: d.anilistId,
					coverImage: d.coverImage,
					trailerId: d.trailerId
				}));
			}
		}

		const fullCache = [...existingCache, ...newCacheData];
		// Pastikan cacheMap menyimpan objek lengkap
		const cacheMap = new Map(
			fullCache.map((a) => [a.anilistId, { coverImage: a.coverImage, trailerId: a.trailerId }])
		);
		// Gabungkan data dari indeks DENGAN data dari cache
		const combinedAnime = animeFromIndex.map((anime) => {
			const cacheEntry = cacheMap.get(anime.anilistId);
			return {
				...anime,
				coverImage: cacheEntry?.coverImage ?? null,
				trailerId: cacheEntry?.trailerId ?? null
			};
		});

		const animeMap = new Map(combinedAnime.map((anime) => [anime.anilistId, anime]));
		return finishedIds.map((id) => animeMap.get(id)).filter(notNull);
	};

	if (popularMovie) {
		db.insert(animeCacheTable)
			.values({
				anilistId: popularMovie.id,
				coverImage: popularMovie.coverImage,
				bannerUrl: popularMovie.bannerUrl,
				trailerId: popularMovie.trailerId
			})
			.onConflictDoUpdate({
				target: animeCacheTable.anilistId,
				set: {
					coverImage: popularMovie.coverImage,
					bannerUrl: popularMovie.bannerUrl,
					trailerId: popularMovie.trailerId,
					cachedAt: new Date()
				}
			})
			.catch(console.error);
	}

	const [trendingAnimeResult, popularAnimeResult] = await Promise.all([
		processTrendingResults(trending),
		processPopularResults(trendingWithStatus)
	]);

	const heroAnime = trendingAnimeResult[0] ?? null;
	const airingAnime = trendingAnimeResult.slice(1, 13);
	const searchCarouselAnime = trendingAnimeResult.slice(13, 25);

	return {
		airingAnime,
		popularAnime: popularAnimeResult,
		heroAnime,
		popularMovie: popularMovie,
		searchCarouselAnime,
		currentSeason
	};
};
