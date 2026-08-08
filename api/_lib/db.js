const { neon } = require('@neondatabase/serverless');

// Lazy: neon() throws synchronously if the connection string is missing.
// Resolving it only on first query (not at require-time) means a missing
// DATABASE_URL surfaces as a normal rejected promise at the call site —
// catchable by callers like login.js's rate-limit check — instead of
// crashing every serverless function that merely imports this module.
let cached = null;
function client() {
  if (!cached) {
    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!connectionString) {
      throw new Error('Banco de dados não configurado (variável DATABASE_URL ausente).');
    }
    // fullResults:true keeps the node-postgres-style { rows, rowCount, ... }
    // shape every query in this project is written against.
    cached = neon(connectionString, { fullResults: true });
  }
  return cached;
}

function sql(strings, ...values) {
  return client()(strings, ...values);
}

module.exports = { sql };
