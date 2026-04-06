import type { VercelRequest, VercelResponse } from '@vercel/node'
import jwt from 'jsonwebtoken'
import { getDb } from '../_db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const auth = req.headers.authorization ?? `Bearer ${req.query?.token}`
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Chưa đăng nhập' })

  try {
    const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET!) as { id: number; nickname: string }
    const { score } = req.body ?? {}
    const scoreVal = typeof score === 'number' ? score : parseInt(String(score), 10)
    // Max score hợp lý: 2 phút × ~300 điểm/giây = 36000, cho phép buffer 3x
    if (isNaN(scoreVal) || scoreVal < 0 || scoreVal > 100000) return res.status(400).json({ error: 'Score không hợp lệ' })

    const sql = getDb()
    await sql`INSERT INTO scores (user_id, score) VALUES (${payload.id}, ${scoreVal})`
    return res.status(201).json({ ok: true })
  } catch (err) {
    console.error(err)
    return res.status(401).json({ error: 'Token không hợp lệ' })
  }
}
