import { Router, raw } from 'express';
import { prisma } from '../lib/prisma.js';
import { verifyWebhookSignature, verifyWebhookChallenge } from '../services/facebook.service.js';
import {
  findOrCreateCustomer,
  findOrCreateConversation,
  appendMessage,
  maybeGenerateBotReply
} from '../services/conversation.service.js';

export const webhooksRouter = Router();

// Facebook's verification handshake when the webhook URL is first
// registered in the Meta App dashboard.
webhooksRouter.get('/facebook', (req, res) => {
  const challenge = verifyWebhookChallenge(
    req.query['hub.mode'],
    req.query['hub.verify_token'],
    req.query['hub.challenge']
  );

  if (challenge === null) {
    return res.sendStatus(403);
  }

  res.status(200).send(challenge);
});

// Real inbound Messenger events. Requires express.raw() ahead of this route
// (wired in app.js) so we can verify the signature against the exact raw
// bytes Facebook signed — parsing to JSON first would break the HMAC check.
webhooksRouter.post('/facebook', raw({ type: '*/*' }), async (req, res) => {
  const signature = req.headers['x-hub-signature-256'];

  if (!verifyWebhookSignature(req.body, signature)) {
    return res.sendStatus(403);
  }

  // Acknowledge immediately — Facebook retries aggressively on non-2xx or
  // slow responses; the actual AI reply happens after we've responded, so
  // any error past this point (including a plan-limit ApiError from
  // enforceConversationLimit) can no longer become an HTTP response — it
  // must be caught and logged here instead of left as an unhandled
  // rejection that would crash the process.
  res.sendStatus(200);

  try {
    const payload = JSON.parse(req.body.toString('utf8'));
    const io = req.app.get('io');

    for (const entry of payload.entry || []) {
      const pageId = entry.id;
      const fanpage = await prisma.fanpage.findUnique({ where: { pageId } });

      if (!fanpage || fanpage.status !== 'CONNECTED') {
        continue;
      }

      for (const event of entry.messaging || []) {
        await handleMessagingEvent(event, fanpage, io);
      }
    }
  } catch (err) {
    console.error('Facebook webhook processing failed:', err.message);
  }
});

async function handleMessagingEvent(event, fanpage, io) {
  const senderPsid = event.sender?.id;
  const messageText = event.message?.text;
  const imageAttachment = event.message?.attachments?.find(a => a.type === 'image');

  if (!senderPsid || (!messageText && !imageAttachment)) {
    return;
  }

  const customer = await findOrCreateCustomer({
    accountId: fanpage.accountId,
    channel: 'FACEBOOK',
    facebookPsid: senderPsid
  });

  const chatbot = await prisma.chatbot.findFirst({
    where: { accountId: fanpage.accountId, status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' }
  });

  const conversation = await findOrCreateConversation({
    accountId: fanpage.accountId,
    customerId: customer.id,
    channel: 'FACEBOOK',
    fanpageId: fanpage.id,
    chatbotId: chatbot?.id
  });

  const message = await appendMessage({
    conversationId: conversation.id,
    senderType: 'CUSTOMER',
    contentType: imageAttachment ? 'IMAGE' : 'TEXT',
    content: messageText || null,
    imageUrl: imageAttachment?.payload?.url || null
  });

  io?.to(`account:${fanpage.accountId}`).emit('message:new', message);

  await maybeGenerateBotReply({
    conversation,
    chatbot,
    incomingMessage: messageText,
    imageUrl: imageAttachment?.payload?.url,
    io
  });
}
