<script lang="ts">
	import type { animeTable } from '$lib/server/db/schema';
	import type { InferSelectModel } from 'drizzle-orm';
	import { Tv, Film, Clapperboard, Calendar, ArrowUpRight } from 'lucide-svelte';

	type Anime = InferSelectModel<typeof animeTable>;
	export let anime: Anime;

	const synopsisSnippet = anime.synopsis ? `${anime.synopsis.substring(0, 120)}...` : '';

	const formatIcon: Record<string, any> = {
		TV: Tv,
		MOVIE: Film,
		default: Clapperboard
	};
</script>

<a
	href={`/anime/${anime.slug}`}
	class="group flex gap-4 rounded-lg p-3 transition-colors hover:bg-white dark:hover:bg-slate-800"
>
	<div class="w-24 flex-shrink-0">
		<img
			src={anime.posterUrl}
			alt={`Poster for ${anime.title}`}
			class="aspect-[2/3] w-full rounded-md object-cover shadow-md"
		/>
	</div>
	<div class="flex flex-col">
		<h3 class="text-lg font-bold text-slate-900 dark:text-white">{anime.title}</h3>
		<div class="mt-1 flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
			<span class="flex items-center">
				<svelte:component
					this={formatIcon[anime.format || 'default'] || Clapperboard}
					class="mr-1 h-4 w-4"
				/>
				{anime.format?.replace('_', ' ') || 'N/A'}
			</span>
			<span class="flex items-center">
				<Calendar class="mr-1 h-4 w-4" />
				{anime.season || 'N/A'}
			</span>
		</div>
		<p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
			{synopsisSnippet}
		</p>
	</div>
	<div
		class="ml-auto hidden flex-shrink-0 self-center opacity-0 transition-opacity group-hover:opacity-100 md:block"
	>
		<ArrowUpRight class="h-6 w-6 text-slate-400" />
	</div>
</a>
