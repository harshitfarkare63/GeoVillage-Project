const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { prisma } = require('../lib/prisma');
const { success, error } = require('../lib/response');

const router = express.Router();

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  plan: z.enum(['FREE', 'PREMIUM', 'PRO']).default('FREE'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ─────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { name, email, password, plan } = registerSchema.parse(req.body);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return error(res, 'EMAIL_TAKEN', 'An account with this email already exists', 409);

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, plan },
    select: { id: true, name: true, email: true, role: true, plan: true, createdAt: true },
  });

  const token = jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: Number(process.env.JWT_EXPIRY) || 3600 }
  );

  success(res, { user, token }, null, 201);
});

// ─────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return error(res, 'INVALID_CREDENTIALS', 'Invalid email or password', 401);

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) return error(res, 'INVALID_CREDENTIALS', 'Invalid email or password', 401);

  const token = jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: Number(process.env.JWT_EXPIRY) || 3600 }
  );

  success(res, {
    user: { id: user.id, name: user.name, email: user.email, role: user.role, plan: user.plan },
    token,
  });
});

// ─────────────────────────────────────────────
// GET /api/auth/me
// ─────────────────────────────────────────────
const { authenticate } = require('../middleware/auth');
router.get('/me', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.sub },
    select: { id: true, name: true, email: true, role: true, plan: true, createdAt: true },
  });
  if (!user) return error(res, 'NOT_FOUND', 'User not found', 404);
  success(res, user);
});

module.exports = router;
