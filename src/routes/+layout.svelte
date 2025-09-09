<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import * as m from '$lib/paraglide/messages';

	$: user = $page.data.user;
</script>

<div class="min-h-screen bg-transparent text-slate-50 antialiased">
	<header
		class="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-lg dark:border-slate-800 dark:bg-slate-900/80"
	>
		<nav class="container mx-auto flex h-16 items-center justify-between px-4">
			<a href="/" class="text-xl font-bold tracking-tight">
				tontonan<span class="text-indigo-500">.moe</span>
			</a>
			<div class="flex items-center gap-x-4">
				{#if user}
					<a
						href="/dashboard"
						class="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
					>
						{m.button_go_to_dashboard()}
					</a>
				{:else}
					<a href="/login" class="text-sm font-semibold hover:text-indigo-500">
						{m.button_login()}
					</a>
					<a
						href="/register"
						class="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
					>
						{m.button_register()}
					</a>
				{/if}
			</div>
		</nav>
	</header>

	<main>
		<slot />
	</main>

	<footer class="border-t border-slate-200 dark:border-slate-800">
		<div class="container mx-auto px-4 py-8 text-center text-sm text-slate-500">
			<p>&copy; {new Date().getFullYear()} tontonan.moe - Dibuat dengan ❤️ untuk komunitas.</p>
		</div>
	</footer>
</div>
