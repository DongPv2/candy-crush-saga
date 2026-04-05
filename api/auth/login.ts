import type { VercelRequest, VercelResponse } from '@vercel/node'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { getDb, initDb } from '../_db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { nickname, password } = req.body ?? {}
  if (!nickname || !password) return res.status(400).json({ error: 'Thiếu nickname hoặc mật khẩu' })

  try {
    await initDb()
    const sql = getDb()
    const rows = await sql`SELECT id, nickname, password_hash FROM users WHERE nickname = ${nickname}`
    const user = rows[0]

    if (!user) return res.status(401).json({ error: 'Nickname hoặc mật khẩu không đúng' })

    const ok = await bcrypt.compare(password, user.password_hash)
    if (!ok) return res.status(401).json({ error: 'Nickname hoặc mật khẩu không đúng' })

    const token = jwt.sign({ id: user.id, nickname: user.nickname }, process.env.JWT_SECRET!, { expiresIn: '30d' })
    return res.status(200).json({ token, nickname: user.nickname, id: user.id })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Lỗi server' })
  }
}
