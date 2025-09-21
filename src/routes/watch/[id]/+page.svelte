<script lang="ts">
	import 'shaka-player/dist/controls.css';

	import { page } from '$app/state';
	import { browser } from '$app/environment';

	let videoId: string | undefined;
	let VideoPlayer: any;

	$: videoId = page.params.id;

	if (browser) {
		import('$lib/components/VideoPlayer.svelte').then((module) => {
			VideoPlayer = module.default;
		});
	}
</script>

{#if browser && VideoPlayer}
	<svelte:component this={VideoPlayer} {videoId} />
{/if}
