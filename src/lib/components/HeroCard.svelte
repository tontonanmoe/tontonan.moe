<script lang="ts">
	import { ArrowUpRight } from 'lucide-svelte';

	export let href: string;
	export let title: string;
	export let subtitle: string | undefined = undefined;
	export let imageUrl: string | null | undefined = undefined;
	export let className: string = '';
	export let carouselImages: any[] | undefined = undefined;
	export let backgroundText: string | undefined = undefined;
</script>

<a
	{href}
	class="group relative flex flex-col justify-end overflow-hidden rounded-xl bg-slate-800 p-6 text-white shadow-lg transition-transform duration-300 ease-in-out hover:scale-[1.02] hover:shadow-2xl {className}"
>
	<div class="absolute inset-0 z-0 overflow-hidden">
		<div class="absolute inset-0 transition-opacity duration-300">
			<!-- 1. Latar Belakang Carousel Gambar -->
			{#if carouselImages && carouselImages.length > 0}
				<div
					class="interactive-carousel transition-filter flex h-full whitespace-nowrap grayscale filter duration-500 group-hover:filter-none"
				>
					{#each carouselImages as anime (anime.coverImage)}
						<img
							src={anime.coverImage}
							alt=""
							class="aspect-[2/3] w-40 flex-shrink-0 object-cover"
							loading="lazy"
						/>
					{/each}
					{#each carouselImages as anime (anime.coverImage + '_dup')}
						<img
							src={anime.coverImage}
							alt=""
							class="aspect-[2/3] w-40 flex-shrink-0 object-cover"
							loading="lazy"
						/>
					{/each}
				</div>
				<div
					class="absolute inset-0 z-10 bg-gradient-to-t from-indigo-900/80 via-indigo-800/50 to-transparent"
				></div>
				<!-- 2. Latar Belakang Gambar Statis (Fallback) -->
			{:else if imageUrl}
				<img
					src={imageUrl}
					alt={title}
					class="h-full w-full object-cover transition-transform duration-500 ease-in-out group-hover:scale-110"
				/>
				<div
					class="absolute inset-0 z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent"
				></div>
			{/if}

			<!-- 3. Latar Belakang Teks Miring Bergerak -->
			{#if backgroundText}
				<div
					class="pointer-events-none absolute top-1/2 left-1/2 w-[200%] -translate-x-1/2 -translate-y-1/2 -rotate-12 overflow-hidden"
				>
					<div class="interactive-carousel flex whitespace-nowrap">
						{#each Array(10) as _}
							<span
								class="flex-shrink-0 px-8 text-center font-black whitespace-nowrap text-slate-700/50 uppercase transition-colors duration-500 group-hover:text-slate-700/80"
								style="font-size: 8rem; line-height: 1;">{backgroundText}</span
							>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</div>

	<div class="relative z-20">
		{#if subtitle}<p class="text-sm font-semibold tracking-wider text-slate-300 uppercase">
				{subtitle}
			</p>{/if}
		<h3 class="mt-1 text-2xl font-bold">{title}</h3>
	</div>
	<div
		class="absolute top-4 right-4 z-20 rounded-full bg-black/30 p-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
	>
		<ArrowUpRight class="h-5 w-5" />
	</div>
	<slot />
</a>
