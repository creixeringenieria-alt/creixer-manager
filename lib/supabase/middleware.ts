import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isComplementaryProfileComplete } from "@/lib/auth/profile-completion";
import { getRoleHomePath, isValidRole } from "@/lib/auth/roles";
import type { Database } from "@/types/database";

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isDashboardRoute = pathname.startsWith("/dashboard");
  const isLoginRoute = pathname === "/login";
  const isAccessIncompleteRoute = pathname === "/acceso-incompleto";
  const isProfileCompleteRoute = pathname === "/dashboard/perfil/completar";

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

    if (user && (isLoginRoute || isDashboardRoute || isAccessIncompleteRoute)) {
      const { data: profile, error: profileError } = (await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle()) as {
        data: { role?: string } | null;
        error?: { message?: string } | null;
      };

      if (profileError) {
        console.error("[auth][middleware] profile role lookup failed:", profileError.message);
      }

      const metadataRole =
        (typeof user.app_metadata?.role === "string" && isValidRole(user.app_metadata.role)
          ? user.app_metadata.role
          : null) ??
        (typeof user.user_metadata?.role === "string" && isValidRole(user.user_metadata.role)
          ? user.user_metadata.role
          : null);
      const roleFromProfile = typeof profile?.role === "string" && isValidRole(profile.role) ? profile.role : null;
      const role = roleFromProfile ?? metadataRole;

      let isProfileComplete = false;
      if (role === "super_admin" || role === "administrador") {
        isProfileComplete = true;
      } else {
        try {
          const { data: complementaryData, error: complementaryError } = await supabase
            .from("profile_complementary_data")
            .select(
              "fecha_nacimiento, grupo_sanguineo_rh, eps, arl, fondo_pension, fondo_cesantias, direccion_residencia, ciudad_residencia, contacto_emergencia_nombre, contacto_emergencia_telefono, parentesco_contacto_emergencia, observaciones_medicas_relevantes"
            )
            .eq("id", user.id)
            .maybeSingle();
          if (complementaryError) {
            console.error("[auth][middleware] complementary profile lookup failed:", complementaryError.message);
          }
          const metadataComplementary =
            typeof user.user_metadata?.complementary_profile === "object" && user.user_metadata?.complementary_profile
              ? user.user_metadata.complementary_profile
              : null;
          isProfileComplete = isComplementaryProfileComplete(complementaryData ?? metadataComplementary);
        } catch (error) {
          console.error("[auth][middleware] complementary profile lookup unexpected error:", error);
          const metadataComplementary =
            typeof user.user_metadata?.complementary_profile === "object" && user.user_metadata?.complementary_profile
              ? user.user_metadata.complementary_profile
              : null;
          isProfileComplete = isComplementaryProfileComplete(metadataComplementary);
        }
      }

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
