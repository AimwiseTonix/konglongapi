import { getRedis, isExpired, readJson, readLicense, sendJson, setCors, verifyToken } from './_lib.js'

export default async function handler(request, response) {
  setCors(response)

  if (request.method === 'OPTIONS') {
    return response.status(204).end()
  }

  if (request.method !== 'POST') {
    return sendJson(response, { ok: false, message: 'Method not allowed' }, 405)
  }

  const { token, machineCode } = readJson(request)
  const machine = String(machineCode || '').trim()
  const payload = verifyToken(token)

  if (!payload || payload.machineCode !== machine) {
    return sendJson(response, { ok: false, message: '授权凭证无效。' }, 403)
  }

  const redis = getRedis()
  const license = await readLicense(redis, payload.licenseKey)

  if (!license || license.status !== 'active') {
    return sendJson(response, { ok: false, message: '授权已被停用。' }, 403)
  }

  if (isExpired(license.expiresAt)) {
    return sendJson(response, { ok: false, message: '授权码已过期。' }, 403)
  }

  if (!Array.isArray(license.machines) || !license.machines.includes(machine)) {
    return sendJson(response, { ok: false, message: '当前机器未绑定此授权码。' }, 403)
  }

  return sendJson(response, {
    ok: true,
    expiresAt: license.expiresAt || '',
    message: '授权有效。',
  })
}
