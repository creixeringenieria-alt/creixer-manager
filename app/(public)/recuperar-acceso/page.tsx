"use client";

import Link from "next/link";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

export default function RecuperarAccesoPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!email.trim()) {
      setStatus("error");
      setMessage("Debes ingresar un correo.");
      return;
    }

    setStatus("loading");
    const supabase = createClient();
    const origin = window.location.origin;
    const response = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${origin}/restablecer-contrasena`
    });

    if (response.error) {
      const retry = await supabase.auth.resetPasswordForEmail(email.trim());
      if (retry.error) {
        setStatus("error");
        setMessage(retry.error.message ?? "No fue posible enviar el enlace de recuperación.");
        return;
      }
    }

    setStatus("ok");
    setMessage("Te enviamos un enlace de recuperación. Revisa tu correo.");
  }

  return (
    <main className="login-main">
      <div className="card login-card">
        <img src="/logo-creixer.png" alt="Creixer Ingeniería" className="login-logo" />
        <h1>Recuperar acceso</h1>
        <p className="login-subtitle">Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.</p>

        {message ? <p className={`feedback ${status === "ok" ? "success" : "error"}`}>{message}</p> : null}

        <form className="form-grid" onSubmit={onSubmit}>
          <input
            type="email"
            name="email"
            placeholder="Correo"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={status === "loading"}
          />
          <button type="submit" disabled={status === "loading"}>
            {status === "loading" ? "Enviando..." : "Enviar enlace de recuperación"}
          </button>
        </form>

        <p style={{ marginTop: "0.75rem", textAlign: "center" }}>
          <Link href="/login">Volver al login</Link>
        </p>
      </div>
    </main>
  );
}
