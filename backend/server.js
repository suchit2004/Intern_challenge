require('dotenv').config();
const express = require('express');
const path = require('path');
const { compileApp } = require('./compiler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:	ext${PORT}`);
});