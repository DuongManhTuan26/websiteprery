import { prisma } from '../lib/prisma.js';
import { generateChatbotReply } from './ai.service.js';
import { sendMessengerMessage } from './facebook.service.js';
import { enforceConversationLimit } from './plan.service.js';

// Shared by both the Facebook webhook and the website widget endpoint —
// "Tập trung toàn bộ hội thoại bán hàng... vào một giao diện duy nhất" means
// both channels must funnel into the same Conversation/Message/Customer
// tables, not separate parallel data models.

export async function findOrCreateCustomer({ accountId, channel, facebookPsid, name }) {
  if (channel === 'FACEBOOK' && facebookPsid) {
    const existing = await prisma.customer.findUnique({
      where: { accountId_facebookPsid: { accountId, facebookPsid } }
    });

    if (existing) {
      return existing;
    }

    return prisma.customer.create({
      data: { accountId, facebookPsid, name: name || null }
    });
  }

  // Website widget visitors have no stable identity yet — a fresh Customer
  // per conversation is the honest default until the widget collects
  // contact info (phone/email) later in the chat, at which point the
  // dashboard lets an agent merge/update the record manually.
  return prisma.customer.create({ data: { accountId, name: name || null } });
}

export async function findOrCreateConversation({ accountId, customerId, channel, fanpageId, chatbotId }) {
  const existing = await prisma.conversation.findFirst({
    where: { accountId, customerId, channel, status: { not: 'CLOSED' } },
    orderBy: { lastMessageAt: 'desc' }
  });

  if (existing) {
    return existing;
  }

  // Only metered on genuine creation — reopening/continuing an existing
  // thread never counts against the monthly quota.
  await enforceConversationLimit(accountId);

  return prisma.conversation.create({
    data: { accountId, customerId, channel, fanpageId, chatbotId, status: 'BOT' }
  });
}

export async function appendMessage({ conversationId, senderType, contentType = 'TEXT', content, imageUrl }) {
  const message = await prisma.message.create({
    data: { conversationId, senderType, contentType, content, imageUrl }
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() }
  });

  return message;
}

// Real delivery to the actual Facebook Messenger customer — shared by bot
// replies (maybeGenerateBotReply, below) and human-agent replies
// (conversations.routes.js's POST /:id/messages). A no-op for WIDGET-
// channel conversations, or a FACEBOOK one missing a real fanpage/PSID.
export async function forwardToFacebook(conversation, { text, imageUrl }) {
  if (conversation.channel !== 'FACEBOOK' || !conversation.fanpageId) {
    return;
  }

  const fanpage = await prisma.fanpage.findUnique({ where: { id: conversation.fanpageId } });
  const customer = await prisma.customer.findUnique({ where: { id: conversation.customerId } });

  if (!fanpage || !customer?.facebookPsid) {
    return;
  }

  // Errors here are logged, not thrown — the message is already saved
  // locally (the caller already awaited appendMessage before this runs),
  // so a Facebook API failure must never turn that into an HTTP 500 or an
  // unhandled rejection for whichever caller triggered it (the widget
  // endpoint, the webhook processor, or a human agent's manual reply).
  if (text) {
    await sendMessengerMessage({ pageAccessToken: fanpage.accessToken, recipientPsid: customer.facebookPsid, text })
      .catch(err => console.error('Facebook text send failed:', err.message));
  }

  if (imageUrl && !imageUrl.startsWith('/uploads/')) {
    // A local "/uploads/..." path (storage.service.js's fallback when
    // S3_BUCKET isn't configured) only resolves on this server, not on
    // Facebook's — only forward genuinely public image URLs. Configure
    // S3_BUCKET/S3_PUBLIC_BASE_URL (see .env.example) to make images
    // reach real Messenger customers; uploads then produce a public URL
    // automatically and this check simply passes.
    await sendMessengerMessage({
      pageAccessToken: fanpage.accessToken,
      recipientPsid: customer.facebookPsid,
      imageUrl
    }).catch(err => console.error('Facebook image send failed:', err.message));
  }
}

// The documented "Khi nào cần chuyển đổi hội thoại từ Chatbot sang nhân
// viên hỗ trợ trực tiếp" feature: once a conversation is HUMAN, the bot
// stops auto-replying entirely — an agent owns it until they close it or
// hand it back.
export async function maybeGenerateBotReply({ conversation, chatbot, incomingMessage, imageUrl, io }) {
  if (conversation.status !== 'BOT' || !chatbot || chatbot.status !== 'ACTIVE') {
    return null;
  }

  const history = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: 'asc' },
    take: 20
  });

  let reply;

  try {
    reply = await generateChatbotReply({
      accountId: conversation.accountId,
      systemPrompt: chatbot.systemPrompt,
      model: chatbot.aiModel,
      history,
      incomingMessage,
      imageUrl
    });
  } catch (err) {
    if (err.code === 'AI_NOT_CONFIGURED') {
      // Fail visibly in the dashboard rather than silently going quiet or
      // fabricating a canned reply that didn't come from the model.
      io?.to(`account:${conversation.accountId}`).emit('bot:error', {
        conversationId: conversation.id,
        message: err.message
      });
      return null;
    }

    throw err;
  }

  const botMessage = await appendMessage({
    conversationId: conversation.id,
    senderType: 'BOT',
    content: reply.text
  });

  io?.to(`account:${conversation.accountId}`).emit('message:new', botMessage);

  // "khách yêu cầu xem ảnh AI cũng sẽ gửi" — a second, real Message when
  // the model's find_product_image tool call matched a real catalog entry.
  let productImageMessage = null;

  if (reply.imageUrl) {
    productImageMessage = await appendMessage({
      conversationId: conversation.id,
      senderType: 'BOT',
      contentType: 'IMAGE',
      imageUrl: reply.imageUrl
    });

    io?.to(`account:${conversation.accountId}`).emit('message:new', productImageMessage);
  }

  await forwardToFacebook(conversation, { text: reply.text, imageUrl: reply.imageUrl });

  // Callers that only care about the text reply (the Facebook webhook
  // doesn't use the return value at all) can keep destructuring `.text`;
  // widget.routes.js needs both so a product-image reply reaches the
  // widget's own HTTP response — the widget has no Socket.io connection
  // (see public/widget.js), so the `message:new` socket event above is
  // invisible to it, and without this it would only ever see an image
  // reply after reloading (loadHistory() picks up anything it missed).
  return { text: botMessage, image: productImageMessage };
}
