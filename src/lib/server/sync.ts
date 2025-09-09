import type { EnrichedAnime } from '$lib/server/db/schema';

const ANILIST_API_URL = 'https://graphql.anilist.co';

export type PopularMovieResult = {
	id: number;
	title: string;
	slug: string;
	coverImage: string | null;
	bannerUrl: string | null;
	trailerId: string | null;
};

const homepageQuery = `
  query ($trendingCount: Int, $popularPoolCount: Int) {
    trending: Page(page: 1, perPage: $trendingCount) {
      media(sort: [TRENDING_DESC, POPULARITY_DESC], type: ANIME, isAdult: false) {
        id
      }
    }

    trendingWithStatus: Page(page: 1, perPage: $popularPoolCount) {
      media(sort: [TRENDING_DESC, POPULARITY_DESC], type: ANIME, isAdult: false) {
        id
        status
      }
    }

    popularMovie: Page(page: 1, perPage: 1) {
      media(type: ANIME, format: MOVIE, sort: [TRENDING_DESC, POPULARITY_DESC]) {
        id
        title { userPreferred }
        coverImage { extraLarge }
		bannerImage
		trailer { id site }
      }
    }
  }
`;

export async function fetchHomepageDataFromApi() {
	const variables = {
		trendingCount: 25,
		popularPoolCount: 50
	};

	try {
		const response = await fetch(ANILIST_API_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({ query: homepageQuery, variables })
		});

		if (!response.ok) throw new Error(`AniList API returned status ${response.status}`);
		const result = await response.json();
		if (result.errors) throw new Error(result.errors[0].message);

		const movie = result.data.popularMovie.media[0];
		let popularMovie: PopularMovieResult | null = null;
		if (movie) {
			popularMovie = {
				id: movie.id,
				title: movie.title.userPreferred,
				slug: movie.title.userPreferred
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, '-')
					.replace(/^-+|-+$/g, ''),
				coverImage: movie.coverImage.extraLarge,
				bannerUrl: movie.bannerImage,
				trailerId: movie.trailer?.site === 'youtube' ? movie.trailer.id : null
			};
		}

		return {
			trending: result.data.trending.media as { id: number }[],
			trendingWithStatus: result.data.trendingWithStatus.media as { id: number; status: string }[],
			popularMovie: popularMovie
		};
	} catch (error) {
		console.error('Gagal mengambil data halaman utama dari AniList:', error);
		return { trending: [], trendingWithStatus: [], popularMovie: null };
	}
}

export async function batchEnrichAnimeData(anilistIds: number[]): Promise<EnrichedAnime[]> {
	if (anilistIds.length === 0) {
		return [];
	}

	try {
		const response = await fetch(ANILIST_API_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({ query: batchEnrichmentQuery, variables: { ids: anilistIds } })
		});

		if (!response.ok) {
			const errorBody = await response.text();
			console.warn(
				`Peringatan: Batch enrichment gagal dengan status ${response.status}. Body: ${errorBody}`
			);
			return [];
		}

		const result = await response.json();

		if (result.errors) {
			console.warn(
				`Peringatan: Batch enrichment mengembalikan error GraphQL:`,
				result.errors[0].message
			);
			return [];
		}

		const mediaList = result.data.Page.media;
		if (!mediaList) return [];

		return mediaList.map(
			(media: any): EnrichedAnime => ({
				anilistId: media.id,
				coverImage: media.coverImage.extraLarge,
				synopsis: media.description,
				bannerUrl: media.bannerImage,
				trailerId: media.trailer?.site === 'youtube' ? media.trailer.id : null,
				status: media.status,
				episodes: media.episodes,
				popularity: media.popularity,
				studios: media.studios.nodes.map((n: { name: string }) => n.name),
				tags: media.tags.map((t: { name: string }) => t.name)
			})
		);
	} catch (error) {
		console.error(`Gagal melakukan batch enrichment dari AniList:`, error);
		return [];
	}
}

