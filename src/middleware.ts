import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import type { Database } from "@/lib/db/database.types";

/**
 * Runs before every matched route. @supabase/ssr 0.12.4 ships no exported
 * `updateSession` helper, so this wires createServerClient directly to the
 * request/response cookie stores. Token refreshes write back to the response
 * via `setAll`, keeping the client session fresh on every request.
 *
 * Routing:
 * - Authenticated users on /login or /signup -> redirect to /.
 * - Unauthenticated users on protected routes -> redirect to /login.
 */
const PROTECTED_PREFIXES = ["/library"];

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    env.supabaseUrl,
    env.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthPage = pathname === "/login" || pathname === "/signup";
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  if (isAuthPage && user) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (isProtected && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};