import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isComplementaryProfileComplete } from "@/lib/auth/profile-completion";
import { getRoleHomePath, isValidRole } from "@/lib/auth/roles";
import type { AppRole } from "@/lib/auth/roles";
import type { Database } from "@/types/database";

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isDashboardRoute = pathname.startsWith("/dashboard");
  const isLoginRoute = pathname === "/login";
  const isAccessIncompleteRoute = pathname === "/acceso-incompleto";
  const isProfileCompleteRoute = pathname === "/dashboard/perfil/completar";
  const requiresAuthHandling = isDashboardRoute || isLoginRoute || isAccessIncompleteRoute;

  let response = NextResponse.next({
    request: {
      headers: request.headers
    }
  });

  if (!requiresAuthHandling) {
    return response;
  }
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

    const getUserResult = await Promise.race([
      supabase.auth.getUser(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2200))
    ]);

    if (!getUserResult) {
      console.error("[auth][middleware] getUser timeout, allowing request to continue safely", {
        pathname
      });
      return response;
    }

    const {
      data: { user },
      error: userError
    } = getUserResult;

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

    if (user && requiresAuthHandling) {
      const metadataRole =
        (typeof user.app_metadata?.role === "string" && isValidRole(user.app_metadata.role)
          ? user.app_metadata.role
          : null) ??
        (typeof user.user_metadata?.role === "string" && isValidRole(user.user_metadata.role)
          ? user.user_metadata.role
          : null);

      // Edge middleware must stay lightweight; avoid DB profile queries here.
      const role = metadataRole;

      const metadataComplementary =
        typeof user.user_metadata?.complementary_profile === "object" && user.user_metadata?.complementary_profile
          ? user.user_metadata.complementary_profile
          : null;
      const isProfileComplete =
        role === "super_admin" || role === "administrador" || isComplementaryProfileComplete(metadataComplementary);

      if (!role) {
        console.warn("[auth][middleware] session without valid profile/role", {
          userId: user.id
        });
        if (isDashboardRoute || isLoginRoute) {
          const url = request.nextUrl.clone();
          url.pathname = "/acceso-incompleto";
          url.searchParams.set("error", "Tu usuario no tiene rol válido.");
          return NextResponse.redirect(url);
        }
        return response;
      }

      if (!isProfileComplete && isDashboardRoute && !isProfileCompleteRoute) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard/perfil/completar";
        url.searchParams.set("error", "Completa tu perfil laboral para continuar.");
        return NextResponse.redirect(url);
      }

      // Permitir abrir /dashboard/perfil/completar incluso si el perfil ya está completo.
      // Esto evita bloquear la edición manual de datos complementarios.
      if (isProfileComplete && isProfileCompleteRoute) {
        return response;
      }

      if (isLoginRoute) {
        const url = request.nextUrl.clone();
        url.pathname = isProfileComplete ? getRoleHomePath(role) : "/dashboard/perfil/completar";
        url.searchParams.delete("error");
        return NextResponse.redirect(url);
      }

      if (isAccessIncompleteRoute) {
        // Evita loops entre /acceso-incompleto <-> /dashboard/perfil/completar
        // cuando hay sesión válida pero perfil/complementarios incompletos o consulta inestable.
        return response;
      }
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
