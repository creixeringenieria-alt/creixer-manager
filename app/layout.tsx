import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Creixer Manager",
  description: "Plataforma para administrar mantenimiento"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
