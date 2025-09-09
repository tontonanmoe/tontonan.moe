import {
	pgTable,
	serial,
	integer,
	text,
	varchar,
	jsonb,
	timestamp,
	primaryKey
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const animeIndexTable = pgTable('anime_index', {
	id: serial('id').primaryKey(),
	anilistId: integer('anilist_id').unique().notNull(),
	title: text('title').notNull(),
	slug: varchar('slug', { length: 256 }).notNull().unique(),
	synonyms: jsonb('synonyms').$type<string[]>(),
	year: integer('year'),
	studios: jsonb('studios').$type<string[]>(),
	sources: jsonb('sources').$type<string[]>(),
	type: varchar('type', { length: 50 }),
	season: varchar('season', { length: 20 })
});

export const animeCacheTable = pgTable('anime_cache', {
	anilistId: integer('anilist_id').primaryKey(),
	coverImage: text('cover_image'),
	synopsis: text('synopsis'),
	bannerUrl: text('banner_url'),
	trailerId: text('trailer_id'),
	status: varchar('status', { length: 50 }),
	popularity: integer('popularity'),
	episodes: integer('episodes'),
	studios: jsonb('studios').$type<string[]>(),
	tags: jsonb('tags').$type<string[]>(),
	cachedAt: timestamp('cached_at', { withTimezone: true }).defaultNow().notNull()
});

export const animeIndexShadowTable = pgTable('anime_index_new', {
	id: serial('id').primaryKey(),
	anilistId: integer('anilist_id').unique().notNull(),
	title: text('title').notNull(),
	slug: varchar('slug', { length: 256 }).notNull().unique(),
	synonyms: jsonb('synonyms').$type<string[]>(),
	year: integer('year'),
	studios: jsonb('studios').$type<string[]>(),
	sources: jsonb('sources').$type<string[]>(),
	type: varchar('type', { length: 50 }),
	season: varchar('season', { length: 20 })
});

export const fansubTable = pgTable('fansubs', {
	id: serial('id').primaryKey(),
	name: varchar('name', { length: 100 }).notNull().unique(),
	url: text('url').notNull()
});

export const animeToFansubs = pgTable(
	'anime_to_fansubs',
	{
		animeId: integer('anime_id')
			.notNull()
			.references(() => animeIndexTable.id, { onDelete: 'cascade' }),
		fansubId: integer('fansub_id')
			.notNull()
			.references(() => fansubTable.id, { onDelete: 'cascade' })
	},
	(table) => [primaryKey({ columns: [table.animeId, table.fansubId] })]
);

export const animeIndexRelations = relations(animeIndexTable, ({ many }) => ({
	animeToFansubs: many(animeToFansubs)
}));

export const fansubRelations = relations(fansubTable, ({ many }) => ({
	animeToFansubs: many(animeToFansubs)
}));

export type EnrichedAnime = {
	anilistId: number;
	coverImage: string | null;
	synopsis: string | null;
	bannerUrl: string | null;
	trailerId: string | null;
	status: string | null;
	episodes: number | null;
	popularity: number | null;
	studios: string[];
	tags: string[];
};
