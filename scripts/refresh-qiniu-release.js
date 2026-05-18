import fs from 'node:fs/promises'
import path from 'node:path'
import qiniu from 'qiniu'

const ROOT = path.resolve(import.meta.dirname, '..')
const RELEASE_DIR = path.join(ROOT, 'release')
const LOCAL_ENV = path.join(ROOT, '.env.qiniu.local')
const PUBLIC_BASE_URL = 'https://tonixx.aimwise.cn'
const REMOTE_PREFIX = 'jushou-writer'

async function readLocalEnv() {
  const text = await fs.readFile(LOCAL_ENV, 'utf8')
  const env = {}

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()

    if (!line || line.startsWith('#')) {
      continue
    }

    const separatorIndex = line.indexOf('=')

    if (separatorIndex === -1) {
      continue
    }

    const key = line.slice(0, separatorIndex).trim()
    const value = line.slice(separatorIndex + 1).trim()
    env[key] = value.replace(/^['"]|['"]$/g, '')
  }

  return env
}

async function findReleaseUrls() {
  const files = await fs.readdir(RELEASE_DIR)
  const latestYaml = await fs.readFile(path.join(RELEASE_DIR, 'latest.yml'), 'utf8')
  const installerMatch = latestYaml.match(/^path:\s*(.+)$/m)

  if (!installerMatch) {
    throw new Error('release/latest.yml does not include a path entry.')
  }

  const installerFile = installerMatch[1].trim()
  const versionMatch = installerFile.match(/^jushou-writer-(.+)-x64\.exe$/i)

  if (!versionMatch) {
    throw new Error(`Unable to infer release version from ${installerFile}.`)
  }

  const version = versionMatch[1]
  const targets = [
    'latest.yml',
    `jushou-writer-${version}-x64.exe`,
    `jushou-writer-${version}-x64.exe.blockmap`,
    `jushou-writer-portable-${version}-x64.exe`,
  ].filter((file) => files.includes(file))

  return targets.map((file) => `${PUBLIC_BASE_URL}/${REMOTE_PREFIX}/${file}`)
}

function refreshUrls(mac, urls) {
  const cdnManager = new qiniu.cdn.CdnManager(mac)

  return new Promise((resolve, reject) => {
    cdnManager.refreshUrls(urls, (error, body, info) => {
      if (error) {
        reject(error)
        return
      }

      if (info.statusCode >= 400) {
        reject(new Error(`Qiniu refresh failed ${info.statusCode}: ${JSON.stringify(body)}`))
        return
      }

      resolve(body)
    })
  })
}

async function main() {
  const env = await readLocalEnv()
  const accessKey = env.QINIU_ACCESS_KEY
  const secretKey = env.QINIU_SECRET_KEY

  if (!accessKey || !secretKey) {
    throw new Error('Missing QINIU_ACCESS_KEY or QINIU_SECRET_KEY in .env.qiniu.local')
  }

  const mac = new qiniu.auth.digest.Mac(accessKey, secretKey)
  const urls = await findReleaseUrls()
  const result = await refreshUrls(mac, urls)
  console.log(JSON.stringify(result))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
