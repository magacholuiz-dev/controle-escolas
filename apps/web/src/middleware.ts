import { NextResponse, type NextRequest } from 'next/server';

// Without a session cookie every page goes to /login. The cookie's validity is checked by the API
// (`auth/me` → 401 → the client redirects too), this only saves the round trip for the obvious case.
export function middleware(req: NextRequest) {
  if (!req.cookies.get('sid')) return NextResponse.redirect(new URL('/login', req.url));
  return NextResponse.next();
}

export const config = { matcher: ['/((?!login|api|_next|favicon.ico|icon.svg).*)'] };
