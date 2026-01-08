import { Database } from 'bun:sqlite';
import { join } from 'path';

class MarketRegistry {
    constructor() {
        const dbPath = join(import.meta.dir, '../..', 'data', 'markets.db');
        this.db = new Database(dbPath);
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

            // Check for group_date if we want to add it, strict requirements asked for end_date and compact layout
            // Adding group_date just in case for sorting/context
            const hasGroupDate = tableInfo.some(c => c.name === 'group_date');
            if (!hasGroupDate) {
                console.log('Migrating database: adding column group_date...');
                this.db.exec('ALTER TABLE markets ADD COLUMN group_date TEXT');
            }


            // Create indices AFTER ensuring columns exist
            this.db.exec(`
              CREATE INDEX IF NOT EXISTS idx_markets_condition_id ON markets(condition_id);
              CREATE INDEX IF NOT EXISTS idx_markets_active ON markets(active);
              CREATE INDEX IF NOT EXISTS idx_markets_event_slug ON markets(event_slug);
            `);

        } catch (err) {
            console.warn('Migration check failed (ignoring):', err.message);
        }

        console.log('Database schema initialized');
    }

    // ... existing methods ...

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
        INSERT INTO markets (condition_id, slug, description, clob_token_ids, event_slug, threshold, end_date, image, group_date, active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
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
                active: true
            };
        } catch (error) {
            if (error.message?.includes('UNIQUE constraint') || error.message?.includes('already exists')) {
                throw new Error(`Market ${conditionId} already exists`);
            }
            throw error;
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

    removeMarket(conditionId) {
        const normalizedConditionId = this.normalizeConditionId(conditionId);

        const stmt = this.db.prepare(`
      UPDATE markets 
      SET active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE condition_id = ?
    `);

        const result = stmt.run(normalizedConditionId);

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

    // Fuzzy search helper for Discord command
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

    getActiveMarkets() {
        const stmt = this.db.prepare(`
      SELECT id, condition_id, slug, description, clob_token_ids, event_slug, threshold, image, end_date, group_date, created_at, updated_at
      FROM markets
      WHERE active = 1
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
        SELECT id, condition_id, slug, description, clob_token_ids, event_slug, threshold, image, end_date, group_date, active, created_at, updated_at
        FROM markets
        WHERE event_slug = ? AND active = 1
      `);
        return stmt.all(eventSlug);
    }

}

export const marketRegistry = new MarketRegistry();
