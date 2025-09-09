<script lang="ts">
	import type { PageData } from './$types';
	import * as m from '$lib/paraglide/messages';
	import AnimeCard from '$lib/components/AnimeCard.svelte';
	import HeroCard from '$lib/components/HeroCard.svelte';
	import { Search, Calendar } from 'lucide-svelte';

	export let data: PageData;
	$: ({ heroAnime, popularMovie, airingAnime, popularAnime, searchCarouselAnime, currentSeason } =
		data);
</script>

<svelte:head>
	<title>{m.homepage_title()}</title>
	<meta name="description" content={m.homepage_description()} />
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<section class="mb-16">
		<div class="grid grid-cols-1 gap-4 lg:grid-cols-4 lg:grid-rows-2">
			{#if heroAnime}
				<HeroCard
					href={`/anime/${heroAnime.slug}`}
					title={heroAnime.title || 'Unknown'}
					subtitle={m.hero_trending_now()}
					imageUrl={heroAnime.bannerUrl ?? heroAnime.coverImage}
					trailerId={heroAnime.trailerId}
					className="lg:col-span-2 lg:row-span-2"
				/>
			{/if}

			<HeroCard
				href="/search"
				title={m.hero_search_title()}
				subtitle={m.hero_search_subtitle()}
				className="bg-indigo-900 lg:col-span-2"
				carouselImages={searchCarouselAnime}
				><Search
					class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-400/30 transition-transform duration-500 group-hover:scale-110"
					strokeWidth={1.5}
					size={64}
				/></HeroCard
			>

			{#if popularMovie}
				<HeroCard
					href={`/anime/${popularMovie.slug}`}
					title={popularMovie.title || 'Unknown'}
					subtitle={m.hero_popular_movie()}
					imageUrl={popularMovie.bannerUrl ?? popularMovie.coverImage}
					trailerId={popularMovie.trailerId}
				/>
			{/if}

			{#if currentSeason}
				<HeroCard
					href={`/season/${currentSeason.year}/${currentSeason.name.toLowerCase()}`}
					title={m.hero_season_schedule_title()}
					subtitle={m.hero_season_schedule_subtitle({
						season: `${currentSeason.name} ${currentSeason.year}`
					})}
					className="bg-slate-800"
					backgroundText={currentSeason.name}
				>
					<Calendar
						class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-slate-700/50 transition-transform duration-500 group-hover:scale-110"
						strokeWidth={1.5}
						size={64}
					/>
				</HeroCard>
			{/if}
		</div>
	</section>

	{#if airingAnime.length > 0}
		<section class="mb-12">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-2xl font-bold text-slate-900 dark:text-white">{m.section_airing_now()}</h2>
				<a href="/trending" class="text-sm font-semibold text-indigo-500 hover:underline"
					>{m.view_all()}</a
				>
			</div>
			<div
				class="flex space-x-4 overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
			>
				{#each airingAnime as anime (anime.id)}
					<div class="w-40 flex-shrink-0 sm:w-48"><AnimeCard {anime} /></div>
				{/each}
			</div>
		</section>
	{/if}

	{#if popularAnime.length > 0}
		<section>
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-2xl font-bold text-slate-900 dark:text-white">
					{m.section_most_popular()}
				</h2>
				<a href="/popular" class="text-sm font-semibold text-indigo-500 hover:underline"
					>{m.view_all()}</a
				>
			</div>
			<div
				class="flex space-x-4 overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
			>
				{#each popularAnime as anime (anime.id)}
					<div class="w-40 flex-shrink-0 sm:w-48"><AnimeCard {anime} /></div>
				{/each}
			</div>
		</section>
	{/if}
</div>
