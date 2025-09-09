<script lang="ts">
	import type { PageData } from './$types';
	import * as m from '$lib/paraglide/messages';
	import SearchResultCard from '$lib/components/SearchResultCard.svelte';
	import SearchBar from '$lib/components/SearchBar.svelte';
	import { Frown } from 'lucide-svelte';

	export let data: PageData;
	$: ({ results, query } = data);
</script>

<svelte:head>
	<title>{m.search_page_title({ query: query || '' })}</title>
	<meta name="description" content={m.search_page_description()} />
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<div class="mx-auto mb-8 max-w-xl">
		<SearchBar value={query} />
	</div>

	{#if query}
		<hr class="mb-8 border-slate-200 dark:border-slate-700" />
		<h1 class="mb-6 text-2xl font-bold text-slate-900 sm:text-3xl dark:text-white">
			{@html m.search_results_for({ query: `<span class="text-indigo-500">${query}</span>` })}
		</h1>

		{#if results.length > 0}
			<div class="space-y-2">
				{#each results as anime (anime.id)}
					<SearchResultCard {anime} />
				{/each}
			</div>
		{:else}
			<div
				class="flex flex-col items-center justify-center rounded-lg bg-white p-12 text-center dark:bg-slate-800"
			>
				<Frown class="h-16 w-16 text-slate-400" />
				<h2 class="mt-4 text-2xl font-bold text-slate-800 dark:text-white">
					{m.search_no_results_found()}
				</h2>
				<p class="mt-2 max-w-sm text-slate-500">{m.search_try_another_keyword()}</p>
			</div>
		{/if}
	{/if}
</div>
