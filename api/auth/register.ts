import type { VercelRequest, VercelResponse } from '@vercel/node'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { getDb, initDb } from '../_db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { nickname, password } = req.body ?? {}
  if (!nickname || !password) return res.status(400).json({ error: 'Thiếu nickname hoặc mật khẩu' })
  if (nickname.length < 2 || nickname.length > 32) return res.status(400).json({ error: 'Nickname phải từ 2-32 ký tự' })
  if (password.length < 4) return res.status(400).json({ error: 'Mật khẩu phải ít nhất 4 ký tự' })

  try {
    await initDb()
    const sql = getDb()
    const hash = await bcrypt.hash(password, 10)

    const rows = await sql`
      INSERT INTO users (nickname, password_hash)
      VALUES (${nickname}, ${hash})
      RETURNING id, nickname
    `
    const user = rows[0]
    const token = jwt.sign({ id: user.id, nickname: user.nickname }, process.env.JWT_SECRET!, { expiresIn: '30d' })
    return res.status(201).json({ token, nickname: user.nickname, id: user.id })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return res.status(409).json({ error: 'Nickname đã tồn tại' })
    }
    console.error(err)
    return res.status(500).json({ error: 'Lỗi server' })
  }
}
