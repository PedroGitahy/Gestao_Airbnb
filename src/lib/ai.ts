/**
 * IA compatível com a API da OpenAI (Groq, OpenAI, OpenRouter, Ollama…).
 * Configure AI_API_KEY e, se quiser, AI_BASE_URL e AI_MODEL.
 * Padrão: Groq com Llama 3.3 70B.
 */
export function aiReady() {
  return Boolean(process.env.AI_API_KEY);
}

export async function ask(system: string, user: string, maxTokens = 600): Promise<string> {
  const base = (process.env.AI_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/$/, "");
  const model = process.env.AI_MODEL || "llama-3.3-70b-versatile";
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.AI_API_KEY}` },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error(`A IA respondeu ${res.status}`);
  const data = await res.json();
  return String(data.choices?.[0]?.message?.content ?? "").trim();
}

export const VOICE = `Você escreve pela RGR, que administra 20 studios no condomínio Artem, em frente ao Shopping Anália Franco, em São Paulo.
Tom: cordial, direto e elegante, como um bom concierge. Frases curtas. Sem emojis, sem exclamações em excesso, sem clichês como "ficamos felizes" ou "qualquer dúvida estamos à disposição".
Nunca invente fatos, prazos ou compensações que não foram informados.`;
