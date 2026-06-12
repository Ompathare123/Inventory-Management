const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();

// Enable JSON body parsing (not needed for simple text config, but good practice)
app.use(express.json());

// API Configuration endpoint
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || 'https://wfgommospjvcgvibktqs.supabase.co/rest/v1/',
    supabaseKey: process.env.SUPABASE_KEY || 'sb_publishable_6KlhFoYHSC9EhmJ1NuUjCQ_9RZ-EsMf'
  });
});

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../')));

// Local development server listener
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production' && require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running in development mode on http://localhost:${PORT}`);
  });
}

module.exports = app;
