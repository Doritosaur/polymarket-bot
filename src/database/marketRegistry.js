import { Database } from 'bun:sqlite';
import { join } from 'path';
import Fuse from 'fuse.js';

class MarketRegistry {
    constructor() {
        const dbPath = join(import.meta.dir, '../..', 'data', 'markets.db');
        this.db = new Database(dbPath);
        this.db.exec("PRAGMA journal_mode = WAL;");
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
        active INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
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

            const hasGroupDate = tableInfo.some(c => c.name === 'group_date');
            if (!hasGroupDate) {
                console.log('Migrating database: adding column group_date...');
                this.db.exec('ALTER TABLE markets ADD COLUMN group_date TEXT');
            }

            const hasWatched = tableInfo.some(c => c.name === 'watched');
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
            `);

        } catch (err) {
            console.warn('Migration check failed (ignoring):', err.message);
        }

        console.log('Database schema initialized');
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
                        end_date = COALESCE($endDate, end_date),
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
        // Fetch all active markets for fuzzy search
        // We select only necessary fields to keep memory usage low
        const stmt = this.db.prepare(`
            SELECT id, condition_id, slug, description, event_slug, threshold, active, watched, image, group_date
            FROM markets
            WHERE active = 1
        `);
        const allMarkets = stmt.all();

        if (allMarkets.length === 0) return [];

        const fuseOptions = {
            keys: [
                { name: 'description', weight: 0.5 },
                { name: 'slug', weight: 0.3 },
                { name: 'event_slug', weight: 0.2 }
            ],
            threshold: 0.3, // 0.0 = perfect match, 1.0 = match anything. 0.3 is strict but fuzzy.
            ignoreLocation: true, // Search anywhere in the string
            includeScore: true
        };

        const fuse = new Fuse(allMarkets, fuseOptions);
        const results = fuse.search(query);

        // Sort: Watched matching markets first, then by Score
        const sorted = results
            .sort((a, b) => {
                // Priority to watched markets
                if (a.item.watched !== b.item.watched) {
                    return b.item.watched - a.item.watched; // 1 before 0
                }
                return a.score - b.score; // Lower score is better
            })
            .slice(0, limit)
            .map(r => r.item);

        return sorted;
    }
}

export const marketRegistry = new MarketRegistry();
