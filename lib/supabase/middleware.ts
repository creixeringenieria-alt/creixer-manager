import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getRoleHomePath, isValidRole } from "@/lib/auth/roles";
import type { Database } from "@/types/database";

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isDashboardRoute = pathname.startsWith("/dashboard");
  const isLoginRoute = pathname === "/login";
  const isAccessIncompleteRoute = pathname === "/acceso-incompleto";

  let response = NextResponse.next({
    request: {
      headers: request.headers
    }
  });
  try {
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          }
        }
      }
    );

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError) {
      console.error("[auth][middleware] getUser failed:", userError.message);
      if (isDashboardRoute) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("error", "No se pudo validar la sesión. Intenta iniciar sesión nuevamente.");
        return NextResponse.redirect(url);
      }
      return response;
    }

    if (!user && isDashboardRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("error", "Debes iniciar sesión para continuar.");
      return NextResponse.redirect(url);
    }

    if (!user && isAccessIncompleteRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("error", "No hay sesión activa.");
      return NextResponse.redirect(url);
    }

    if (user && isLoginRoute) {
      const { data: profile, error: profileError } = (await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle()) as {
        data: { role?: string } | null;
        error?: { message?: string } | null;
      };

      if (profileError) {
        console.error("[auth][middleware] profile lookup failed on /login:", profileError.message);
        return response;
      }

      const role = typeof profile?.role === "string" && isValidRole(profile.role) ? profile.role : null;
      if (!role) {
        console.warn("[auth][middleware] session without valid profile/role on /login", {
          userId: user.id
        });
        return response;
      }

      const url = request.nextUrl.clone();
      url.pathname = getRoleHomePath(role);
      url.searchParams.delete("error");
      return NextResponse.redirect(url);
    }

    return response;
  } catch (error) {
    console.error("[auth][middleware] unexpected error:", error);
    if (isDashboardRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("error", "Error de autenticación. Intenta de nuevo.");
      return NextResponse.redirect(url);
    }
    return response;
  }
}
