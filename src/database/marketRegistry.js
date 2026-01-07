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
        clob_token_ids TEXT,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        active INTEGER DEFAULT 1
      );

      CREATE INDEX IF NOT EXISTS idx_markets_condition_id ON markets(condition_id);
      CREATE INDEX IF NOT EXISTS idx_markets_active ON markets(active);
    `);

        // Migration logic
        try {
            const tableInfo = this.db.prepare("PRAGMA table_info(markets)").all();
            const hasName = tableInfo.some(c => c.name === 'name');
            const hasSlug = tableInfo.some(c => c.name === 'slug');
            const hasClobTokenIds = tableInfo.some(c => c.name === 'clob_token_ids');

            if (hasName && !hasSlug) {
                console.log('Migrating database: renaming column name to slug...');
                this.db.exec('ALTER TABLE markets RENAME COLUMN name TO slug');
            }

            if (!hasClobTokenIds) {
                console.log('Migrating database: adding column clob_token_ids...');
                this.db.exec('ALTER TABLE markets ADD COLUMN clob_token_ids TEXT');
            }
        } catch (err) {
            console.warn('Migration check failed (ignoring):', err.message);
        }

        console.log('Database schema initialized');
    }

    addMarket(conditionId, slug = null, description = null, clobTokenIds = null) {
        try {
            const normalizedConditionId = this.normalizeConditionId(conditionId);
            // clobTokenIds is expected to be a JSON string or null

            const stmt = this.db.prepare(`
        INSERT INTO markets (condition_id, slug, description, clob_token_ids, active)
        VALUES (?, ?, ?, ?, 1)
        ON CONFLICT(condition_id) DO UPDATE SET
          slug = COALESCE(excluded.slug, slug),
          description = COALESCE(excluded.description, description),
          clob_token_ids = COALESCE(excluded.clob_token_ids, clob_token_ids),
          active = 1,
          updated_at = CURRENT_TIMESTAMP
      `);

            stmt.run(normalizedConditionId, slug, description, clobTokenIds);
            const id = this.db.lastInsertRowId;

            return {
                id: Number(id),
                conditionId: normalizedConditionId,
                slug,
                description,
                clobTokenIds,
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

    getActiveMarkets() {
        const stmt = this.db.prepare(`
      SELECT id, condition_id, slug, description, clob_token_ids, created_at, updated_at
      FROM markets
      WHERE active = 1
      ORDER BY created_at DESC
    `);

        return stmt.all();
    }

    getAllMarkets() {
        const stmt = this.db.prepare(`
      SELECT id, condition_id, slug, description, clob_token_ids, active, created_at, updated_at
      FROM markets
      ORDER BY created_at DESC
    `);

        return stmt.all();
    }

    getMarket(conditionId) {
        const normalizedConditionId = this.normalizeConditionId(conditionId);

        const stmt = this.db.prepare(`
      SELECT id, condition_id, slug, description, clob_token_ids, active, created_at, updated_at
      FROM markets
      WHERE condition_id = ?
    `);

        return stmt.get(normalizedConditionId);
    }
    close() {
        this.db.close();
    }
}

export const marketRegistry = new MarketRegistry();
