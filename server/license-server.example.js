import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import express from 'express'

const PORT = Number(process.env.PORT || 8999)
const TOKEN_SECRET = process.env.LICENSE_TOKEN_SECRET || 'change-this-before-selling'
const DB_PATH = process.env.LICENSE_DB_PATH || path.resolve('license-db.json')

async function readDb() {
  try {
    return JSON.parse(await fs.readFile(DB_PATH, 'utf8'))
  } catch {
    return {
      licenses: {
        'DEMO-1234-5678': {
          status: 'active',
          maxMachines: 1,
          expiresAt: '',
          machines: [],
        },
      },
    }
  }
}

async function writeDb(db) {
  await fs.writeFile(DB_PATH, `${JSON.stringify(db, null, 2)}\n`, 'utf8')
}

function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const signature = crypto.createHmac('sha256', TOKEN_SECRET).update(body).digest('base64url')
  return `${body}.${signature}`
}

function verifyToken(token) {
  const [body, signature] = String(token || '').split('.')

  if (!body || !signature) {
    return null
  }

  const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(body).digest('base64url')

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null
  }

  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

function isExpired(expiresAt) {
  return Boolean(expiresAt) && Date.now() > Date.parse(expiresAt)
}

const app = express()
app.use(express.json())

app.get('/api/license/health', (_request, response) => {
  response.json({ ok: true })
})

app.post('/api/license/activate', async (request, response) => {
  const { licenseKey, machineCode, appVersion } = request.body || {}
  const key = String(licenseKey || '').trim()
  const machine = String(machineCode || '').trim()
  const db = await readDb()
  const license = db.licenses[key]

  if (!license || license.status !== 'active') {
    response.status(403).json({ ok: false, message: '授权码不存在或已停用。' })
    return
  }

  if (isExpired(license.expiresAt)) {
    response.status(403).json({ ok: false, message: '授权码已过期。' })
    return
  }

  if (!license.machines.includes(machine)) {
    if (license.machines.length >= license.maxMachines) {
      response.status(403).json({ ok: false, message: '授权设备数量已达到上限。' })
      return
    }

    license.machines.push(machine)
    await writeDb(db)
  }

  const token = signToken({
    licenseKey: key,
    machineCode: machine,
    appVersion,
    issuedAt: new Date().toISOString(),
  })

  response.json({
    ok: true,
    token,
    expiresAt: license.expiresAt || '',
    message: '授权成功。',
  })
})

app.post('/api/license/validate', async (request, response) => {
  const { token, machineCode } = request.body || {}
  const payload = verifyToken(token)

  if (!payload || payload.machineCode !== machineCode) {
    response.status(403).json({ ok: false, message: '授权凭证无效。' })
    return
  }

  const db = await readDb()
  const license = db.licenses[payload.licenseKey]

  if (!license || license.status !== 'active' || !license.machines.includes(machineCode)) {
    response.status(403).json({ ok: false, message: '授权已被停用或设备未绑定。' })
    return
  }

  if (isExpired(license.expiresAt)) {
    response.status(403).json({ ok: false, message: '授权码已过期。' })
    return
  }

  response.json({
    ok: true,
    expiresAt: license.expiresAt || '',
    message: '授权有效。',
  })
})

app.listen(PORT, () => {
  console.log(`License server example running on http://127.0.0.1:${PORT}`)
})
