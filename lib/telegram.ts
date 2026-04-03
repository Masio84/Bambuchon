import axios from 'axios';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

export async function sendMessage(chatId: string | number, text: string, replyMarkup?: any) {
  try {
    const response = await axios.post(`${TELEGRAM_API_URL}/sendMessage`, {
      chat_id: chatId,
      text,
      reply_markup: JSON.stringify(replyMarkup),
      parse_mode: 'HTML',
    });
    return response.data;
  } catch (error) {
    console.error("Error sending Telegram message:", error);
    return null;
  }
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  try {
    await axios.post(`${TELEGRAM_API_URL}/answerCallbackQuery`, {
      callback_query_id: callbackQueryId,
      text,
    });
  } catch (error) {
    console.error("Error answering callback query:", error);
  }
}

export async function getFile(fileId: string) {
  try {
    const response = await axios.get(`${TELEGRAM_API_URL}/getFile`, {
      params: { file_id: fileId },
    });
    return response.data.result;
  } catch (error) {
    console.error("Error getting Telegram file path:", error);
    return null;
  }
}

export async function getFileBase64(filePath: string): Promise<string | null> {
  try {
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
    const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    return Buffer.from(response.data, 'binary').toString('base64');
  } catch (error) {
    console.error("Error downloading file content:", error);
    return null;
  }
}
