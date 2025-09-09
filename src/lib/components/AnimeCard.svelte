<script lang="ts">
	import { fade } from 'svelte/transition';
	import YouTubePlayer from './YouTubePlayer.svelte';

	export let anime: any;

	const placeholderImage = '/placeholder.jpg';

	// STATE MANAGEMENT
	let isHovering = false; // Apakah kursor berada di atas kartu?
	let videoHasError = false; // Apakah video gagal dimuat?
	let isPlayerVisible = false; // ✅ State baru: Apakah video sudah dikonfirmasi berputar?

	// EVENT HANDLERS
	function handleVideoError() {
		videoHasError = true;
	}

	function handlePlayerReady() {
		// Fungsi ini dipanggil oleh YouTubePlayer saat video berhasil diputar
		isPlayerVisible = true;
	}
</script>

<a
	href={`/anime/${anime.slug}`}
	class="group relative space-y-2"
	on:mouseenter={() => (isHovering = true)}
	on:mouseleave={() => {
		// ✅ Reset semua state saat mouse pergi
		isHovering = false;
		videoHasError = false;
		isPlayerVisible = false;
	}}
>
	<div class="aspect-[2/3] overflow-hidden rounded-lg bg-slate-200 dark:bg-slate-700">
		<!-- Pemutar video hanya DIBUAT saat di-hover, belum tentu DITAMPILKAN -->
		{#if isHovering && anime.trailerId && !videoHasError}
			{@const playerVars = {
				autoplay: 1,
				controls: 0,
				loop: 1,
				playlist: anime.trailerId,
				mute: 1,
				modestbranding: 1,
				fs: 0,
				iv_load_policy: 3,
				rel: 0
			}}
			<!-- Wadah ini akan menjadi terlihat hanya jika isPlayerVisible true -->
			<div
				class="absolute inset-0 h-full w-full overflow-hidden transition-opacity duration-300"
				class:opacity-100={isPlayerVisible}
				class:opacity-0={!isPlayerVisible}
			>
				<YouTubePlayer
					videoId={anime.trailerId}
					{playerVars}
					onError={handleVideoError}
					onReadyToPlay={handlePlayerReady}
				/>
			</div>
		{/if}

		<!-- Poster statis -->
		<img
			src={anime.coverImage ?? placeholderImage}
			alt={`Poster for ${anime.title}`}
			class="h-full w-full object-cover transition-opacity duration-300"
			class:opacity-0={isPlayerVisible}
			loading="lazy"
		/>
	</div>
	<h3 class="truncate font-semibold text-slate-800 dark:text-slate-100">{anime.title}</h3>
</a>
