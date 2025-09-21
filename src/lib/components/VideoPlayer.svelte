<script lang="ts">
	import { useYoutubePlayer } from '$lib/composables/useYoutubePlayer';
	import { onMount } from 'svelte';

	export let videoId: string | undefined;

	const { loadVideo } = useYoutubePlayer();

	let playerHostElement: HTMLDivElement | null = null;

	async function load(id: string) {
		if (!playerHostElement) return;
		await loadVideo(id, playerHostElement);
	}

	$: if (videoId) {
		load(videoId);
	}

	onMount(() => {
		if (videoId) {
			load(videoId);
		}
	});
</script>

<div bind:this={playerHostElement}></div>
