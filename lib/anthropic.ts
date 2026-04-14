import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function extractExpenseFromContent(content: string | { type: "image", source: { type: "base64", media_type: "image/jpeg", data: string } }, textContext?: string) {
  const prompt = `Analiza esta imagen o texto de una transacción financiera (gasto o ingreso). Extrae y responde SOLO en JSON con este formato exacto:
{"concepto": "nombre del producto, servicio o fuente de ingreso", "categoria": "una de estas: Despensa, Entretenimiento, Salud, Transporte, Restaurantes, Facturable, Ingreso, Otros", "importe": 0.00, "tipo": "egreso" | "ingreso"}
Determina el tipo (egreso o ingreso) según el contexto del mensaje o la imagen. Los ingresos suelen ser depósitos, sueldos, transferencias recibidas, etc.
${textContext ? `Contexto del usuario (caption): "${textContext}"` : ""}`;

  const message = await anthropic.messages.create({
    model: "claude-3-haiku-20240307",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: typeof content === 'string' 
          ? [{ type: "text", text: `${prompt}\n\nContenido: ${content}` }]
          : [{ type: "text", text: prompt }, content]
      }
    ],
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
  try {
    return JSON.parse(responseText);
  } catch (error) {
    console.error("Error parsing JSON from Claude:", responseText);
    return null;
  }
}
