<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	export let videoId: string;
	export let playerVars: YT.PlayerVars = {};
	export let onError: (() => void) | undefined = undefined;
	export let onReadyToPlay: (() => void) | undefined = undefined;

	let player: YT.Player;
	let playerTarget: HTMLDivElement;

	function onPlayerError(event: YT.OnErrorEvent) {
		if ([100, 101, 150].includes(event.data)) {
			if (onError) onError();
		}
	}

	function onPlayerStateChange(event: YT.OnStateChangeEvent) {
		if (event.data === YT.PlayerState.PLAYING) {
			if (onReadyToPlay) onReadyToPlay();
		}
	}

	onMount(() => {
		window.onYouTubeIframeAPIReady = () => {
			if (playerTarget) {
				player = new YT.Player(playerTarget, {
					videoId,
					playerVars,
					events: {
						onError: onPlayerError,
						onStateChange: onPlayerStateChange
					}
				});
			}
		};
		if (window.YT && window.YT.Player) {
			window.onYouTubeIframeAPIReady();
		} else {
			const tag = document.createElement('script');
			tag.src = 'https://www.youtube.com/iframe_api';
			const firstScriptTag = document.getElementsByTagName('script')[0];
			firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
		}
		return () => {
			if (player) player.destroy();
		};
	});
</script>

<div bind:this={playerTarget} class="h-full w-full"></div>

<style>
	/* ✅ PERBAIKAN UTAMA DAN FINAL ADA DI SINI */
	:global(iframe) {
		/* 1. Pusatkan iframe di tengah wadahnya */
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);

		/* 2. Atur tinggi agar sama dengan wadah, dan biarkan lebar dihitung otomatis */
		height: 100%;
		width: auto;

		/* 3. Paksa rasio aspek 16:9. Browser akan menyesuaikan lebar secara otomatis */
		aspect-ratio: 16/9;

		/* 4. Mencegah iframe "mencuri" event klik dan hover */
		pointer-events: none;
	}
</style>
