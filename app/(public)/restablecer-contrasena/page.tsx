"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";

export default function RestablecerContrasenaPage() {
  const supabase = useMemo(() => createClient(), []);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = useState<string>("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setReady(!!data.session);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(!!session);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!password || password.length < 8) {
      setStatus("error");
      setMessage("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setStatus("error");
      setMessage("Las contraseñas no coinciden.");
      return;
    }

    setStatus("loading");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setStatus("error");
      setMessage("No fue posible restablecer la contraseña. Abre de nuevo el enlace del correo.");
      return;
    }

    setStatus("ok");
    setMessage("Contraseña actualizada correctamente. Ya puedes iniciar sesión.");
  }

  return (
    <main className="login-main">
      <div className="card login-card">
        <img src="/logo-creixer.png" alt="Creixer Ingeniería" className="login-logo" />
        <h1>Restablecer contraseña</h1>
        <p className="login-subtitle">Define una nueva contraseña para recuperar el acceso.</p>

        {!ready ? (
          <p className="feedback error">Este enlace no es válido o expiró. Solicita uno nuevo.</p>
        ) : null}
        {message ? <p className={`feedback ${status === "ok" ? "success" : "error"}`}>{message}</p> : null}

        <form className="form-grid" onSubmit={onSubmit}>
          <input
            type="password"
            placeholder="Nueva contraseña"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
            disabled={!ready || status === "loading" || status === "ok"}
          />
          <input
            type="password"
            placeholder="Confirmar contraseña"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            minLength={8}
            required
            disabled={!ready || status === "loading" || status === "ok"}
          />
          <button type="submit" disabled={!ready || status === "loading" || status === "ok"}>
            {status === "loading" ? "Guardando..." : "Guardar nueva contraseña"}
          </button>
        </form>

        <p style={{ marginTop: "0.75rem", textAlign: "center" }}>
          <Link href="/login">Volver al login</Link>
        </p>
      </div>
    </main>
  );
}
