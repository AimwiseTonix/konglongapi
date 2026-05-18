import crypto from 'node:crypto'
import { Redis } from '@upstash/redis'

const TOKEN_SECRET = process.env.LICENSE_TOKEN_SECRET || ''
const ADMIN_TOKEN = process.env.LICENSE_ADMIN_TOKEN || ''

export function getRedis() {
  return Redis.fromEnv()
}

export function requireTokenSecret() {
  if (!TOKEN_SECRET) {
    throw new Error('Missing LICENSE_TOKEN_SECRET')
  }
}

export function isAdminRequest(request) {
  if (!ADMIN_TOKEN) {
    return false
  }

  const header =
    request.headers?.authorization ||
    request.headers?.Authorization ||
    request.headers?.get?.('authorization') ||
    ''
  const token = header.replace(/^Bearer\s+/i, '').trim()
  return token === ADMIN_TOKEN
}

export function licenseRedisKey(licenseKey) {
  return `license:${licenseKey}`
}

export function generateLicenseKey() {
  return crypto.randomBytes(12).toString('hex').toUpperCase().match(/.{1,4}/g).join('-')
}

export function signToken(payload) {
  requireTokenSecret()
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const signature = crypto.createHmac('sha256', TOKEN_SECRET).update(body).digest('base64url')
  return `${body}.${signature}`
}

export function verifyToken(token) {
  requireTokenSecret()
  const [body, signature] = String(token || '').split('.')

  if (!body || !signature) {
    return null
  }

  const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(body).digest('base64url')
  const actualBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)

  if (actualBuffer.length !== expectedBuffer.length) {
    return null
  }

  if (!crypto.timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null
  }

  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

export function normalizeLicense(raw) {
  if (!raw) {
    return null
  }

  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }

  return raw
}

export async function readLicense(redis, licenseKey) {
  return normalizeLicense(await redis.get(licenseRedisKey(licenseKey)))
}

export async function writeLicense(redis, licenseKey, license) {
  await redis.set(licenseRedisKey(licenseKey), license)
  await redis.sadd('licenses', licenseKey)
}

export function isExpired(expiresAt) {
  return Boolean(expiresAt) && Date.now() > Date.parse(expiresAt)
}

export function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
}

export function sendJson(res, response, status = 200) {
  setCors(res)
  res.status(status).json(response)
}

export function readJson(request) {
  return request.body && typeof request.body === 'object' ? request.body : {}
}
