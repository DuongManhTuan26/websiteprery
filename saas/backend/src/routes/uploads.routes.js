import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/errorHandler.js';
import { saveUpload } from '../services/storage.service.js';

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

// Buffered in memory, not written to disk directly by multer — saveUpload()
// decides where the bytes actually end up (local disk vs. S3), so this
// route doesn't need to know or care which backend is active.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, ALLOWED_MIME.has(file.mimetype))
});

// Backs the documented "khách gửi AI tư vấn được ảnh và khách yêu cầu xem
// ảnh AI cũng sẽ gửi" flow — an agent (dashboard) or a widget visitor
// uploads an image, gets back a URL, and that URL becomes a real
// Message.imageUrl / gets sent to the AI as vision input.
export const uploadsRouter = Router();

// Dashboard/agent upload — authenticated.
uploadsRouter.post('/', requireAuth, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'No file uploaded, or file type not allowed (png/jpeg/webp/gif only)');
  }

  const { url } = await saveUpload(req.file.buffer, req.file.originalname, req.file.mimetype);
  res.status(201).json({ url });
}));

// Widget (public, anonymous) upload — same size/type limits, no auth since
// website visitors aren't logged in.
uploadsRouter.post('/widget', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'No file uploaded, or file type not allowed (png/jpeg/webp/gif only)');
  }

  const { url } = await saveUpload(req.file.buffer, req.file.originalname, req.file.mimetype);
  res.status(201).json({ url });
}));
