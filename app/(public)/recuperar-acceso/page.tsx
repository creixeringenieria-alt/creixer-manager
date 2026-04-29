import Link from "next/link";

import { solicitarRecuperacionAction } from "@/app/(public)/login/actions";

interface RecuperarAccesoPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function RecuperarAccesoPage({ searchParams }: RecuperarAccesoPageProps) {
  const params = await searchParams;

  return (
    <main className="login-main">
      <div className="card login-card">
        <img src="/logo-creixer.png" alt="Creixer Ingeniería" className="login-logo" />
        <h1>Recuperar acceso</h1>
        <p className="login-subtitle">Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.</p>

        {params.error ? <p className="feedback error">{params.error}</p> : null}

        <form action={solicitarRecuperacionAction} className="form-grid">
          <input type="email" name="email" placeholder="Correo" required />
          <button type="submit">Enviar enlace de recuperación</button>
        </form>

        <p style={{ marginTop: "0.75rem", textAlign: "center" }}>
          <Link href="/login">Volver al login</Link>
        </p>
      </div>
    </main>
  );
}
