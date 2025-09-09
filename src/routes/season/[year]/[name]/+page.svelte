<script lang="ts">
	import type { PageData } from './$types';
	import * as m from '$lib/paraglide/messages';
	import AnimeCard from '$lib/components/AnimeCard.svelte';
	import { ArrowDownUp } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	export let data: PageData;
	$: ({ anime, seasonString, total, sortBy } = data);

	function handleSortChange(event: Event) {
		const newSortBy = (event.target as HTMLSelectElement).value;
		const url = new URL($page.url);
		url.searchParams.set('sort', newSortBy);

		goto(url.toString(), {
			noScroll: true,
			replaceState: true
		});
	}
</script>

<svelte:head>
	<title>{m.season_page_title({ season: seasonString })}</title>
</svelte:head>

<!-- Hero Banner Musiman -->
<section class="relative -mt-16 h-64 w-full md:h-80">
	<div class="absolute inset-0 overflow-hidden">
		<!-- Ganti dengan gambar latar yang lebih dinamis atau relevan jika memungkinkan -->
		<img
			src="/season-banner-placeholder.jpg"
			alt="Seasonal Banner"
			class="h-full w-full object-cover brightness-50"
		/>
	</div>
	<div
		class="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/70 to-transparent"
	></div>
	<div class="relative flex h-full flex-col items-center justify-center text-center text-white">
		<h1 class="text-5xl font-extrabold tracking-tight sm:text-7xl">{seasonString}</h1>
		<p class="mt-4 text-lg text-slate-300">
			{m.season_show_count({ count: total.toString() })}
		</p>
	</div>
</section>

<!-- Konten Utama Arsip -->
<div class="container mx-auto px-4 py-12">
	<div class="mb-6 flex items-center justify-between">
		<h2 class="text-2xl font-bold text-slate-900 dark:text-white">
			{m.season_all_shows()}
		</h2>
		<div class="relative">
			<select
				on:change={handleSortChange}
				value={sortBy}
				class="block w-full appearance-none rounded-md border-slate-300 bg-white py-2 pr-10 pl-3 text-base focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none sm:text-sm dark:border-slate-600 dark:bg-slate-800"
			>
				<option value="popularity">{m.sort_by_popularity()}</option>
				<option value="title">{m.sort_by_title()}</option>
			</select>
			<div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2">
				<ArrowDownUp class="h-4 w-4 text-slate-400" />
			</div>
		</div>
	</div>

	{#if anime.length > 0}
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
			{#each anime as item (item.id)}
				<AnimeCard anime={item} />
			{/each}
		</div>
	{:else}
		<div
			class="flex h-64 flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-center dark:border-slate-700"
		>
			<h3 class="text-xl font-semibold text-slate-800 dark:text-white">
				{m.season_no_results()}
			</h3>
			<p class="mt-2 text-slate-500">{m.season_no_results_desc()}</p>
		</div>
	{/if}
</div>
