const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/pool.db');

let _db = null;
let _inTransaction = false;

function save() {
  if (_inTransaction || !_db) return;
  const data = _db.export();
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// better-sqlite3–compatible wrapper so every existing route/service works unchanged
const dbMethods = {
  prepare(sql) {
    return {
      get(...params) {
        const stmt = _db.prepare(sql);
        if (params.length) stmt.bind(params);
        let result = undefined;
        if (stmt.step()) {
          result = stmt.getAsObject();
        }
        stmt.free();
        return result;
      },
      all(...params) {
        const results = [];
        const stmt = _db.prepare(sql);
        if (params.length) stmt.bind(params);
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
      },
      run(...params) {
        _db.run(sql, params.length ? params : undefined);
        const rows = _db.exec('SELECT last_insert_rowid() as id');
        const lastInsertRowid = rows.length ? rows[0].values[0][0] : 0;
        const changes = _db.getRowsModified();
        save();
        return { lastInsertRowid, changes };
      },
    };
  },

  exec(sql) {
    _db.exec(sql);
    save();
  },

  pragma(str) {
    try {
      _db.run(`PRAGMA ${str}`);
    } catch (_) {
      // sql.js doesn't support all pragmas (e.g. journal_mode=WAL) — safe to ignore
    }
  },

  transaction(fn) {
    return (...args) => {
      _db.run('BEGIN TRANSACTION');
      _inTransaction = true;
      try {
        const result = fn(...args);
        _db.run('COMMIT');
        _inTransaction = false;
        save();
        return result;
      } catch (e) {
        _db.run('ROLLBACK');
        _inTransaction = false;
        throw e;
      }
    };
  },
};

async function initDb() {
  const SQL = await initSqlJs();

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    _db = new SQL.Database(buffer);
  } else {
    _db = new SQL.Database();
  }

  _db.run('PRAGMA foreign_keys = ON');
}

// Proxy lets existing code do `const db = require('./db'); db.prepare(...)` unchanged
module.exports = new Proxy({}, {
  get(_target, prop) {
    if (prop === 'initDb') return initDb;
    if (prop in dbMethods) return dbMethods[prop];
    return undefined;
  },
});
