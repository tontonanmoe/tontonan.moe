import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { animeIndexTable, animeCacheTable } from '$lib/server/db/schema';

export const load: LayoutServerLoad = async ({ params }) => {
	const animeIndex = await db.query.animeIndexTable.findFirst({
		where: eq(animeIndexTable.slug, params.slug)
	});

	if (!animeIndex) {
		throw error(404, 'Anime tidak ditemukan');
	}

	const animeDetail = await db.query.animeCacheTable.findFirst({
		where: eq(animeCacheTable.anilistId, animeIndex.anilistId)
	});

	return {
		animeIndex,
		animeDetail
	};
};
