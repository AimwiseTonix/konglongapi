import fs from 'node:fs/promises'
import path from 'node:path'
import qiniu from 'qiniu'

const ROOT = path.resolve(import.meta.dirname, '..')
const RELEASE_DIR = path.join(ROOT, 'release')
const LOCAL_ENV = path.join(ROOT, '.env.qiniu.local')
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

async function findReleaseFiles() {
  const files = await fs.readdir(RELEASE_DIR)
  const targets = files.filter((file) => {
    if (file === 'latest.yml') {
      return true
    }

    if (/\.exe$/i.test(file) && file.startsWith('jushou-writer-')) {
      return true
    }

    return /\.exe\.blockmap$/i.test(file) && file.startsWith('jushou-writer-')
  })

  if (!targets.includes('latest.yml')) {
    throw new Error('release/latest.yml not found. Run npm run dist:win first.')
  }

  if (!targets.some((file) => /\.exe$/i.test(file))) {
    throw new Error('No jushou-writer installer exe found in release/.')
  }

  return targets.map((file) => ({
    localFile: path.join(RELEASE_DIR, file),
    remoteKey: `${REMOTE_PREFIX}/${file}`,
  }))
}

function uploadFile(uploadToken, localFile, remoteKey) {
  const config = new qiniu.conf.Config()
  config.zone = qiniu.zone.Zone_z0
  const formUploader = new qiniu.form_up.FormUploader(config)
  const putExtra = new qiniu.form_up.PutExtra()

  return new Promise((resolve, reject) => {
    formUploader.putFile(uploadToken, remoteKey, localFile, putExtra, (error, body, info) => {
      if (error) {
        reject(error)
        return
      }

      if (info.statusCode >= 400) {
        reject(new Error(`Qiniu upload failed ${info.statusCode}: ${JSON.stringify(body)}`))
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
  const bucket = env.QINIU_BUCKET
  const dryRun = process.argv.includes('--dry-run')

  if (!accessKey || !secretKey || !bucket) {
    throw new Error('Missing QINIU_ACCESS_KEY, QINIU_SECRET_KEY or QINIU_BUCKET in .env.qiniu.local')
  }

  const mac = new qiniu.auth.digest.Mac(accessKey, secretKey)
  const files = await findReleaseFiles()

  for (const file of files) {
    if (dryRun) {
      console.log(`Would upload ${file.remoteKey}`)
      continue
    }

    const options = {
      scope: `${bucket}:${file.remoteKey}`,
      expires: 3600,
      returnBody: '{"key":"$(key)","hash":"$(etag)","size":$(fsize)}',
    }
    const uploadToken = new qiniu.rs.PutPolicy(options).uploadToken(mac)
    await uploadFile(uploadToken, file.localFile, file.remoteKey)
    console.log(`Uploaded ${file.remoteKey}`)
  }

  console.log('Qiniu release upload completed.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
