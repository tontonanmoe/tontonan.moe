import { db } from '$lib/server/db';
import { animeTable } from '$lib/server/db/schema';
import { sql, ilike, desc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const query = url.searchParams.get('q');

	if (!query) {
		return { results: [], query: '' };
	}

	const searchResults = await db
		.select()
		.from(animeTable)
		.where(ilike(animeTable.title, `%${query}%`))
		.orderBy(
			sql`CASE WHEN ${animeTable.title} ILIKE ${`${query}%`} THEN 0 ELSE 1 END`,
			desc(animeTable.popularity)
		)
		.limit(50);

	return {
		results: searchResults,
		query
	};
};
