import { getContext } from 'svelte';
import type { OnesieHotConfig } from '$lib/utils/helpers';

export function useOnesieConfig() {
	return getContext('onesieHotConfig') as () => Promise<OnesieHotConfig>;
}
