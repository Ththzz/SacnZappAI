import { NextResponse, type NextRequest } from "next/server"

const sessionCookieName = "scanzapp_session"
const publicPaths = ["/sign-in", "/sign-up"]
const pathnameHeaderName = "x-scanzapp-pathname"

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublicPath = publicPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  const hasSession = Boolean(request.cookies.get(sessionCookieName)?.value)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(pathnameHeaderName, pathname)

  if (!hasSession && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = "/sign-in"
    url.searchParams.set("next", pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
}
