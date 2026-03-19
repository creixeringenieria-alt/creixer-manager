import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getRoleHomePath, isValidRole } from "@/lib/auth/roles";
import type { Database } from "@/types/database";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers
    }
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        }
      }
    }
  );

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isDashboardRoute = pathname.startsWith("/dashboard");
  const isLoginRoute = pathname === "/login";

  if (!user && isDashboardRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "Debes iniciar sesión para continuar.");
    return NextResponse.redirect(url);
  }

  if (user && isLoginRoute) {
    const { data: profile } = (await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()) as {
      data: { role?: string } | null;
    };
    const role = typeof profile?.role === "string" && isValidRole(profile.role) ? profile.role : null;
    const url = request.nextUrl.clone();
    url.pathname = getRoleHomePath(role);
    url.searchParams.delete("error");
    return NextResponse.redirect(url);
  }

  return response;
}
