<script lang="ts">
	import { onMount } from 'svelte';

	export let videoId = '';
	export let container;

	async function loadVideo();

	onMount(() => {
		if (videoId) {
			loadVideo(videoId);
		}
	});
</script>

<svelte:element this={container} class="player-container" />
