import { getContext } from 'svelte';
import type { Innertube } from 'youtubei.js/web';

export function useInnertube() {
	return getContext('innertube') as () => Promise<Innertube>;
}
