import { ApiError, GoogleGenAI, type GenerateContentParameters } from "@google/genai";
import { NextResponse } from "next/server";

// Modelos en orden de preferencia. IDs fijos: el SDK usa la API v1, donde el alias
// "gemini-flash-latest" no existe (404). gemini-4-hydrogen da 503 a menudo por saturación
// (noviembre de 2026), así que gemini-3.5-flash queda de respaldo. Cada modelo tiene su
// propia cuota gratis, por eso también se pasa al siguiente con 429.
const GEMINI_MODELS = ["gemini-4-hydrogen", "gemini-3.5-flash"];
const FALLBACK_STATUSES = new Set([404, 429, 500, 503]);

// generateContent con el primer modelo que responda; si todos fallan, lanza el último error.
export async function generateWithFallback(ai: GoogleGenAI, params: Omit<GenerateContentParameters, "model">) {
  let lastError: unknown;
  for (const model of GEMINI_MODELS) {
    try {
      return await ai.models.generateContent({ ...params, model });
    } catch (error) {
      if (!(error instanceof ApiError) || !FALLBACK_STATUSES.has(error.status)) throw error;
      console.warn("Gemini", model, "falló con", error.status, "; probando el siguiente modelo");
      lastError = error;
    }
  }
  throw lastError;
}

// Devuelve el cliente, o una respuesta de error si falta la API key.
export function geminiClient(): GoogleGenAI | NextResponse {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "Falta configurar GEMINI_API_KEY" }, { status: 500 });
  }
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

// Traduce los errores de la API de Gemini a respuestas para el cliente; relanza los demás.
export function geminiErrorResponse(error: unknown) {
  if (!(error instanceof ApiError)) throw error;
  console.error("Gemini API error", error.status, error.message);
  if (error.status === 429) {
    return NextResponse.json({ error: "Demasiadas solicitudes, espera un minuto" }, { status: 429 });
  }
  if (error.status === 503) {
    return NextResponse.json({ error: "Gemini está muy ocupado, inténtalo en un momento" }, { status: 503 });
  }
  if (error.status === 400 || error.status === 401 || error.status === 403) {
    return NextResponse.json({ error: "API key de Gemini inválida o sin permisos" }, { status: 500 });
  }
  return NextResponse.json({ error: `Error de Gemini (${error.status})` }, { status: 502 });
}
