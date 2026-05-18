import {
  getRedis,
  isExpired,
  readJson,
  readLicense,
  sendJson,
  signToken,
  setCors,
  writeLicense,
} from './_lib.js'

export default async function handler(request, response) {
  setCors(response)

  if (request.method === 'OPTIONS') {
    return response.status(204).end()
  }

  if (request.method !== 'POST') {
    return sendJson(response, { ok: false, message: 'Method not allowed' }, 405)
  }

  const { licenseKey, machineCode, appVersion } = readJson(request)
  const key = String(licenseKey || '').trim()
  const machine = String(machineCode || '').trim()

  if (!key || !machine) {
    return sendJson(response, { ok: false, message: '缺少授权码或机器码。' }, 400)
  }

  const redis = getRedis()
  const license = await readLicense(redis, key)

  if (!license || license.status !== 'active') {
    return sendJson(response, { ok: false, message: '授权码不存在或已停用。' }, 403)
  }

  if (isExpired(license.expiresAt)) {
    return sendJson(response, { ok: false, message: '授权码已过期。' }, 403)
  }

  const machines = Array.isArray(license.machines) ? license.machines : []

  if (!machines.includes(machine)) {
    if (machines.length >= Number(license.maxMachines || 1)) {
      return sendJson(response, { ok: false, message: '授权设备数量已达到上限。' }, 403)
    }

    machines.push(machine)
    license.machines = machines
    license.updatedAt = new Date().toISOString()
    await writeLicense(redis, key, license)
  }

  const token = signToken({
    licenseKey: key,
    machineCode: machine,
    appVersion: String(appVersion || ''),
    issuedAt: new Date().toISOString(),
  })

  return sendJson(response, {
    ok: true,
    token,
    expiresAt: license.expiresAt || '',
    message: '授权成功。',
  })
}
