import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

const DB_PATH = process.env.LICENSE_DB_PATH || path.resolve('license-db.json')

async function readDb() {
  try {
    return JSON.parse(await fs.readFile(DB_PATH, 'utf8'))
  } catch {
    return { licenses: {} }
  }
}

async function writeDb(db) {
  await fs.writeFile(DB_PATH, `${JSON.stringify(db, null, 2)}\n`, 'utf8')
}

function getArg(name, fallback = '') {
  const prefix = `--${name}=`
  const arg = process.argv.find((item) => item.startsWith(prefix))
  return arg ? arg.slice(prefix.length).trim() : fallback
}

function generateLicenseKey() {
  const body = crypto.randomBytes(12).toString('hex').toUpperCase()
  return body.match(/.{1,4}/g).join('-')
}

function printUsage() {
  console.log(`Usage:
  npm run license:create -- --days=365 --machines=1 --note="客户名"
  npm run license:list
  npm run license:disable -- --key=XXXX-XXXX-XXXX-XXXX-XXXX-XXXX
  npm run license:enable -- --key=XXXX-XXXX-XXXX-XXXX-XXXX-XXXX
  npm run license:reset-machines -- --key=XXXX-XXXX-XXXX-XXXX-XXXX-XXXX
`)
}

async function createLicense() {
  const db = await readDb()
  const days = Number(getArg('days', '0'))
  const maxMachines = Math.max(1, Number(getArg('machines', '1')) || 1)
  const note = getArg('note')
  const licenseKey = generateLicenseKey()
  const expiresAt =
    days > 0 ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString() : ''

  db.licenses[licenseKey] = {
    status: 'active',
    maxMachines,
    expiresAt,
    machines: [],
    note,
    createdAt: new Date().toISOString(),
  }

  await writeDb(db)

  console.log(`授权码：${licenseKey}`)
  console.log(`设备数：${maxMachines}`)
  console.log(`到期：${expiresAt || '永久'}`)
  if (note) {
    console.log(`备注：${note}`)
  }
}

async function listLicenses() {
  const db = await readDb()
  const entries = Object.entries(db.licenses || {})

  if (entries.length === 0) {
    console.log('暂无授权码。')
    return
  }

  for (const [key, license] of entries) {
    console.log(
      [
        key,
        `状态=${license.status}`,
        `设备=${license.machines?.length || 0}/${license.maxMachines || 1}`,
        `到期=${license.expiresAt || '永久'}`,
        license.note ? `备注=${license.note}` : '',
      ]
        .filter(Boolean)
        .join(' | '),
    )
  }
}

async function updateLicense(updater) {
  const key = getArg('key')

  if (!key) {
    throw new Error('Missing --key=授权码')
  }

  const db = await readDb()
  const license = db.licenses[key]

  if (!license) {
    throw new Error('授权码不存在')
  }

  updater(license)
  await writeDb(db)
  console.log(`已更新：${key}`)
}

const command = process.argv[2]

try {
  if (command === 'create') {
    await createLicense()
  } else if (command === 'list') {
    await listLicenses()
  } else if (command === 'disable') {
    await updateLicense((license) => {
      license.status = 'disabled'
    })
  } else if (command === 'enable') {
    await updateLicense((license) => {
      license.status = 'active'
    })
  } else if (command === 'reset-machines') {
    await updateLicense((license) => {
      license.machines = []
    })
  } else {
    printUsage()
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
