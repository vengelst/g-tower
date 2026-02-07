import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('Database pool error:', err);
});

export const query = (text: string, params?: unknown[]) => pool.query(text, params);
export const getClient = () => pool.connect();
export default pool;
