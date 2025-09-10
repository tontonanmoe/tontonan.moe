<script>
	import YouTubePlayer from '$lib/components/YouTubePlayer.svelte';

	let videoId = '';
	let playerContainer;
</script>

<div bind:this={playerContainer} style="width: 100%; height: 100%;">
	<YouTubePlayer {videoId} container={playerContainer} />
</div>
