import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/central") && pathname !== "/central/login") {
    if (!req.cookies.get("rgr_session")) {
      const url = req.nextUrl.clone();
      url.pathname = "/central/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ["/central/:path*"] };
