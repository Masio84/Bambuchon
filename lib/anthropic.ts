import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function extractExpenseFromContent(content: string | { type: "image", source: { type: "base64", media_type: "image/jpeg", data: string } }, textContext?: string) {
  const prompt = `Analiza esta imagen o texto de un producto o ticket de compra. Extrae y responde SOLO en JSON con este formato exacto:
{"concepto": "nombre del producto o servicio", "categoria": "una de estas: Despensa, Entretenimiento, Salud, Transporte, Restaurantes, Facturable, Otros", "importe": 0.00}
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
