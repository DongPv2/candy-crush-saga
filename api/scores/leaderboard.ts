import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb, initDb } from '../_db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    await initDb()
    const sql = getDb()
    const rows = await sql`
      SELECT u.nickname, MAX(s.score) AS best_score, COUNT(s.id) AS games_played
      FROM users u
      JOIN scores s ON s.user_id = u.id
      GROUP BY u.id, u.nickname
      ORDER BY best_score DESC
      LIMIT 50
    `
    return res.status(200).json({ leaderboard: rows })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Lỗi server' })
  }
}
