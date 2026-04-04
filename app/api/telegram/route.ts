import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { extractExpenseFromContent } from '@/lib/anthropic';
import * as telegram from '@/lib/telegram';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("Telegram Update:", JSON.stringify(body, null, 2));

    if (body.message) {
      return handleMessage(body.message);
    }

    if (body.callback_query) {
      return handleCallback(body.callback_query);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

async function handleMessage(message: any) {
  const chatId = message.chat.id;
  const text = message.text || message.caption || "";
  const photos = message.photo;

  let extractionContent;

  if (photos && photos.length > 0) {
    // Tomamos la versión más grande de la foto
    const fileId = photos[photos.length - 1].file_id;
    const file = await telegram.getFile(fileId);
    if (!file || !file.file_path) {
      await telegram.sendMessage(chatId, "❌ No pude descargar la imagen de Telegram.");
      return NextResponse.json({ ok: true });
    }

    const base64 = await telegram.getFileBase64(file.file_path);
    if (!base64) {
      await telegram.sendMessage(chatId, "❌ Error al procesar la imagen.");
      return NextResponse.json({ ok: true });
    }

    extractionContent = {
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: "image/jpeg" as const, // Asumimos JPEG por simplicidad
        data: base64,
      }
    };

    // Si hay texto/caption, lo agregamos al Prompt en el helper
    if (text) {
      // En este caso el helper recibe un string o un objeto. 
      // Modificaremos el Prompt para incluir el caption si existe.
    }
  } else if (text) {
    extractionContent = text;
  } else {
    return NextResponse.json({ ok: true }); // No es texto ni foto
  }

  await telegram.sendMessage(chatId, "🔍 Analizando gasto...");

  // Llamada a Claude
  const extraction = await extractExpenseFromContent(extractionContent, text);

  if (!extraction || !extraction.importe || !extraction.concepto) {
    await telegram.sendMessage(chatId, "🤷‍♂️ No pude extraer los datos del gasto. Por favor, intenta escribirlo claramente.");
    return NextResponse.json({ ok: true });
  }

  // Guardar como pendiente en Supabase
  const { data, error } = await supabase.from('gastos').insert({
    concepto: extraction.concepto,
    importe: extraction.importe,
    categoria: extraction.categoria || "Otros",
    confirmado: false,
    telegram_msg_id: message.message_id,
    telegram_user_id: message.from.id
  }).select().single();

  if (error || !data) {
    console.error("Supabase error:", JSON.stringify(error));
    await telegram.sendMessage(chatId, `❌ Error: ${error?.message || 'sin data'}`);
    return NextResponse.json({ ok: true });
  }

  // Responder con botones
  const replyText = `🛒 ¿Es correcto este gasto?\n\n📝 <b>${extraction.concepto}</b>\n📂 ${extraction.categoria}\n💰 $${extraction.importe.toFixed(2)}`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "✅ Jorge", callback_data: `confirm:Jorge:${data.id}` },
        { text: "✅ Diana", callback_data: `confirm:Diana:${data.id}` }
      ],
      [
        { text: "✏️ Editar", callback_data: `edit:${data.id}` },
        { text: "🗑️ Cancelar", callback_data: `cancel:${data.id}` }
      ]
    ]
  };

  await telegram.sendMessage(chatId, replyText, keyboard);
  return NextResponse.json({ ok: true });
}

async function handleCallback(callback: any) {
  const chatId = callback.message.chat.id;
  const data = callback.data;
  const [action, ...args] = data.split(':');

  if (action === 'confirm') {
    const [usuario, recordId] = args;
    const { data: updated, error } = await supabase.from('gastos')
      .update({ usuario, confirmado: true })
      .eq('id', recordId)
      .select().single();

    if (error) {
      await telegram.answerCallbackQuery(callback.id, "❌ Error al confirmar.");
    } else {
      await telegram.answerCallbackQuery(callback.id, "✅ Registrado!");
      // Editar el mensaje original para mostrar que ya está registrado
      await telegram.sendMessage(chatId, `✅ <b>Registrado!</b> $${updated.importe.toFixed(2)} en <i>${updated.categoria}</i> por ${usuario}`);
    }
  } else if (action === 'cancel') {
    const recordId = args[0];
    await supabase.from('gastos').delete().eq('id', recordId);
    await telegram.answerCallbackQuery(callback.id, "🗑️ Cancelado.");
    await telegram.sendMessage(chatId, "🗑️ Gasto cancelado.");
  } else if (action === 'edit') {
    await telegram.answerCallbackQuery(callback.id, "🛠️ Función de editar próximamente.");
  }

  return NextResponse.json({ ok: true });
}
