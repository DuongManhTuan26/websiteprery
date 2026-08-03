import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { requireAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 10);
    cb(null, `${crypto.randomUUID()}${ext}`);
  }
});

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, ALLOWED_MIME.has(file.mimetype))
});

// Backs the documented "khách gửi AI tư vấn được ảnh và khách yêu cầu xem
// ảnh AI cũng sẽ gửi" flow — an agent (dashboard) or a widget visitor
// uploads an image, gets back a URL, and that URL becomes a real
// Message.imageUrl / gets sent to the AI as vision input.
export const uploadsRouter = Router();

// Dashboard/agent upload — authenticated.
uploadsRouter.post('/', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'No file uploaded, or file type not allowed (png/jpeg/webp/gif only)');
  }

  res.status(201).json({ url: `/uploads/${req.file.filename}` });
});

// Widget (public, anonymous) upload — same size/type limits, no auth since
// website visitors aren't logged in.
uploadsRouter.post('/widget', upload.single('file'), (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'No file uploaded, or file type not allowed (png/jpeg/webp/gif only)');
  }

  res.status(201).json({ url: `/uploads/${req.file.filename}` });
});
