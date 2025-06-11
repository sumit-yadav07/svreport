import express from 'express';
import { getDatabase } from '../database.js';

const router = express.Router();
const db = getDatabase();

// Get all open source software
router.get('/open-source', (req, res) => {
  db.all('SELECT * FROM open_source_software ORDER BY name', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Add software to open source list
router.post('/open-source', (req, res) => {
  const { software_title_id, name } = req.body;
  
  if (!software_title_id || !name) {
    res.status(400).json({ error: 'software_title_id and name are required' });
    return;
  }

  db.run(
    'INSERT OR REPLACE INTO open_source_software (software_title_id, name, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
    [software_title_id, name],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, software_title_id, name });
    }
  );
});

// Remove software from open source list
router.delete('/open-source/:software_title_id', (req, res) => {
  const { software_title_id } = req.params;
  
  db.run(
    'DELETE FROM open_source_software WHERE software_title_id = ?',
    [software_title_id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ deleted: this.changes > 0 });
    }
  );
});

export { router as openSourceRoutes };