import pg from 'pg';
const { Pool } = pg;
import { config } from '../config.js';
import crypto from 'crypto';

class MarketRegistry {
    constructor() {
        this.pool = new Pool({
            host: config.db.host,
            port: config.db.port,
            user: config.db.user,
            password: config.db.password,
            database: config.db.database
        });

        // Error handling for idle clients
        this.pool.on('error', (err, client) => {
            console.error('Unexpected error on idle client', err);
            process.exit(-1);
        });

        this.marketsCache = null;
    }

    async initialize() {
        await this.waitForDatabase();
        await this.initializeSchema();
    }

    async waitForDatabase(retries = 10, delay = 2000) {
        for (let i = 0; i < retries; i++) {
            try {
                const client = await this.pool.connect();
                client.release();
                console.log('[Registry] Database connected successfully.');
                return;
            } catch (err) {
                console.log(`[Registry] Waiting for database... (${i + 1}/${retries}) - ${err.message}`);
                await new Promise(res => setTimeout(res, delay));
            }
        }
        throw new Error('Could not connect to database after multiple retries.');
    }

    async initializeSchema() {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // 1. MARKETS (Removed clob_token_ids, yes_price, no_price)
            await client.query(`
                CREATE TABLE IF NOT EXISTS markets (
                    id SERIAL PRIMARY KEY,
                    condition_id VARCHAR(255) NOT NULL UNIQUE,
                    slug TEXT,
                    event_slug TEXT,
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

            // 2. MARKET_TOKENS (New, Normalized)
            await client.query(`
                CREATE TABLE IF NOT EXISTS market_tokens (
                    id SERIAL PRIMARY KEY,
                    condition_id VARCHAR(255) REFERENCES markets(condition_id) ON DELETE CASCADE,
                    token_id VARCHAR(255) NOT NULL UNIQUE,
                    outcome VARCHAR(50), -- YES, NO
                    price REAL, -- Last known price (for cold start), NOT for realtime
                    liquidity REAL,
                    active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            // 3. SETTINGS (Scoped)
            await client.query(`
                CREATE TABLE IF NOT EXISTS settings (
                    id SERIAL PRIMARY KEY,
                    scope VARCHAR(50) DEFAULT 'global', -- global, guild, user
                    scope_id VARCHAR(255), -- NULL for global, guild_id, or user_id
                    key VARCHAR(255) NOT NULL,
                    value TEXT,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(scope, scope_id, key)
                );
            `);

            // 4. SUBSCRIPTIONS (Strengthened Targeting)
            await client.query(`
                CREATE TABLE IF NOT EXISTS subscriptions (
                    id SERIAL PRIMARY KEY,
                    guild_id VARCHAR(255) NOT NULL,
                    channel_id VARCHAR(255) NOT NULL,
                    target_type VARCHAR(50) NOT NULL, -- 'market' or 'event'
                    target_id VARCHAR(255) NOT NULL, -- condition_id or event_slug
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(guild_id, channel_id, target_type, target_id)
                );
            `);

            // 5. USERS (Enhanced Security)
            await client.query(`
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(255) UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    role VARCHAR(50) DEFAULT 'user', -- admin, user
                    disabled BOOLEAN DEFAULT FALSE,
                    last_login TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            // 6. USER_PINS (References Users & Markets)
            await client.query(`
                CREATE TABLE IF NOT EXISTS user_pins (
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    condition_id VARCHAR(255) REFERENCES markets(condition_id) ON DELETE CASCADE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (user_id, condition_id)
                );
            `);

            // 7. SYSTEM_EVENTS (Observability)
            await client.query(`
                CREATE TABLE IF NOT EXISTS system_events (
                    id SERIAL PRIMARY KEY,
                    type VARCHAR(50) NOT NULL, -- alert_sent, whale_detected, error
                    reference_id VARCHAR(255), -- condition_id or token_id
                    payload JSONB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            // Indices
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_markets_condition_id ON markets(condition_id);
                CREATE INDEX IF NOT EXISTS idx_markets_slug ON markets(slug);
                CREATE INDEX IF NOT EXISTS idx_markets_event_slug ON markets(event_slug);
                CREATE INDEX IF NOT EXISTS idx_markets_created_at ON markets(created_at);
                CREATE INDEX IF NOT EXISTS idx_markets_active ON markets(active);
                CREATE INDEX IF NOT EXISTS idx_markets_watched ON markets(watched);
                CREATE INDEX IF NOT EXISTS idx_market_tokens_token_id ON market_tokens(token_id);
                CREATE INDEX IF NOT EXISTS idx_subscriptions_composite ON subscriptions(guild_id, channel_id);
                CREATE INDEX IF NOT EXISTS idx_user_pins_user_id ON user_pins(user_id);
            `);

            await client.query('COMMIT');
            console.log('Database schema initialized (Refactored v2)');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    // --- Subscriptions ---

    async subscribe(guildId, channelId, targetType, targetId) {
        // targetId is condition_id (market) or event_slug (event)
        const query = `
            INSERT INTO subscriptions (guild_id, channel_id, target_type, target_id)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (guild_id, channel_id, target_type, target_id) DO NOTHING
        `;
        const res = await this.pool.query(query, [guildId, channelId, targetType, targetId]);
        return (res.rowCount || 0) > 0;
    }

    async unsubscribe(guildId, channelId, targetType, targetId) {
        const query = `
            DELETE FROM subscriptions 
            WHERE guild_id = $1 AND channel_id = $2 AND target_type = $3 AND target_id = $4
        `;
        const res = await this.pool.query(query, [guildId, channelId, targetType, targetId]);
        return (res.rowCount || 0) > 0;
    }

    async getSubscribers(targetId) {
        const query = `
            SELECT DISTINCT channel_id, guild_id FROM subscriptions
            WHERE target_id = $1
        `;
        const res = await this.pool.query(query, [targetId]);
        return res.rows;
    }

    async hasSubscribers(targetId) {
        const query = `
            SELECT 1 FROM subscriptions WHERE target_id = $1 LIMIT 1
        `;
        const res = await this.pool.query(query, [targetId]);
        return res.rows.length > 0;
    }

    // --- Settings (Scoped) ---

    async getSetting(key, scope = 'global', scopeId = null) {
        // Fallback Strategy: Check Specific Scope -> Check Global
        // For simplicity, let's just query exactly what is asked.
        const query = `
            SELECT value FROM settings 
            WHERE key = $1 AND scope = $2 AND scope_id IS NOT DISTINCT FROM $3
        `;
        // IS NOT DISTINCT FROM allows comparing NULLs correctly
        const res = await this.pool.query(query, [key, scope, scopeId]);

        if (res.rows.length > 0) return res.rows[0].value;

        // If not found in scope, try global (if we weren't already looking for global)
        if (scope !== 'global') {
            const globalRes = await this.pool.query(`
                SELECT value FROM settings WHERE key = $1 AND scope = 'global'
            `, [key]);
            if (globalRes.rows.length > 0) return globalRes.rows[0].value;
        }

        return null;
    }

    async setSetting(key, value, scope = 'global', scopeId = null) {
        const query = `
            INSERT INTO settings (key, value, scope, scope_id, updated_at)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
            ON CONFLICT(scope, scope_id, key) DO UPDATE SET
                value = EXCLUDED.value,
                updated_at = EXCLUDED.updated_at
        `;
        await this.pool.query(query, [key, String(value), scope, scopeId]);
    }

    // --- Data Ingestion (Refactored for Market Tokens) ---

    async addMarket(conditionId, slug = null, description = null, clobTokenIds = null, eventSlug = null, threshold = null, endDate = null, image = null, groupDate = null) {
        // Wrapper for upsert to keep API somewhat compatible or similar logic
        const marketObj = {
            conditionId, slug, description, clobTokenIds, eventSlug, threshold, endDate, image, groupDate
        };
        // marketCache will be invalidated in upsertMarkets
        const res = await this.upsertMarkets([marketObj]);
        if (res.length > 0) {
            return await this.getMarket(conditionId);
        }
        return null;
    }

    async upsertMarkets(markets, options = { fullSync: false, setWatched: true }) {
        const globalDefaultThreshold = await this.getSetting('minAmountThreshold');
        const defaultThreshold = globalDefaultThreshold ? parseFloat(globalDefaultThreshold) : null;

        const client = await this.pool.connect();

        this.marketsCache = null; // Invalidate cache

        try {
            await client.query('BEGIN');

            if (options.fullSync) {
                await client.query('UPDATE markets SET active = 0 WHERE active = 1');
            }

            const activeConditionIds = [];

            // When setWatched is false, preserve existing watched value; otherwise set to 1
            const marketQuery = `
                INSERT INTO markets (condition_id, slug, description, event_slug, threshold, end_date, image, group_date, active, watched, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, ${options.setWatched ? '1' : 'COALESCE((SELECT watched FROM markets WHERE condition_id = $1::varchar), 0)'}, CURRENT_TIMESTAMP)
                ON CONFLICT(condition_id) DO UPDATE SET
                    slug = COALESCE(EXCLUDED.slug, markets.slug),
                    description = COALESCE(EXCLUDED.description, markets.description),
                    event_slug = COALESCE(EXCLUDED.event_slug, markets.event_slug),
                    threshold = COALESCE(EXCLUDED.threshold, markets.threshold),
                    end_date = COALESCE(EXCLUDED.end_date, markets.end_date),
                    image = COALESCE(EXCLUDED.image, markets.image),
                    group_date = COALESCE(EXCLUDED.group_date, markets.group_date),
                    active = 1,
                    ${options.setWatched ? 'watched = 1,' : ''}
                    updated_at = CURRENT_TIMESTAMP
                RETURNING condition_id
            `;

            const tokenQuery = `
                INSERT INTO market_tokens (condition_id, token_id, outcome, price, active)
                VALUES ($1, $2, $3, $4, TRUE)
                ON CONFLICT (token_id) DO UPDATE SET
                    active = TRUE,
                    price = COALESCE(EXCLUDED.price, market_tokens.price),
                    condition_id = EXCLUDED.condition_id
            `;

            for (const market of markets) {
                let { threshold } = market;
                if (threshold === null || threshold === undefined) {
                    threshold = defaultThreshold;
                }

                const normalizedConditionId = this.normalizeConditionId(market.conditionId);

                await client.query(marketQuery, [
                    normalizedConditionId,
                    market.slug,
                    market.description,
                    market.eventSlug,
                    threshold,
                    market.endDate,
                    market.image,
                    market.groupDate
                ]);

                // Handle Tokens & Prices
                if (market.clobTokenIds) {
                    let tokens = [];
                    let prices = [];
                    try {
                        tokens = typeof market.clobTokenIds === 'string'
                            ? JSON.parse(market.clobTokenIds)
                            : market.clobTokenIds;

                        prices = typeof market.outcomePrices === 'string'
                            ? JSON.parse(market.outcomePrices)
                            : (market.outcomePrices || []);
                    } catch (e) {
                        console.warn(`Failed to parse clobTokenIds/prices for ${normalizedConditionId}`, e);
                    }

                    if (Array.isArray(tokens) && tokens.length >= 2) {
                        const yesId = tokens[0]?.toString();
                        const noId = tokens[1]?.toString();

                        // Parse prices safely (ensure float)
                        const yesPrice = prices[0] ? parseFloat(prices[0]) : null;
                        const noPrice = prices[1] ? parseFloat(prices[1]) : null;

                        if (yesId) await client.query(tokenQuery, [normalizedConditionId, yesId, 'YES', yesPrice]);
                        if (noId) await client.query(tokenQuery, [normalizedConditionId, noId, 'NO', noPrice]);
                    }
                }

                activeConditionIds.push(normalizedConditionId);
            }

            await client.query('COMMIT');
            return activeConditionIds;
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
        this.marketsCache = null; // Invalidate cache
        await this.pool.query('BEGIN');
        try {
            const res = await this.pool.query(`
                UPDATE markets 
                SET active = 0, watched = 0, updated_at = CURRENT_TIMESTAMP
                WHERE condition_id = $1
            `, [normalizedConditionId]);

            // Also deactivate tokens?
            await this.pool.query(`
                UPDATE market_tokens SET active = FALSE WHERE condition_id = $1
            `, [normalizedConditionId]);

            await this.pool.query('COMMIT');

            if (res.rowCount === 0) throw new Error(`Market ${conditionId} not found`);
            return true;
        } catch (e) {
            await this.pool.query('ROLLBACK');
            throw e;
        }
    }

    async setMarketWatched(conditionId, watched) {
        this.marketsCache = null; // Invalidate cache
        const normalizedConditionId = this.normalizeConditionId(conditionId);
        const val = watched ? 1 : 0;
        const res = await this.pool.query(`
            UPDATE markets SET watched = $1, updated_at = CURRENT_TIMESTAMP WHERE condition_id = $2
        `, [val, normalizedConditionId]);
        if (res.rowCount === 0) throw new Error(`Market ${conditionId} not found`);
        return true;
    }

    async setMarketThreshold(conditionId, amount) {
        this.marketsCache = null; // Invalidate cache
        const normalizedConditionId = this.normalizeConditionId(conditionId);
        const res = await this.pool.query(`
            UPDATE markets SET threshold = $1, updated_at = CURRENT_TIMESTAMP WHERE condition_id = $2
        `, [amount, normalizedConditionId]);
        if (res.rowCount === 0) throw new Error(`Market ${conditionId} not found`);
        return true;
    }

    async setEventThreshold(eventSlug, amount) {
        this.marketsCache = null; // Invalidate cache
        const res = await this.pool.query(`
            UPDATE markets SET threshold = $1, updated_at = CURRENT_TIMESTAMP WHERE event_slug = $2 AND active = 1
        `, [amount, eventSlug]);
        return res.rowCount;
    }

    async deactivateStaleMarkets(activeConditionIds) {
        if (!activeConditionIds || activeConditionIds.length === 0) return 0;

        this.marketsCache = null; // Invalidate cache
        const normalizedIds = activeConditionIds.map(id => this.normalizeConditionId(id));

        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            console.log(`[Registry] Deactivating stale markets (Active count: ${normalizedIds.length})...`);

            // 1. Find markets to deactivate (for logging/events) - Optional but good for debugging
            // skipping for performance, just update.

            // 2. Update markets
            // WHERE active = 1 AND condition_id NOT IN (...)
            const res = await client.query(`
                UPDATE markets 
                SET active = 0, watched = 0, updated_at = CURRENT_TIMESTAMP
                WHERE active = 1 AND condition_id != ALL($1)
            `, [normalizedIds]);

            // 3. Deactivate tokens
            if (res.rowCount > 0) {
                await client.query(`
                    UPDATE market_tokens 
                    SET active = FALSE 
                    WHERE condition_id IN (
                        SELECT condition_id FROM markets WHERE active = 0 AND updated_at = CURRENT_TIMESTAMP
                    )
                `);
            }

            await client.query('COMMIT');
            console.log(`[Registry] Deactivated ${res.rowCount} stale markets.`);
            return res.rowCount;
        } catch (e) {
            await client.query('ROLLBACK');
            console.error('[Registry] Failed to deactivate stale markets:', e);
            throw e;
        } finally {
            client.release();
        }
    }

    async pruneWatchedMarkets(keepConditionIds) {
        if (!keepConditionIds) return 0;
        const normalizedIds = keepConditionIds.map(id => this.normalizeConditionId(id));

        const client = await this.pool.connect();
        try {
            // Set watched=0 for markets that are:
            // 1. Currently watched=1
            // 2. NOT in the new 'keep' list (Top X)
            // 3. NOT pinned by any user (safeguard)
            const res = await client.query(`
                UPDATE markets 
                SET watched = 0, updated_at = CURRENT_TIMESTAMP
                WHERE watched = 1 
                AND condition_id != ALL($1)
                AND condition_id NOT IN (SELECT DISTINCT condition_id FROM user_pins)
                AND slug NOT IN (SELECT target_id FROM subscriptions WHERE target_type = 'market')
                RETURNING condition_id
            `, [normalizedIds]);

            if (res.rowCount > 0) {
                console.log(`[Registry] Pruned ${res.rowCount} markets from watch list.`);
            }
            return res.rows.map(r => r.condition_id);
        } catch (e) {
            console.error('[Registry] Failed to prune watched markets:', e);
            return [];
        } finally {
            client.release();
        }
    }

    // --- Search & Retrieval ---

    async findMarketBySlugPartial(partialSlug) {
        const res = await this.pool.query(`
            SELECT * FROM markets WHERE slug LIKE $1 AND active = 1 LIMIT 1
        `, [`%${partialSlug}%`]);
        return res.rows[0];
    }

    async getWatchedMarkets() {
        if (this.marketsCache) {
            return this.marketsCache;
        }

        // Need to recreate the "clob_token_ids" string or array for compatibility if needed
        // Or updated callers to use market_tokens.
        // For now, let's aggregate tokens back into an array to keep compatibility with existing consumers
        // doing JSON.parse(clob_token_ids).
        const res = await this.pool.query(`
            SELECT m.*, 
                   json_agg(t.token_id ORDER BY t.outcome DESC) as clob_token_ids_json,
                   MAX(CASE WHEN t.outcome = 'YES' THEN t.price END) as yes_price,
                   MAX(CASE WHEN t.outcome = 'NO' THEN t.price END) as no_price,
                   MAX(CASE WHEN t.outcome = 'YES' THEN t.token_id END) as yes_asset_id,
                   MAX(CASE WHEN t.outcome = 'NO' THEN t.token_id END) as no_asset_id
            FROM markets m
            LEFT JOIN market_tokens t ON m.condition_id = t.condition_id
            WHERE m.watched = 1 AND m.active = 1
            GROUP BY m.id
            ORDER BY m.created_at DESC
        `);

        // Map back to expected format AND PRE-PARSE JSON
        this.marketsCache = res.rows.map(row => ({
            ...row,
            clob_token_ids: JSON.stringify(row.clob_token_ids_json), // Keep for legacy if needed, or remove if unused
            parsed_clob_token_ids: row.clob_token_ids_json // Ready-to-use array
        }));

        return this.marketsCache;
    }

    async getActiveMarkets() {
        // For frontend: Return ALL active markets (not just watched)
        const res = await this.pool.query(`
            SELECT m.*, 
                   json_agg(t.token_id ORDER BY t.outcome DESC) as clob_token_ids_json,
                   MAX(CASE WHEN t.outcome = 'YES' THEN t.price END) as yes_price,
                   MAX(CASE WHEN t.outcome = 'NO' THEN t.price END) as no_price,
                   MAX(CASE WHEN t.outcome = 'YES' THEN t.token_id END) as yes_asset_id,
                   MAX(CASE WHEN t.outcome = 'NO' THEN t.token_id END) as no_asset_id
            FROM markets m
            LEFT JOIN market_tokens t ON m.condition_id = t.condition_id
            WHERE m.active = 1
            GROUP BY m.id
            ORDER BY m.created_at DESC
        `);

        return res.rows.map(row => ({
            ...row,
            clob_token_ids: JSON.stringify(row.clob_token_ids_json),
            parsed_clob_token_ids: row.clob_token_ids_json
        }));
    }

    async getMarket(conditionId) {
        const normalizedConditionId = this.normalizeConditionId(conditionId);
        const res = await this.pool.query(`
            SELECT m.*, 
                   json_agg(t.token_id ORDER BY t.outcome DESC) as clob_token_ids_json
            FROM markets m
            LEFT JOIN market_tokens t ON m.condition_id = t.condition_id
            WHERE m.condition_id = $1
            GROUP BY m.id
        `, [normalizedConditionId]);

        if (res.rows.length === 0) return null;
        const row = res.rows[0];
        return {
            ...row,
            clob_token_ids: JSON.stringify(row.clob_token_ids_json)
        };
    }

    async getMarketsByConditionIds(conditionIds) {
        if (!conditionIds || conditionIds.length === 0) return [];
        const normalizedIds = conditionIds.map(id => this.normalizeConditionId(id));

        const res = await this.pool.query(`
            SELECT m.*, 
                   json_agg(t.token_id ORDER BY t.outcome DESC) as clob_token_ids_json
            FROM markets m
            LEFT JOIN market_tokens t ON m.condition_id = t.condition_id
            WHERE m.condition_id = ANY($1)
            GROUP BY m.id
        `, [normalizedIds]);

        return res.rows.map(row => ({
            ...row,
            clob_token_ids: JSON.stringify(row.clob_token_ids_json)
        }));
    }

    // --- Users ---

    async registerUser(username, password) {
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
        const storedPassword = `${salt}:${hash}`;

        try {
            const res = await this.pool.query(
                `INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'user') RETURNING id, username, role`,
                [username, storedPassword]
            );
            return res.rows[0];
        } catch (error) {
            if (error.code === '23505') throw new Error('Username already taken');
            throw error;
        }
    }

    async authenticateUser(username, password) {
        const res = await this.pool.query(`SELECT id, username, password_hash, role, disabled FROM users WHERE username = $1`, [username]);
        if (res.rows.length === 0) return null;

        const user = res.rows[0];
        if (user.disabled) throw new Error('Account disabled');

        const [salt, key] = user.password_hash.split(':');
        const derivedKey = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');

        if (key === derivedKey) {
            // Update last_login
            await this.pool.query(`UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1`, [user.id]);
            return { id: user.id, username: user.username, role: user.role };
        }
        return null;
    }

    async toggleUserPin(userId, conditionId) {
        const normalized = this.normalizeConditionId(conditionId);
        const check = await this.pool.query(
            `SELECT 1 FROM user_pins WHERE user_id = $1 AND condition_id = $2`,
            [userId, normalized]
        );

        if (check.rows.length > 0) {
            await this.pool.query(`DELETE FROM user_pins WHERE user_id = $1 AND condition_id = $2`, [userId, normalized]);
            return false;
        } else {
            // Check if market exists effectively? FK handles it, but maybe verify?
            await this.pool.query(`INSERT INTO user_pins (user_id, condition_id) VALUES ($1, $2)`, [userId, normalized]);
            return true;
        }
    }

    async getUserPins(userId) {
        const res = await this.pool.query(`SELECT condition_id FROM user_pins WHERE user_id = $1`, [userId]);
        return res.rows.map(r => r.condition_id);
    }

    // --- Observability ---

    async logSystemEvent(type, referenceId, payload) {
        try {
            await this.pool.query(`
                INSERT INTO system_events (type, reference_id, payload) VALUES ($1, $2, $3)
            `, [type, referenceId, JSON.stringify(payload)]);
        } catch (e) {
            console.error('Failed to log system event', e);
        }
    }

    // Legacy support methods if needed...
    async getMarketsByEventSlug(eventSlug) {
        const res = await this.pool.query(`
            SELECT m.*, 
                   json_agg(t.token_id ORDER BY t.outcome DESC) as clob_token_ids_json
            FROM markets m
            LEFT JOIN market_tokens t ON m.condition_id = t.condition_id
            WHERE m.event_slug = $1 AND m.active = 1
            GROUP BY m.id
        `, [eventSlug]);
        return res.rows.map(row => ({
            ...row,
            clob_token_ids: JSON.stringify(row.clob_token_ids_json)
        }));
        return res.rows;
    }

    async close() {
        await this.pool.end();
    }
}

export const marketRegistry = new MarketRegistry();
