import { db } from '$lib/server/db';
import { animeTable } from '$lib/server/db/schema';
import { eq, desc, asc, count } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { syncSeasonData } from '$lib/server/sync';

export const load: PageServerLoad = async ({ params, url }) => {
	const { year, name } = params;
	const sortBy = url.searchParams.get('sort') || 'popularity';

	const yearInt = parseInt(year);
	if (!year || !name || isNaN(parseInt(year))) {
		return { anime: [], seasonString: 'Invalid Season', total: 0, sortBy };
	}

	const seasonString = `${name.toUpperCase()} ${year}`;

	const [countResult] = await db
		.select({ value: count() })
		.from(animeTable)
		.where(eq(animeTable.season, seasonString));

	if (countResult.value < 5) {
		console.log(
			`Data untuk ${seasonString} tidak lengkap (ditemukan ${countResult.value} entri). Mengambil data lengkap dari AniList...`
		);
		await syncSeasonData(name.toUpperCase(), yearInt);
	} else {
		console.log(
			`Data untuk ${seasonString} ditemukan lengkap di cache lokal (ditemukan ${countResult.value} entri).`
		);
	}

	let orderByClause = sortBy === 'title' ? asc(animeTable.title) : desc(animeTable.popularity);

	const anime = await db
		.select()
		.from(animeTable)
		.where(eq(animeTable.season, seasonString))
		.orderBy(orderByClause);

	return {
		anime,
		seasonString,
		total: anime.length,
		sortBy
	};
};
