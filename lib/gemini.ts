import { ApiError, GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

// Modelo fijo: el SDK usa la API v1, donde el alias "gemini-flash-latest" no existe (404),
// y gemini-3.8-flash daba 503 por saturación en noviembre de 2026.
export const GEMINI_MODEL = "gemini-3.5-flash";

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
