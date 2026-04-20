const pg = require('pg');
const { Pool } = pg;

// Force bigint (int8) to be parsed as number
// In Postgres, COUNT returns int8 which node-postgres reads as string by default
pg.types.setTypeParser(20, val => parseInt(val, 10));

class PgWrapper {
  constructor(pool) {
    this.pool = pool;
  }
  
  // Magic converter translating SQLite ? into Postgres $1, $2, etc.
  convertQuery(sql) {
    let i = 1;
    return sql.replace(/\?/g, () => `$${i++}`);
  }

  // Wrapper to make result rows case-insensitive for property access
  // This allows user.passwordHash to work even if Postgres returns user.passwordhash
  wrapRow(row) {
    if (!row) return row;
    return new Proxy(row, {
      get(target, prop) {
        if (typeof prop === 'string' && !(prop in target)) {
          const lower = prop.toLowerCase();
          if (lower in target) return target[lower];
        }
        return target[prop];
      }
    });
  }

  async get(sql, params = []) {
    const res = await this.pool.query(this.convertQuery(sql), params);
    return this.wrapRow(res.rows[0]);
  }
  
  async all(sql, params = []) {
    const res = await this.pool.query(this.convertQuery(sql), params);
    return res.rows.map(row => this.wrapRow(row));
  }
  
  async run(sql, params = []) {
    let pgSql = this.convertQuery(sql);
    const isInsert = pgSql.trim().toUpperCase().startsWith('INSERT');
    const hasReturning = pgSql.toUpperCase().includes('RETURNING');
    
    // Postgres requires RETURNING to get the generated id, unlike sqlite's implicit .lastID
    if (isInsert && !hasReturning) {
      pgSql += ' RETURNING id';
    }
    
    const res = await this.pool.query(pgSql, params);
    return {
      lastID: isInsert && res.rows.length > 0 ? res.rows[0].id : null,
      changes: res.rowCount
    };
  }
  
  async exec(sql) {
    // Basic multi-statement execution, no params allowed by PG wrapper
    await this.pool.query(sql);
  }
}

let instance = null;

function getDb() {
  if (!instance) {
    const pool = new Pool({
      user: process.env.POSTGRES_USER || 'isitcom_admin',
      host: process.env.POSTGRES_HOST || 'localhost',
      database: process.env.POSTGRES_DB || 'isitcom_db',
      password: process.env.POSTGRES_PASSWORD || 'isitcom_secure_password',
      port: process.env.POSTGRES_PORT || 5432,
    });
    instance = new PgWrapper(pool);
  }
  return instance;
}

module.exports = { getDb };
