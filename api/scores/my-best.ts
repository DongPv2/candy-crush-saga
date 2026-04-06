import type { VercelRequest, VercelResponse } from '@vercel/node'
import jwt from 'jsonwebtoken'
import { getDb } from '../_db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Chưa đăng nhập' })

  try {
    const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET!) as { id: number }
    const sql = getDb()
    const rows = await sql`
      SELECT COALESCE(MAX(score), 0) AS best_score
      FROM scores
      WHERE user_id = ${payload.id}
    `
    return res.status(200).json({ best_score: Number(rows[0]?.best_score ?? 0) })
  } catch {
    return res.status(401).json({ error: 'Token không hợp lệ' })
  }
}
