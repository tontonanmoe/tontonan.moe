import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

let DATABASE_URL: string | undefined;
let dev = process.env.NODE_ENV === 'development';

try {
	const { env } = await import('$env/dynamic/private');
	const appEnv = await import('$app/environment');

	DATABASE_URL = env.DATABASE_URL;
	dev = appEnv.dev;
} catch (e) {
	console.log('Menjalankan skrip di luar SvelteKit, menggunakan .env dan process.env...');
	DATABASE_URL = process.env.DATABASE_URL;
}

if (!DATABASE_URL) {
	throw new Error('Variabel DATABASE_URL tidak ditemukan di .env atau environment');
}

const client = postgres(DATABASE_URL, {});

export const db = drizzle(client, { schema, logger: dev });
