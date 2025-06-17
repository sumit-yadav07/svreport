import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'svreport.db');
const db = new sqlite3.Database(dbPath);

export const initializeDatabase = () => {
  db.serialize(() => {
    // Create open_source_software table
    db.run(`
      CREATE TABLE IF NOT EXISTS open_source_software (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        software_title_id INTEGER UNIQUE NOT NULL,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create software_remarks table
    db.run(`
      CREATE TABLE IF NOT EXISTS software_remarks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        software_title_id INTEGER UNIQUE NOT NULL,
        remark TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for faster lookups
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_software_title_id 
      ON open_source_software(software_title_id)
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_remarks_software_title_id 
      ON software_remarks(software_title_id)
    `);
  });
};

export const getDatabase = () => db;

export default db;