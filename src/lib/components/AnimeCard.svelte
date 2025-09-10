<script lang="ts">
	export let anime: any;
</script>

<a href={`/anime/${anime.slug}`} class="group relative space-y-2">
	<div class="aspect-[2/3] overflow-hidden rounded-lg bg-slate-200 dark:bg-slate-700">
		<img
			src={anime.coverImage}
			alt={`Poster for ${anime.title}`}
			class="h-full w-full object-cover transition-opacity duration-300"
			loading="lazy"
		/>
	</div>
	<h3 class="truncate font-semibold text-slate-800 dark:text-slate-100">{anime.title}</h3>
</a>
