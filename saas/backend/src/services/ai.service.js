import Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { uploadsDir } from './storage.service.js';

const EXT_TO_MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };

let client = null;

function getClient() {
  if (!env.anthropicApiKey) {
    return null;
  }

  if (!client) {
    client = new Anthropic({ apiKey: env.anthropicApiKey });
  }

  return client;
}

// Images uploaded through /api/uploads live on this server's local disk at
// a path like "/uploads/<uuid>.png" — not a publicly fetchable URL, so
// Anthropic's servers can't download it the way they can a real Facebook
// CDN image URL. Base64-inlining works in both cases and doesn't depend on
// this deployment having public object storage configured.
async function buildImageSource(imageUrl) {
  if (imageUrl.startsWith('/uploads/')) {
    const filePath = path.join(uploadsDir, path.basename(imageUrl));
    const buffer = await fs.readFile(filePath);
    const mediaType = EXT_TO_MIME[path.extname(filePath).toLowerCase()] || 'image/png';

    return { type: 'base64', media_type: mediaType, data: buffer.toString('base64') };
  }

  return { type: 'url', url: imageUrl };
}

// "khách yêu cầu xem ảnh AI cũng sẽ gửi" — implemented as a real Claude
// tool: the model decides *when* a customer is asking to see a product,
// calls this tool with a search query, we look up the account's real
// Product catalog, and hand the (possibly empty) result back to the model
// as a tool_result. The image itself is returned out-of-band (see
// `matchedProductImage` below) so the caller can attach it to the outgoing
// message — Claude's text response describes the product, the actual
// image bytes travel through Messenger/the widget, not through the model.
const PRODUCT_LOOKUP_TOOL = {
  name: 'find_product_image',
  description: 'Tìm sản phẩm thật trong danh mục của doanh nghiệp theo tên hoặc mô tả gần đúng, để lấy ảnh gửi cho khách khi khách hỏi xem ảnh sản phẩm.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Tên hoặc mô tả sản phẩm khách đang hỏi' }
    },
    required: ['query']
  }
};

async function lookupProduct(accountId, query) {
  const product = await prisma.product.findFirst({
    where: {
      accountId,
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } }
      ]
    }
  });

  return product;
}

// Thin wrapper so route handlers never talk to the Anthropic SDK directly —
// a required, honest boundary: this repo has no real ANTHROPIC_API_KEY, so
// calling this without one configured must fail loudly (ApiError below),
// never fall back to a fabricated canned reply pretending to be the model.
export async function generateChatbotReply({ accountId, systemPrompt, model, history, incomingMessage, imageUrl }) {
  const anthropic = getClient();

  if (!anthropic) {
    const error = new Error('AI provider not configured: set ANTHROPIC_API_KEY to enable real chatbot replies.');
    error.code = 'AI_NOT_CONFIGURED';
    throw error;
  }

  const messages = history.map(m => ({
    role: m.senderType === 'CUSTOMER' ? 'user' : 'assistant',
    content: m.content || ''
  }));

  const userContent = imageUrl
    ? [
        { type: 'text', text: incomingMessage || '' },
        { type: 'image', source: await buildImageSource(imageUrl) }
      ]
    : incomingMessage;

  messages.push({ role: 'user', content: userContent });

  const createArgs = {
    model: model || 'claude-sonnet-5',
    max_tokens: 1024,
    system: systemPrompt,
    tools: [PRODUCT_LOOKUP_TOOL],
    messages
  };

  let response = await anthropic.messages.create(createArgs);
  let matchedProductImage = null;

  // Tool-use loop: Claude can call find_product_image, we resolve it
  // against the real catalog, and hand the result back for a final text
  // reply — capped at one round-trip, which covers the documented use
  // case (look up one product per customer question) without letting a
  // pathological prompt spin the loop indefinitely.
  if (response.stop_reason === 'tool_use') {
    const toolUse = response.content.find(block => block.type === 'tool_use');

    if (toolUse && toolUse.name === 'find_product_image') {
      const product = await lookupProduct(accountId, toolUse.input.query);

      if (product?.imageUrl) {
        matchedProductImage = product.imageUrl;
      }

      messages.push({ role: 'assistant', content: response.content });
      messages.push({
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: product
            ? `Tìm thấy sản phẩm: ${product.name}. Mô tả: ${product.description || 'không có'}. ${product.imageUrl ? 'Có ảnh, sẽ được gửi kèm câu trả lời.' : 'Không có ảnh.'}`
            : 'Không tìm thấy sản phẩm phù hợp trong danh mục.'
        }]
      });

      response = await anthropic.messages.create({ ...createArgs, messages });
    }
  }

  const textBlock = response.content.find(block => block.type === 'text');

  return { text: textBlock?.text || '', imageUrl: matchedProductImage };
}
