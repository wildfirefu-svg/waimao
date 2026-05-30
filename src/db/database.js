import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';

export function openDatabase(databasePath = config.databasePath) {
  mkdirSync(dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec('PRAGMA foreign_keys = ON;');
  return db;
}

export function migrate(db) {
  const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
  db.exec(schema);
}

export function withDatabase(callback, databasePath = config.databasePath) {
  const db = openDatabase(databasePath);
  try {
    migrate(db);
    return callback(db);
  } finally {
    db.close();
  }
}

export function transaction(db, callback) {
  db.exec('BEGIN;');
  try {
    const result = callback();
    db.exec('COMMIT;');
    return result;
  } catch (error) {
    db.exec('ROLLBACK;');
    throw error;
  }
}

if (process.argv.includes('--init')) {
  withDatabase(() => undefined);
  console.log(`Database initialized at ${config.databasePath}`);
}
