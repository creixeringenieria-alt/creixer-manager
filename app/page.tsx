import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1>Creixer Manager</h1>
      <p>Gestión integral para empresas de mantenimiento.</p>
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <Link href="/login">Iniciar sesión</Link>
        <Link href="/dashboard">Ir al dashboard</Link>
      </div>
    </main>
  );
}
