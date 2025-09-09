<script lang="ts">
	import type { PageData } from './$types';
	import * as m from '$lib/paraglide/messages';
	import {
		PlayCircle,
		Tv,
		Film,
		Clapperboard,
		Calendar,
		Star,
		CircleCheck,
		Link
	} from 'lucide-svelte';

	export let data: PageData;
	$: ({ animeIndex, animeDetail } = data);

	const bannerImage = animeDetail?.bannerUrl ?? animeIndex.picture;

	function getSourceName(url: string): string {
		if (url.includes('myanimelist.net')) return 'MyAnimeList';
		if (url.includes('anidb.net')) return 'AniDB';
		if (url.includes('animenewsnetwork.com')) return 'Anime News Network';
		return 'Official Site';
	}
</script>

<svelte:head>
	<title>{animeIndex.title} - tontonan.moe</title>
</svelte:head>

<section class="relative -mt-16 h-64 w-full md:h-80">
	<div class="absolute inset-0 overflow-hidden">
		<img
			src={bannerImage}
			alt="Banner"
			class="h-full w-full scale-110 object-cover blur-md brightness-50"
		/>
	</div>
	<div
		class="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/70 to-transparent"
	></div>
</section>

<div class="relative container mx-auto -mt-48 px-4 pb-16 md:-mt-56">
	<div class="grid grid-cols-1 gap-8 md:grid-cols-12">
		<div class="md:col-span-4 lg:col-span-3">
			<img
				src={animeIndex.picture}
				alt={`Poster for ${animeIndex.title}`}
				class="aspect-[2/3] w-full rounded-lg shadow-2xl"
			/>
			{#if animeDetail?.trailerId}
				<!-- Logika tombol trailer Anda -->
			{/if}
		</div>

		<!-- Kolom Kanan: Judul & Sinopsis -->
		<div class="flex flex-col pt-16 md:col-span-8 md:pt-32 lg:col-span-9">
			<h1 class="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
				{animeIndex.title}
			</h1>
			<p class="mt-4 max-w-3xl text-lg text-slate-300">
				{animeDetail?.synopsis ?? m.detail_no_synopsis()}
			</p>
		</div>
	</div>

	<!-- Grid Metadata & Tautan -->
	<div class="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-3">
		<div class="lg:col-span-2">
			<h2 class="text-2xl font-bold text-slate-900 dark:text-white">{m.detail_metadata_title()}</h2>
			<div
				class="mt-4 grid grid-cols-1 gap-y-4 rounded-lg bg-white p-6 shadow-md sm:grid-cols-2 sm:gap-x-6 dark:bg-slate-800"
			>
				<div class="flex items-start">
					<svelte:component
						this={animeIndex.type === 'TV' ? Tv : Film}
						class="mr-4 h-6 w-6 text-indigo-500"
					/>
					<div>
						<dt class="font-semibold">{m.detail_metadata_format()}</dt>
						<dd class="text-slate-500">{animeIndex.type}</dd>
					</div>
				</div>
				<div class="flex items-start">
					<CircleCheck class="mr-4 h-6 w-6 text-indigo-500" />
					<div>
						<dt class="font-semibold">{m.detail_metadata_status()}</dt>
						<dd class="text-slate-500">{animeDetail?.status?.replace('_', ' ') ?? 'Loading...'}</dd>
					</div>
				</div>
				<div class="flex items-start">
					<Calendar class="mr-4 h-6 w-6 text-indigo-500" />
					<div>
						<dt class="font-semibold">{m.detail_metadata_season()}</dt>
						<dd class="text-slate-500">{animeIndex.season} {animeIndex.year}</dd>
					</div>
				</div>
				<div class="flex items-start">
					<Clapperboard class="mr-4 h-6 w-6 text-indigo-500" />
					<div>
						<dt class="font-semibold">{m.detail_metadata_studios()}</dt>
						<dd class="text-slate-500">{animeIndex.studios?.join(', ') ?? 'N/A'}</dd>
					</div>
				</div>
			</div>
		</div>
		<div>
			<h2 class="text-2xl font-bold text-slate-900 dark:text-white">{m.detail_official_links()}</h2>
			<div class="mt-4 rounded-lg bg-white p-4 shadow-md dark:bg-slate-800">
				{#if animeIndex.sources && animeIndex.sources.length > 0}
					<ul class="space-y-2">
						{#each animeIndex.sources as source (source)}
							<li>
								<a
									href={source}
									target="_blank"
									rel="noopener noreferrer"
									class="flex items-center gap-3 rounded-md p-3 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
									><Link class="h-4 w-4 text-slate-400" />{getSourceName(source)}</a
								>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>
	</div>
</div>
