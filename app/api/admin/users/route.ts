import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { getDb } from "@/lib/db"
import { jsonError } from "@/lib/http"

export async function GET() {
  try {
    await requireAdmin()
    const users = getDb().prepare(`
      SELECT id, name, email, role, created_at AS createdAt
      FROM users
      ORDER BY created_at DESC
    `).all()

    return NextResponse.json({ users })
  } catch (error) {
    return jsonError(error)
  }
}
