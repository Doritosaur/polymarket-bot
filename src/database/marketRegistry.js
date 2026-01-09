import { Database } from 'bun:sqlite';
import { join } from 'path';
import Fuse from 'fuse.js';

class MarketRegistry {
    constructor() {
        const dbPath = join(import.meta.dir, '../..', 'data', 'markets.db');
        this.db = new Database(dbPath);
        this.db.exec("PRAGMA journal_mode = WAL;");
        this.fuseCache = null;
        this.initializeSchema();
    }

    initializeSchema() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS markets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        condition_id TEXT NOT NULL UNIQUE,
        slug TEXT,
        event_slug TEXT,
        clob_token_ids TEXT,
        description TEXT,
        threshold REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        active INTEGER DEFAULT 1,
        watched INTEGER DEFAULT 0,
        end_date TEXT,
        image TEXT,
        group_date TEXT
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        target_type TEXT NOT NULL, -- 'market' or 'event'
        target_slug TEXT NOT NULL, -- slug of the market
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(guild_id, channel_id, target_type, target_slug)
      );
      
      CREATE INDEX IF NOT EXISTS idx_subscriptions_target ON subscriptions(target_slug);
    `);

        // Migration logic
        try {
            const tableInfo = this.db.prepare("PRAGMA table_info(markets)").all();
            const hasName = tableInfo.some(c => c.name === 'name');
            const hasSlug = tableInfo.some(c => c.name === 'slug');
            const hasClobTokenIds = tableInfo.some(c => c.name === 'clob_token_ids');
            const hasEventSlug = tableInfo.some(c => c.name === 'event_slug');
            const hasThreshold = tableInfo.some(c => c.name === 'threshold');
            const hasEndDate = tableInfo.some(c => c.name === 'end_date');
            const hasImage = tableInfo.some(c => c.name === 'image');
            const hasGroupDate = tableInfo.some(c => c.name === 'group_date');
            const hasWatched = tableInfo.some(c => c.name === 'watched');

            if (hasName && !hasSlug) {
                console.log('Migrating database: renaming column name to slug...');
                this.db.exec('ALTER TABLE markets RENAME COLUMN name TO slug');
            }

            if (!hasClobTokenIds) {
                console.log('Migrating database: adding column clob_token_ids...');
                this.db.exec('ALTER TABLE markets ADD COLUMN clob_token_ids TEXT');
            }

            if (!hasEventSlug) {
                console.log('Migrating database: adding column event_slug...');
                this.db.exec('ALTER TABLE markets ADD COLUMN event_slug TEXT');
            }

            if (!hasThreshold) {
                console.log('Migrating database: adding column threshold...');
                this.db.exec('ALTER TABLE markets ADD COLUMN threshold REAL');

                // Backfill existing markets with current global default if available
                const globalDefault = this.getSetting('minAmountThreshold');
                if (globalDefault) {
                    console.log(`Backfilling existing markets with threshold: ${globalDefault}`);
                    this.db.exec(`UPDATE markets SET threshold = ${globalDefault} WHERE threshold IS NULL`);
                }
            }

            if (!hasEndDate) {
                console.log('Migrating database: adding column end_date...');
                this.db.exec('ALTER TABLE markets ADD COLUMN end_date TEXT');
            }

            if (!hasImage) {
                console.log('Migrating database: adding column image...');
                this.db.exec('ALTER TABLE markets ADD COLUMN image TEXT');
            }

            if (!hasGroupDate) {
                console.log('Migrating database: adding column group_date...');
                this.db.exec('ALTER TABLE markets ADD COLUMN group_date TEXT');
            }

            if (!hasWatched) {
                console.log('Migrating database: adding column watched...');
                this.db.exec('ALTER TABLE markets ADD COLUMN watched INTEGER DEFAULT 0');
                this.db.exec('UPDATE markets SET watched = 1 WHERE active = 1');
            }


            // Create indices AFTER ensuring columns exist
            this.db.exec(`
              CREATE INDEX IF NOT EXISTS idx_markets_condition_id ON markets(condition_id);
              CREATE INDEX IF NOT EXISTS idx_markets_active ON markets(active);
              CREATE INDEX IF NOT EXISTS idx_markets_watched ON markets(watched);
              CREATE INDEX IF NOT EXISTS idx_markets_event_slug ON markets(event_slug);
              CREATE INDEX IF NOT EXISTS idx_markets_created_at ON markets(created_at);
            `);

        } catch (err) {
            console.warn('Migration check failed (ignoring):', err.message);
        }

        console.log('Database schema initialized');
    }

    subscribe(guildId, channelId, targetType, targetSlug) {
        const stmt = this.db.prepare(`
            INSERT OR IGNORE INTO subscriptions (guild_id, channel_id, target_type, target_slug)
            VALUES (?, ?, ?, ?)
        `);
        const info = stmt.run(guildId, channelId, targetType, targetSlug);
        return info.changes > 0;
    }

    unsubscribe(guildId, channelId, targetType, targetSlug) {
        const stmt = this.db.prepare(`
            DELETE FROM subscriptions 
            WHERE guild_id = ? AND channel_id = ? AND target_type = ? AND target_slug = ?
        `);
        const info = stmt.run(guildId, channelId, targetType, targetSlug);
        return info.changes > 0;
    }

    getSubscribers(targetSlug) {
        const stmt = this.db.prepare(`
            SELECT DISTINCT channel_id, guild_id FROM subscriptions
            WHERE target_slug = ?
        `);
        return stmt.all(targetSlug);
    }

    hasSubscribers(targetSlug) {
        const stmt = this.db.prepare(`
            SELECT 1 FROM subscriptions WHERE target_slug = ? LIMIT 1
        `);
        return !!stmt.get(targetSlug);
    }

    getSetting(key) {
        const stmt = this.db.prepare('SELECT value FROM settings WHERE key = ?');
        const row = stmt.get(key);
        return row ? row.value : null;
    }

    setSetting(key, value) {
        const stmt = this.db.prepare(`
            INSERT INTO settings (key, value, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_at = excluded.updated_at
        `);
        stmt.run(key, String(value));
    }


    addMarket(conditionId, slug = null, description = null, clobTokenIds = null, eventSlug = null, threshold = null, endDate = null, image = null, groupDate = null) {
        try {
            const normalizedConditionId = this.normalizeConditionId(conditionId);

            if (threshold === null) {
                const globalIdx = this.getSetting('minAmountThreshold');
                if (globalIdx) threshold = parseFloat(globalIdx);
            }

            const stmt = this.db.prepare(`
        INSERT INTO markets (condition_id, slug, description, clob_token_ids, event_slug, threshold, end_date, image, group_date, active, watched)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)
        ON CONFLICT(condition_id) DO UPDATE SET
          slug = COALESCE(excluded.slug, slug),
          description = COALESCE(excluded.description, description),
          clob_token_ids = COALESCE(excluded.clob_token_ids, clob_token_ids),
          event_slug = COALESCE(excluded.event_slug, event_slug),
          threshold = COALESCE(excluded.threshold, threshold),
          end_date = COALESCE(excluded.end_date, end_date),
          image = COALESCE(excluded.image, image),
          group_date = COALESCE(excluded.group_date, group_date),
          active = 1,
          watched = 1,
          updated_at = CURRENT_TIMESTAMP
      `);

            stmt.run(normalizedConditionId, slug, description, clobTokenIds, eventSlug, threshold, endDate, image, groupDate);
            const id = this.db.lastInsertRowId;
            this.fuseCache = null; // Invalidate cache

            return {
                id: Number(id),
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
            if (error.message?.includes('UNIQUE constraint') || error.message?.includes('already exists')) {
                throw new Error(`Market ${conditionId} already exists`);
            }
            throw error;
        }
    }

    upsertMarkets(markets, options = { fullSync: false }) {
        const globalDefaultThreshold = this.getSetting('minAmountThreshold');
        const defaultThreshold = globalDefaultThreshold ? parseFloat(globalDefaultThreshold) : null;

        const upsertTransaction = this.db.transaction((marketsToUpsert) => {
            this.fuseCache = null; // Invalidate cache
            if (options.fullSync) {
                this.db.exec('UPDATE markets SET active = 0 WHERE active = 1');
            }

            const results = [];
            for (const market of marketsToUpsert) {
                let { threshold } = market;
                if (threshold === null || threshold === undefined) {
                    threshold = defaultThreshold;
                }

                const normalizedConditionId = this.normalizeConditionId(market.conditionId);

                const stmt = this.db.prepare(`
                    INSERT INTO markets (condition_id, slug, description, clob_token_ids, event_slug, threshold, end_date, image, group_date, active)
                    VALUES ($conditionId, $slug, $description, $clobTokenIds, $eventSlug, $threshold, $endDate, $image, $groupDate, 1)
                    ON CONFLICT(condition_id) DO UPDATE SET
                        slug = COALESCE($slug, slug),
                        description = COALESCE($description, description),
                        clob_token_ids = COALESCE($clobTokenIds, clob_token_ids),
                        event_slug = COALESCE(excluded.event_slug, event_slug),
                        threshold = COALESCE($threshold, threshold),
                        end_date = COALESCE(excluded.end_date, end_date),
                        image = COALESCE($image, image),
                        group_date = COALESCE(excluded.group_date, group_date),
                        active = 1,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE 
                        slug != excluded.slug OR
                        description != excluded.description OR
                        clob_token_ids != excluded.clob_token_ids OR
                        event_slug != excluded.event_slug OR
                        threshold != excluded.threshold OR
                        end_date != excluded.end_date OR
                        image != excluded.image OR
                        group_date != excluded.group_date OR
                        active != 1
                `);

                stmt.run({
                    $conditionId: normalizedConditionId,
                    $slug: market.slug,
                    $description: market.description,
                    $clobTokenIds: market.clobTokenIds,
                    $eventSlug: market.eventSlug,
                    $threshold: threshold,
                    $endDate: market.endDate,
                    $image: market.image,
                    $groupDate: market.groupDate
                });

                results.push(normalizedConditionId);
            }
            return results;
        });

        return upsertTransaction(markets);
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

    removeMarket(conditionId) {
        const normalizedConditionId = this.normalizeConditionId(conditionId);

        const stmt = this.db.prepare(`
      UPDATE markets 
      SET active = 0, watched = 0, updated_at = CURRENT_TIMESTAMP
      WHERE condition_id = ?
    `);

        const result = stmt.run(normalizedConditionId);

        if (result.changes === 0) {
            throw new Error(`Market ${conditionId} not found`);
        }
        this.fuseCache = null; // Invalidate cache

        return true;
    }

    setMarketWatched(conditionId, watched) {
        const normalizedConditionId = this.normalizeConditionId(conditionId);
        const val = watched ? 1 : 0;
        const stmt = this.db.prepare(`
            UPDATE markets SET watched = ?, updated_at = CURRENT_TIMESTAMP WHERE condition_id = ?
        `);
        const result = stmt.run(val, normalizedConditionId);
        if (result.changes === 0) {
            throw new Error(`Market ${conditionId} not found`);
        }
        return true;
    }

    setMarketThreshold(conditionId, amount) {
        const normalizedConditionId = this.normalizeConditionId(conditionId);
        const stmt = this.db.prepare(`
            UPDATE markets SET threshold = ?, updated_at = CURRENT_TIMESTAMP WHERE condition_id = ?
        `);
        const result = stmt.run(amount, normalizedConditionId);
        if (result.changes === 0) {
            throw new Error(`Market ${conditionId} not found`);
        }
        return true;
    }

    setEventThreshold(eventSlug, amount) {
        const stmt = this.db.prepare(`
            UPDATE markets SET threshold = ?, updated_at = CURRENT_TIMESTAMP WHERE event_slug = ? AND active = 1
        `);
        const result = stmt.run(amount, eventSlug);
        return result.changes;
    }

    findMarketBySlugPartial(partialSlug) {
        const stmt = this.db.prepare(`
            SELECT * FROM markets WHERE slug LIKE ? AND active = 1 LIMIT 1
        `);
        return stmt.get(`%${partialSlug}%`);
    }

    findDistinctEventsByMarketSlugPartial(partialSlug) {
        const stmt = this.db.prepare(`
            SELECT DISTINCT event_slug FROM markets WHERE slug LIKE ? AND active = 1
        `);
        return stmt.all(`%${partialSlug}%`);
    }

    getWatchedMarkets() {
        const stmt = this.db.prepare(`
      SELECT id, condition_id, slug, description, clob_token_ids, event_slug, threshold, image, end_date, group_date, created_at, updated_at
      FROM markets
      WHERE watched = 1 AND active = 1
      ORDER BY created_at DESC
    `);

        return stmt.all();
    }

    getAllMarkets() {
        const stmt = this.db.prepare(`
      SELECT id, condition_id, slug, description, clob_token_ids, event_slug, threshold, image, end_date, group_date, active, created_at, updated_at
      FROM markets
      ORDER BY created_at DESC
    `);

        return stmt.all();
    }

    getMarket(conditionId) {
        const normalizedConditionId = this.normalizeConditionId(conditionId);

        const stmt = this.db.prepare(`
      SELECT id, condition_id, slug, description, clob_token_ids, event_slug, threshold, image, end_date, group_date, active, created_at, updated_at
      FROM markets
      WHERE condition_id = ?
    `);

        return stmt.get(normalizedConditionId);
    }

    close() {
        this.db.close();
    }

    getMarketsByEventSlug(eventSlug) {
        const stmt = this.db.prepare(`
        SELECT id, condition_id, slug, description, clob_token_ids, event_slug, threshold, image, end_date, group_date, active, watched, created_at, updated_at
        FROM markets
        WHERE event_slug = ? AND active = 1
      `);
        return stmt.all(eventSlug);
    }

    searchMarkets(query, limit = 20) {
        // "Search Light, Fetch Heavy" Pattern

        // 1. Initialize Fuse cache with minimal data if needed
        if (!this.fuseCache) {
            // Select ONLY lightweight fields to prevent OOM
            const stmt = this.db.prepare(`
                SELECT id, slug, event_slug FROM markets WHERE active = 1
            `);
            const lightMarkets = stmt.all();

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
        // We use a safe parameterized query for the IN clause
        const placeholders = ids.map(() => '?').join(',');
        const stmt = this.db.prepare(`
            SELECT id, condition_id, slug, description, clob_token_ids, event_slug, threshold, image, end_date, group_date, active, watched, created_at, updated_at
            FROM markets
            WHERE id IN (${placeholders})
        `);

        const fullMarkets = stmt.all(...ids);

        // 4. Re-sort to match Fuse ranking (since SQL return order isn't guaranteed)
        // Create a map for O(1) lookup
        const marketMap = new Map(fullMarkets.map(m => [m.id, m]));

        return topResults
            .map(r => marketMap.get(r.item.id))
            .filter(Boolean); // Filter out any missing (shouldn't happen)
    }
}

export const marketRegistry = new MarketRegistry();
