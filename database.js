// TEMPLATE DA INTERNET!
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false 
  }
});

// Teste de conexão opcional
pool.connect((err, client, release) => {
  if (err) {
    return console.error('Erro ao conectar ao banco de dados Neon:', err.stack);
  }
  console.log('Conectado com sucesso ao Neon PostgreSQL!');
  release();
});



module.exports = pool;