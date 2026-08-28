import { NextRequest, NextResponse } from 'next/server'
import { getWebAccessContext } from '@/lib/webAccess'

export async function GET(req: NextRequest) {
  const context = await getWebAccessContext(req)

  if (!context) {
    return NextResponse.json(
      { authenticated: false },
      { status: 401 }
    )
  }

  return NextResponse.json({
    authenticated: true,
    courseId: context.courseId,
    enrollment: context.enrollment,
  })
}