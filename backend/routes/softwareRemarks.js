import express from 'express';
import { getDatabase } from '../database.js';

const router = express.Router();
const db = getDatabase();

// Get all software remarks
router.get('/software-remarks', (req, res) => {
  db.all('SELECT * FROM software_remarks', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Add or update a software remark
router.post('/software-remarks', (req, res) => {
  const { software_title_id, remark } = req.body;
  
  if (!software_title_id) {
    res.status(400).json({ error: 'software_title_id is required' });
    return;
  }

  db.run(
    'INSERT OR REPLACE INTO software_remarks (software_title_id, remark, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
    [software_title_id, remark],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, software_title_id, remark });
    }
  );
});

export default router; 