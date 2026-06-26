"use server";

import { redirect } from "next/navigation";

import { requireCurrentProfile } from "@/lib/auth/current-profile";

type AiResponsePayload = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
    }>;
  }>;
};

function extractOutputText(payload: AiResponsePayload): string {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const parts: string[] = [];
  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === "string" && content.text.trim()) {
        parts.push(content.text.trim());
      }
    }
  }

  return parts.join("\n\n").trim();
}

function buildRedirect(params: Record<string, string>) {
  const query = new URLSearchParams(params);
  return `/dashboard/configuracion/gerencial?${query.toString()}`;
}

async function requireSuperAdmin() {
  const profile = await requireCurrentProfile();
  if (profile.role !== "super_admin") {
    redirect("/dashboard?error=Acceso%20denegado%20a%20configuraci%C3%B3n%20gerencial.");
  }
  return profile;
}

export async function generarDiagnosticoIaAction(formData: FormData) {
  await requireSuperAdmin();

  const tipoAnalisis = String(formData.get("tipo_analisis") ?? "analisis_operativo");
  const contexto = String(formData.get("contexto") ?? "").trim();

  if (!contexto) {
    redirect(buildRedirect({ error: "Escribe el contexto del caso o diagnóstico antes de usar IA." }));
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  if (!apiKey) {
    redirect(
      buildRedirect({
        error: "Falta configurar OPENAI_API_KEY en Vercel para activar IA dentro del ERP."
      })
    );
  }

  let errorMessage: string | null = null;
  let result = "";

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content:
              "Eres un asistente técnico para Creixer Ingeniería. Entrega respuestas en español, prácticas, estructuradas y útiles para operación de mantenimiento, interventoría y consultoría. No inventes datos; si falta información, dilo claramente."
          },
          {
            role: "user",
            content: `Tipo de análisis: ${tipoAnalisis}\n\nContexto:\n${contexto}\n\nEntrega: diagnóstico probable, riesgos, acciones recomendadas y datos faltantes.`
          }
        ],
        max_output_tokens: 900
      }),
      cache: "no-store"
    });

    const raw = await response.text();
    let payload: AiResponsePayload | null = null;
    try {
      payload = JSON.parse(raw) as AiResponsePayload;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      console.error("[configuracion-gerencial][openai] request failed", {
        status: response.status,
        body: raw.slice(0, 700)
      });
      errorMessage = "OpenAI no respondió correctamente. Revisa la llave OPENAI_API_KEY y el modelo configurado.";
    } else {
      result = payload ? extractOutputText(payload) : "";
      if (!result) {
        errorMessage = "La IA respondió, pero no entregó texto útil. Intenta con más contexto.";
      }
    }
  } catch (error) {
    console.error("[configuracion-gerencial][openai] fetch failed", {
      error: error instanceof Error ? error.message : String(error)
    });
    errorMessage = "No fue posible conectar con OpenAI desde el servidor.";
  }

  if (errorMessage) {
    redirect(buildRedirect({ error: errorMessage }));
  }

  redirect(
    buildRedirect({
      ok: "Análisis generado correctamente.",
      ai_result: result.slice(0, 3500)
    })
  );
}
