<script lang="ts">
	export let value: string = '';
</script>

<form action="/search" method="GET" class="relative mx-auto max-w-2xl">
	<label for="search-input" class="sr-only">Cari Tontonan</label>
	<div
		class="group flex items-center rounded-full border border-slate-300 bg-white shadow-sm transition-all focus-within:ring-2 focus-within:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800"
	>
		<div class="pointer-events-none flex h-full items-center pl-4">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 20 20"
				fill="currentColor"
				class="h-5 w-5 text-slate-400 transition-colors group-focus-within:text-indigo-500 dark:text-slate-500"
			>
				<path
					fill-rule="evenodd"
					d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
					clip-rule="evenodd"
				/>
			</svg>
		</div>
		<input
			type="search"
			id="search-input"
			name="q"
			placeholder="Cari anime, drama, atau film..."
			class="w-full border-none bg-transparent py-3 pr-4 pl-2 text-slate-900 placeholder:text-slate-400 focus:ring-0 dark:text-white"
			bind:value
		/>
	</div>
</form>
