"use client";

interface PrintButtonProps {
  label?: string;
}

export default function PrintButton({ label = "Exportar PDF" }: PrintButtonProps) {
  return (
    <button type="button" className="ghost-btn" onClick={() => window.print()}>
      {label}
    </button>
  );
}