export async function enrichAnimeData(anilistId: number) {
	try {
		const response = await fetch(ANILIST_API_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({ query: enrichmentQuery, variables: { id: anilistId } })
		});

		if (!response.ok) {
			const errorBody = await response.text();
			console.warn(
				`Peringatan: AniList API merespons dengan status ${response.status} untuk ID ${anilistId}. Body: ${errorBody}`
			);
			return null;
		}

		const result = await response.json();

		if (result.errors) {
			console.warn(
				`Peringatan: AniList API mengembalikan error GraphQL untuk ID ${anilistId}:`,
				result.errors[0].message
			);
			return null;
		}

		const media = result.data.Media;
		if (!media) {
			console.warn(
				`Peringatan: Tidak ada data Media yang ditemukan untuk ID ${anilistId} meskipun respons berhasil.`
			);
			return null;
		}

		return {
			anilistId,
			coverImage: media.coverImage.extraLarge as string | null,
			synopsis: media.description as string | null,
			bannerUrl: media.bannerImage as string | null,
			trailerId: media.trailer?.site === 'YouTube' ? (media.trailer.id as string) : null,
			status: media.status as string | null,
			episodes: media.episodes as number | null,
			popularity: media.popularity as number | null,
			studios: media.studios.nodes.map((n: { name: string }) => n.name) as string[],
			tags: media.tags.map((t: { name: string }) => t.name) as string[]
		};
	} catch (error) {
		console.error(
			`Gagal mengambil data dari AniList (kemungkinan error jaringan) untuk ID ${anilistId}:`,
			error
		);
		return null;
	}
}

const enrichmentQuery = `
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    description(asHtml: false) 
    bannerImage
    trailer { id site }
    status
    episodes
    popularity
    studios { nodes { name } }
    tags { name }
    coverImage { extraLarge }
  }
}`;

export async function getTrendingAnimeIds(count: number = 20): Promise<number[]> {
	const query = `
    query ($page: Int, $perPage: Int, $sort: [MediaSort]) {
      Page(page: $page, perPage: $perPage) {
        media(sort: $sort, type: ANIME, isAdult: false) {
          id
        }
      }
    }
  `;

	const variables = {
		page: 1,
		perPage: count,
		sort: ['TRENDING_DESC', 'POPULARITY_DESC']
	};

	try {
		const response = await fetch(ANILIST_API_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({ query, variables })
		});

		if (!response.ok) {
			const errorBody = await response.text();
			throw new Error(`AniList API returned status ${response.status}. Body: ${errorBody}`);
		}

		const result = await response.json();

		if (result.errors) {
			console.warn(
				'Peringatan: Gagal mengambil daftar ID trending dari AniList:',
				result.errors[0].message
			);
			return [];
		}

		const media = result.data.Page.media;
		if (!media) return [];

		return media.map((item: { id: number }) => item.id);
	} catch (error) {
		console.error('Gagal mengambil data trending dari AniList:', error);
		return [];
	}
}

const batchEnrichmentQuery = `
query ($ids: [Int]) {
  Page(page: 1, perPage: 50) {
    media(id_in: $ids, type: ANIME) {
      id
      description(asHtml: false)
      bannerImage
      trailer { id site }
      status
      episodes
      popularity
      studios { nodes { name } }
      tags { name }
      coverImage { extraLarge }
    }
  }
}`;

export async function getTrendingAnimeWithStatus(
	count: number = 50
): Promise<{ id: number; status: string }[]> {
	const query = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(sort: [TRENDING_DESC, POPULARITY_DESC], type: ANIME, isAdult: false) {
          id
          status
        }
      }
    }
  `;

	try {
		const response = await fetch(ANILIST_API_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({ query, variables: { page: 1, perPage: count } })
		});

		if (!response.ok) {
			throw new Error(`AniList API returned status ${response.status}`);
		}
		const result = await response.json();
		if (result.errors) {
			console.warn('Peringatan: Gagal mengambil trending with status:', result.errors[0].message);
			return [];
		}
		return result.data.Page.media;
	} catch (error) {
		console.error('Gagal mengambil data trending with status dari AniList:', error);
		return [];
	}
}
