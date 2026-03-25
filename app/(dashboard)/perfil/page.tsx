import Link from "next/link";

import { requireCurrentProfile } from "@/lib/auth/current-profile";

export default async function PerfilPage() {
  const profile = await requireCurrentProfile();

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Perfil</h1>
          <p>Información básica de tu cuenta en Creixer Manager.</p>
        </div>
        <Link href="/dashboard">Volver al dashboard</Link>
      </div>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Datos de usuario</h2>
        <p>
          <strong>Nombre:</strong> {profile.fullName ?? "Sin nombre configurado"}
        </p>
        <p>
          <strong>Rol:</strong> {profile.role}
        </p>
        <p>
          <strong>Correo:</strong> {profile.email ?? "-"}
        </p>
        <p>
          <strong>Inmobiliaria asociada:</strong> {profile.clientName ?? "No aplica"}
        </p>
        <p>
          <strong>ID:</strong> {profile.userId}
        </p>
      </section>
    </main>
  );
}
