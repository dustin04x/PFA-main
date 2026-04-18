const { DatabaseSync } = require('node:sqlite');
const path = require('path');

class DBSyncWrapper {
  constructor(filename) {
    this.db = new DatabaseSync(filename);
  }
  
  async get(sql, params = []) {
    const stmt = this.db.prepare(sql);
    return stmt.get(...params);
  }
  
  async all(sql, params = []) {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params);
  }
  
  async run(sql, params = []) {
    const stmt = this.db.prepare(sql);
    const result = stmt.run(...params); 
    return { lastID: result.lastInsertRowid, changes: result.changes };
  }
  
  async exec(sql) {
    this.db.exec(sql);
  }
}

let instance = null;

function getDb() {
  if (!instance) {
    const dbPath = path.join(__dirname, '../../data/database.sqlite');
    instance = new DBSyncWrapper(dbPath);
  }
  return instance;
}

module.exports = { getDb };
