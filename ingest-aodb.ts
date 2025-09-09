import 'dotenv/config';
import { db } from './src/lib/server/db';
import { animeIndexTable, animeIndexShadowTable } from './src/lib/server/db/schema';
import { ZstdInit, ZstdCodec } from '@oneidentity/zstd-js';
import { sql, getTableName } from 'drizzle-orm';

const AODB_URL =
	'https://github.com/manami-project/anime-offline-database/releases/download/latest/anime-offline-database-minified.json.zst';

function extractAnilistId(sources: string[]): number | null {
	const prefix = 'https://anilist.co/anime/';
	const s = sources.find((u) => u.startsWith(prefix));
	if (!s) return null;
	const id = parseInt(s.slice(prefix.length));
	return isNaN(id) ? null : id;
}

function slugify(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

function makeUniqueSlug(baseSlug: string, usedSlugs: Set<string>): string {
	let slug = baseSlug;
	let counter = 1;
	while (usedSlugs.has(slug)) {
		slug = `${baseSlug}-${counter++}`;
	}
	usedSlugs.add(slug);
	return slug;
}

async function safeIngest() {
	const { ZstdStream }: ZstdCodec = await ZstdInit();

	const liveTableName = getTableName(animeIndexTable);
	const shadowTableName = getTableName(animeIndexShadowTable);

	console.log('Menyiapkan tabel bayangan...');
	await db.execute(
		sql`CREATE TABLE IF NOT EXISTS ${sql.identifier(shadowTableName)} (LIKE ${sql.identifier(liveTableName)} INCLUDING ALL);`
	);
	await db.execute(sql`TRUNCATE TABLE ${sql.identifier(shadowTableName)};`);

	console.log(`Mengunduh AODB...`);
	const resp = await fetch(AODB_URL);
	if (!resp.ok) throw new Error(`Gagal mengunduh: ${resp.statusText}`);
	const buf = new Uint8Array(await resp.arrayBuffer());
	console.log(`Unduhan selesai (${(buf.byteLength / 1024 / 1024).toFixed(2)} MB).`);

	console.log('Mendekompresi...');
	const decompressed = ZstdStream.decompress(buf);
	const text = new TextDecoder().decode(decompressed);
	const aodb = JSON.parse(text);

	console.log(`Berhasil mem-parsing ${aodb.data.length} entri. Memulai ingesti...`);
	const usedSlugs = new Set<string>();
	const allValuesToInsert: any[] = [];

	for (const anime of aodb.data) {
		const anilistId = extractAnilistId(anime.sources);
		if (!anilistId) continue;
		const baseSlug = slugify(anime.title);
		const slug = makeUniqueSlug(baseSlug, usedSlugs);
		allValuesToInsert.push({
			anilistId,
			title: anime.title,
			slug,
			synonyms: anime.synonyms,
			year: anime.animeSeason.year,
			studios: anime.studios,
			sources: anime.sources,
			type: anime.type,
			season: anime.animeSeason.season
		});
	}

	const batchSize = 500;
	for (let i = 0; i < allValuesToInsert.length; i += batchSize) {
		const batch = allValuesToInsert.slice(i, i + batchSize);
		if (batch.length > 0) {
			await db.insert(animeIndexShadowTable).values(batch);
		}
		console.log(`Menyelesaikan batch ${Math.floor(i / batchSize) + 1}...`);
	}

	console.log('Mengganti isi tabel live dengan data dari tabel bayangan...');
	await db.transaction(async (tx) => {
		await tx.execute(
			sql`TRUNCATE TABLE ${sql.identifier(liveTableName)} RESTART IDENTITY CASCADE;`
		);
		await tx.execute(sql`
			INSERT INTO ${sql.identifier(liveTableName)} (id, anilist_id, title, slug, synonyms, year, studios, sources, type, season)
			SELECT id, anilist_id, title, slug, synonyms, year, studios, sources, type, season
			FROM ${sql.identifier(shadowTableName)};
		`);
	});

	console.log('Transaksi berhasil. Membersihkan tabel bayangan...');
	await db.execute(sql`DROP TABLE ${sql.identifier(shadowTableName)};`);

	console.log('✅ Selesai! Indeks baru sekarang sudah live.');
	process.exit(0);
}

safeIngest().catch((err) => {
	console.error('Proses ingesti gagal. Tabel live tidak diubah.', err);
	const shadowTableName = getTableName(animeIndexShadowTable);
	db.execute(sql`DROP TABLE IF EXISTS ${sql.identifier(shadowTableName)}`).finally(() =>
		process.exit(1)
	);
});
