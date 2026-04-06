import type { VercelRequest, VercelResponse } from '@vercel/node'
import jwt from 'jsonwebtoken'
import { getDb, initDb } from '../_db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { nickname } = req.body ?? {}
  if (!nickname || typeof nickname !== 'string') return res.status(400).json({ error: 'Thiếu nickname' })
  const nick = nickname.trim()
  if (nick.length < 2 || nick.length > 32) return res.status(400).json({ error: 'Nickname phải từ 2-32 ký tự' })

  try {
    await initDb()
    const sql = getDb()

    // Upsert: tạo mới nếu chưa có, lấy lại nếu đã có
    const rows = await sql`
      INSERT INTO users (nickname, password_hash)
      VALUES (${nick}, '')
      ON CONFLICT (nickname) DO UPDATE SET nickname = EXCLUDED.nickname
      RETURNING id, nickname
    `
    const user = rows[0]
    const token = jwt.sign({ id: user.id, nickname: user.nickname }, process.env.JWT_SECRET!, { expiresIn: '30d' })
    return res.status(200).json({ token, nickname: user.nickname, id: user.id })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Lỗi server' })
  }
}
