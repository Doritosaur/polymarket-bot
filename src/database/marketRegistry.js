import pg from 'pg';
const { Pool } = pg;
import Fuse from 'fuse.js';
import { config } from '../config.js';

class MarketRegistry {
    constructor() {
        this.pool = new Pool({
            host: config.db.host,
            port: config.db.port,
            user: config.db.user,
            password: config.db.password,
            database: config.db.database
        });

        this.fuseCache = null;

        // Error handling for idle clients
        this.pool.on('error', (err, client) => {
            console.error('Unexpected error on idle client', err);
            process.exit(-1);
        });
    }

    async initialize() {
        await this.initializeSchema();
    }

    async initializeSchema() {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            await client.query(`
                CREATE TABLE IF NOT EXISTS markets (
                    id SERIAL PRIMARY KEY,
                    condition_id VARCHAR(255) NOT NULL UNIQUE,
                    slug TEXT,
                    event_slug TEXT,
                    clob_token_ids TEXT,
                    description TEXT,
                    threshold REAL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    active INTEGER DEFAULT 1,
                    watched INTEGER DEFAULT 0,
                    end_date TEXT,
                    image TEXT,
                    group_date TEXT
                );
            `);

            await client.query(`
                CREATE TABLE IF NOT EXISTS settings (
                    key VARCHAR(255) PRIMARY KEY,
                    value TEXT,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            await client.query(`
                CREATE TABLE IF NOT EXISTS subscriptions (
                    id SERIAL PRIMARY KEY,
                    guild_id VARCHAR(255) NOT NULL,
                    channel_id VARCHAR(255) NOT NULL,
                    target_type VARCHAR(50) NOT NULL, -- 'market' or 'event'
                    target_slug TEXT NOT NULL, -- slug of the market
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(guild_id, channel_id, target_type, target_slug)
                );
            `);

            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_subscriptions_target ON subscriptions(target_slug);
                CREATE INDEX IF NOT EXISTS idx_markets_condition_id ON markets(condition_id);
                CREATE INDEX IF NOT EXISTS idx_markets_active ON markets(active);
                CREATE INDEX IF NOT EXISTS idx_markets_watched ON markets(watched);
                CREATE INDEX IF NOT EXISTS idx_markets_event_slug ON markets(event_slug);
                CREATE INDEX IF NOT EXISTS idx_markets_created_at ON markets(created_at);
            `);

            await client.query('COMMIT');
            console.log('Database schema initialized (PostgreSQL)');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    async subscribe(guildId, channelId, targetType, targetSlug) {
        const query = `
            INSERT INTO subscriptions (guild_id, channel_id, target_type, target_slug)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (guild_id, channel_id, target_type, target_slug) DO NOTHING
        `;
        const res = await this.pool.query(query, [guildId, channelId, targetType, targetSlug]);
        return (res.rowCount || 0) > 0;
    }

    async unsubscribe(guildId, channelId, targetType, targetSlug) {
        const query = `
            DELETE FROM subscriptions 
            WHERE guild_id = $1 AND channel_id = $2 AND target_type = $3 AND target_slug = $4
        `;
        const res = await this.pool.query(query, [guildId, channelId, targetType, targetSlug]);
        return (res.rowCount || 0) > 0;
    }

    async getSubscribers(targetSlug) {
        const query = `
            SELECT DISTINCT channel_id, guild_id FROM subscriptions
            WHERE target_slug = $1
        `;
        const res = await this.pool.query(query, [targetSlug]);
        return res.rows;
    }

    async hasSubscribers(targetSlug) {
        const query = `
            SELECT 1 FROM subscriptions WHERE target_slug = $1 LIMIT 1
        `;
        const res = await this.pool.query(query, [targetSlug]);
        return res.rows.length > 0;
    }

    async getSetting(key) {
        const res = await this.pool.query('SELECT value FROM settings WHERE key = $1', [key]);
        return res.rows[0] ? res.rows[0].value : null;
    }

    async setSetting(key, value) {
        const query = `
            INSERT INTO settings (key, value, updated_at)
            VALUES ($1, $2, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET
                value = EXCLUDED.value,
                updated_at = EXCLUDED.updated_at
        `;
        await this.pool.query(query, [key, String(value)]);
    }

    async addMarket(conditionId, slug = null, description = null, clobTokenIds = null, eventSlug = null, threshold = null, endDate = null, image = null, groupDate = null) {
        const normalizedConditionId = this.normalizeConditionId(conditionId);

        if (threshold === null) {
            const globalIdx = await this.getSetting('minAmountThreshold');
            if (globalIdx) threshold = parseFloat(globalIdx);
        }

        const query = `
            INSERT INTO markets (condition_id, slug, description, clob_token_ids, event_slug, threshold, end_date, image, group_date, active, watched, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, 1, CURRENT_TIMESTAMP)
            ON CONFLICT(condition_id) DO UPDATE SET
                slug = COALESCE(EXCLUDED.slug, markets.slug),
                description = COALESCE(EXCLUDED.description, markets.description),
                clob_token_ids = COALESCE(EXCLUDED.clob_token_ids, markets.clob_token_ids),
                event_slug = COALESCE(EXCLUDED.event_slug, markets.event_slug),
                threshold = COALESCE(EXCLUDED.threshold, markets.threshold),
                end_date = COALESCE(EXCLUDED.end_date, markets.end_date),
                image = COALESCE(EXCLUDED.image, markets.image),
                group_date = COALESCE(EXCLUDED.group_date, markets.group_date),
                active = 1,
                watched = 1,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id
        `;

        try {
            const res = await this.pool.query(query, [
                normalizedConditionId, slug, description, clobTokenIds, eventSlug, threshold, endDate, image, groupDate
            ]);

            this.fuseCache = null; // Invalidate cache

            return {
                id: res.rows[0].id,
                conditionId: normalizedConditionId,
                slug,
                description,
                clobTokenIds,
                eventSlug,
                threshold,
                endDate,
                image,
                groupDate,
                active: true,
                watched: true
            };
        } catch (error) {
            if (error.code === '23505') { // Unique constraint violation code
                throw new Error(`Market ${conditionId} already exists`);
            }
            throw error;
        }
    }

    async upsertMarkets(markets, options = { fullSync: false }) {
        const globalDefaultThreshold = await this.getSetting('minAmountThreshold');
        const defaultThreshold = globalDefaultThreshold ? parseFloat(globalDefaultThreshold) : null;

        const client = await this.pool.connect();

        try {
            await client.query('BEGIN');
            this.fuseCache = null; // Invalidate cache

            if (options.fullSync) {
                await client.query('UPDATE markets SET active = 0 WHERE active = 1');
            }

            const results = [];
            // Postgres supports bulk inserts but doing one-by-one with transaction is acceptable for now
            // Or we could use UNNEST for performance, but let's stick to simple first.

            const query = `
                INSERT INTO markets (condition_id, slug, description, clob_token_ids, event_slug, threshold, end_date, image, group_date, active, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, CURRENT_TIMESTAMP)
                ON CONFLICT(condition_id) DO UPDATE SET
                    slug = COALESCE(EXCLUDED.slug, markets.slug),
                    description = COALESCE(EXCLUDED.description, markets.description),
                    clob_token_ids = COALESCE(EXCLUDED.clob_token_ids, markets.clob_token_ids),
                    event_slug = COALESCE(EXCLUDED.event_slug, markets.event_slug),
                    threshold = COALESCE(EXCLUDED.threshold, markets.threshold),
                    end_date = COALESCE(EXCLUDED.end_date, markets.end_date),
                    image = COALESCE(EXCLUDED.image, markets.image),
                    group_date = COALESCE(EXCLUDED.group_date, markets.group_date),
                    active = 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE 
                    markets.slug IS DISTINCT FROM EXCLUDED.slug OR
                    markets.description IS DISTINCT FROM EXCLUDED.description OR
                    markets.clob_token_ids IS DISTINCT FROM EXCLUDED.clob_token_ids OR
                    markets.event_slug IS DISTINCT FROM EXCLUDED.event_slug OR
                    markets.threshold IS DISTINCT FROM EXCLUDED.threshold OR
                    markets.end_date IS DISTINCT FROM EXCLUDED.end_date OR
                    markets.image IS DISTINCT FROM EXCLUDED.image OR
                    markets.group_date IS DISTINCT FROM EXCLUDED.group_date OR
                    markets.active != 1
            `;

            for (const market of markets) {
                let { threshold } = market;
                if (threshold === null || threshold === undefined) {
                    threshold = defaultThreshold;
                }

                const normalizedConditionId = this.normalizeConditionId(market.conditionId);

                await client.query(query, [
                    normalizedConditionId,
                    market.slug,
                    market.description,
                    market.clobTokenIds,
                    market.eventSlug,
                    threshold,
                    market.endDate,
                    market.image,
                    market.groupDate
                ]);

                results.push(normalizedConditionId);
            }

            await client.query('COMMIT');
            return results;
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    normalizeConditionId(conditionId) {
        if (typeof conditionId === 'string') {
            if (conditionId.startsWith('0x')) {
                return conditionId.toLowerCase();
            }
            return '0x' + conditionId.toLowerCase();
        }
        return conditionId;
    }

    async removeMarket(conditionId) {
        const normalizedConditionId = this.normalizeConditionId(conditionId);

        const res = await this.pool.query(`
            UPDATE markets 
            SET active = 0, watched = 0, updated_at = CURRENT_TIMESTAMP
            WHERE condition_id = $1
        `, [normalizedConditionId]);

        if (res.rowCount === 0) {
            throw new Error(`Market ${conditionId} not found`);
        }
        this.fuseCache = null; // Invalidate cache

        return true;
    }

    async setMarketWatched(conditionId, watched) {
        const normalizedConditionId = this.normalizeConditionId(conditionId);
        const val = watched ? 1 : 0;

        const res = await this.pool.query(`
            UPDATE markets SET watched = $1, updated_at = CURRENT_TIMESTAMP WHERE condition_id = $2
        `, [val, normalizedConditionId]);

        if (res.rowCount === 0) {
            throw new Error(`Market ${conditionId} not found`);
        }
        return true;
    }

    async setMarketThreshold(conditionId, amount) {
        const normalizedConditionId = this.normalizeConditionId(conditionId);

        const res = await this.pool.query(`
            UPDATE markets SET threshold = $1, updated_at = CURRENT_TIMESTAMP WHERE condition_id = $2
        `, [amount, normalizedConditionId]);

        if (res.rowCount === 0) {
            throw new Error(`Market ${conditionId} not found`);
        }
        return true;
    }

    async setEventThreshold(eventSlug, amount) {
        const res = await this.pool.query(`
            UPDATE markets SET threshold = $1, updated_at = CURRENT_TIMESTAMP WHERE event_slug = $2 AND active = 1
        `, [amount, eventSlug]);
        return res.rowCount;
    }

    async findMarketBySlugPartial(partialSlug) {
        const res = await this.pool.query(`
            SELECT * FROM markets WHERE slug LIKE $1 AND active = 1 LIMIT 1
        `, [`%${partialSlug}%`]);
        return res.rows[0];
    }

    async findDistinctEventsByMarketSlugPartial(partialSlug) {
        const res = await this.pool.query(`
            SELECT DISTINCT event_slug FROM markets WHERE slug LIKE $1 AND active = 1
        `, [`%${partialSlug}%`]);
        return res.rows;
    }

    async getWatchedMarkets() {
        const res = await this.pool.query(`
            SELECT id, condition_id, slug, description, clob_token_ids, event_slug, threshold, image, end_date, group_date, created_at, updated_at
            FROM markets
            WHERE watched = 1 AND active = 1
            ORDER BY created_at DESC
        `);
        return res.rows;
    }

    async getAllMarkets() {
        const res = await this.pool.query(`
            SELECT id, condition_id, slug, description, clob_token_ids, event_slug, threshold, image, end_date, group_date, active, created_at, updated_at
            FROM markets
            ORDER BY created_at DESC
        `);
        return res.rows;
    }

    async getMarket(conditionId) {
        const normalizedConditionId = this.normalizeConditionId(conditionId);
        const res = await this.pool.query(`
            SELECT id, condition_id, slug, description, clob_token_ids, event_slug, threshold, image, end_date, group_date, active, created_at, updated_at
            FROM markets
            WHERE condition_id = $1
        `, [normalizedConditionId]);
        return res.rows[0];
    }

    async close() {
        await this.pool.end();
    }

    async getMarketsByEventSlug(eventSlug) {
        const res = await this.pool.query(`
            SELECT id, condition_id, slug, description, clob_token_ids, event_slug, threshold, image, end_date, group_date, active, watched, created_at, updated_at
            FROM markets
            WHERE event_slug = $1 AND active = 1
        `, [eventSlug]);
        return res.rows;
    }

    async searchMarkets(query, limit = 20) {
        // "Search Light, Fetch Heavy" Pattern

        // 1. Initialize Fuse cache with minimal data if needed
        if (!this.fuseCache) {
            // Select ONLY lightweight fields to prevent OOM
            const res = await this.pool.query(`
                SELECT id, slug, event_slug FROM markets WHERE active = 1
            `);
            const lightMarkets = res.rows;

            if (lightMarkets.length === 0) return [];

            const fuseOptions = {
                keys: [
                    { name: 'slug', weight: 0.6 },
                    { name: 'event_slug', weight: 0.4 }
                ],
                threshold: 0.4, // Allow fuzzy typos
                ignoreLocation: true,
                includeScore: true
            };

            this.fuseCache = new Fuse(lightMarkets, fuseOptions);
        }

        // 2. Perform fuzzy search on lightweight objects
        const results = this.fuseCache.search(query);

        if (results.length === 0) return [];

        // 3. Take top results and fetch full data
        const topResults = results.slice(0, limit);
        const ids = topResults.map(r => r.item.id);

        if (ids.length === 0) return [];

        // Fetch full details for just these IDs
        // "SELECT ... WHERE id = ANY($1)"
        const res = await this.pool.query(`
            SELECT id, condition_id, slug, description, clob_token_ids, event_slug, threshold, image, end_date, group_date, active, watched, created_at, updated_at
            FROM markets
            WHERE id = ANY($1)
        `, [ids]);

        const fullMarkets = res.rows;

        // 4. Re-sort to match Fuse ranking (since SQL return order isn't guaranteed)
        const marketMap = new Map(fullMarkets.map(m => [m.id, m]));

        return topResults
            .map(r => marketMap.get(r.item.id))
            .filter(Boolean);
    }
}

export const marketRegistry = new MarketRegistry();
