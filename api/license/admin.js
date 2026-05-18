import {
  generateLicenseKey,
  getRedis,
  isAdminRequest,
  licenseRedisKey,
  readJson,
  readLicense,
  sendJson,
  setCors,
  writeLicense,
} from './_lib.js'

function publicLicense(key, license) {
  return {
    key,
    status: license.status,
    maxMachines: Number(license.maxMachines || 1),
    machines: Array.isArray(license.machines) ? license.machines : [],
    expiresAt: license.expiresAt || '',
    note: license.note || '',
    createdAt: license.createdAt || '',
    updatedAt: license.updatedAt || '',
  }
}

export default async function handler(request, response) {
  setCors(response)

  if (request.method === 'OPTIONS') {
    return response.status(204).end()
  }

  if (!isAdminRequest(request)) {
    return sendJson(response, { ok: false, message: 'Unauthorized' }, 401)
  }

  const redis = getRedis()

  if (request.method === 'GET') {
    const keys = await redis.smembers('licenses')
    const licenses = []

    for (const key of keys.sort()) {
      const license = await readLicense(redis, key)

      if (license) {
        licenses.push(publicLicense(key, license))
      }
    }

    return sendJson(response, { ok: true, licenses })
  }

  if (request.method !== 'POST') {
    return sendJson(response, { ok: false, message: 'Method not allowed' }, 405)
  }

  const body = readJson(request)
  const action = String(body.action || '').trim()

  if (action === 'create') {
    const days = Number(body.days || 0)
    const maxMachines = Math.max(1, Number(body.maxMachines || body.machines || 1) || 1)
    const machineCode = String(body.machineCode || '').trim()
    const licenseKey = generateLicenseKey()
    const expiresAt =
      days > 0 ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString() : ''
    const license = {
      status: 'active',
      maxMachines,
      expiresAt,
      machines: machineCode ? [machineCode] : [],
      note: String(body.note || ''),
      createdAt: new Date().toISOString(),
      updatedAt: '',
    }

    await writeLicense(redis, licenseKey, license)

    return sendJson(response, {
      ok: true,
      license: publicLicense(licenseKey, license),
    })
  }

  const licenseKey = String(body.licenseKey || body.key || '').trim()

  if (!licenseKey) {
    return sendJson(response, { ok: false, message: 'Missing licenseKey' }, 400)
  }

  const license = await readLicense(redis, licenseKey)

  if (!license) {
    return sendJson(response, { ok: false, message: '授权码不存在。' }, 404)
  }

  if (action === 'disable') {
    license.status = 'disabled'
  } else if (action === 'enable') {
    license.status = 'active'
  } else if (action === 'reset-machines') {
    license.machines = []
  } else if (action === 'delete') {
    await redis.del(licenseRedisKey(licenseKey))
    await redis.srem('licenses', licenseKey)
    return sendJson(response, { ok: true })
  } else {
    return sendJson(response, { ok: false, message: 'Unknown action' }, 400)
  }

  license.updatedAt = new Date().toISOString()
  await writeLicense(redis, licenseKey, license)

  return sendJson(response, {
    ok: true,
    license: publicLicense(licenseKey, license),
  })
}
