import { app, BrowserWindow, dialog, ipcMain, safeStorage, shell } from 'electron'
import electronUpdater from 'electron-updater'
import { execFile } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { startServer } from '../server/index.js'
import { LICENSE_SERVER_URL } from './app-config.js'

const { autoUpdater } = electronUpdater
const execFileAsync = promisify(execFile)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const useDevServer = process.env.DESKTOP_DEV === '1'
const apiPort = Number(process.env.PORT || 0)
const licenseServerUrl = (process.env.LICENSE_SERVER_URL || LICENSE_SERVER_URL || '').replace(/\/+$/, '')

let apiServer
let mainWindow
let updateStatus = {
  checking: false,
  available: false,
  downloaded: false,
  version: '',
  message: '',
  checkedAt: '',
}

app.setName('科普巨兽剧本台')
app.setPath('userData', path.join(app.getPath('appData'), 'KepuJushouWriter'))
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')

const secureSettingsPath = () => path.join(app.getPath('userData'), 'secure-settings.json')
const licensePath = () => path.join(app.getPath('userData'), 'license.json')

async function readJson(filePath, fallback = {}) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'))
  } catch {
    return fallback
  }
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

function encryptText(value) {
  const plainText = typeof value === 'string' ? value : ''

  if (!plainText) {
    return ''
  }

  if (!safeStorage.isEncryptionAvailable()) {
    return Buffer.from(plainText, 'utf8').toString('base64')
  }

  return safeStorage.encryptString(plainText).toString('base64')
}

function decryptText(value) {
  if (!value || typeof value !== 'string') {
    return ''
  }

  const buffer = Buffer.from(value, 'base64')

  if (!safeStorage.isEncryptionAvailable()) {
    return buffer.toString('utf8')
  }

  return safeStorage.decryptString(buffer)
}

async function loadSecureSettings() {
  const data = await readJson(secureSettingsPath(), {})

  return {
    apiKey: decryptText(data.apiKey),
    baseUrl: typeof data.baseUrl === 'string' ? data.baseUrl : '',
    model: typeof data.model === 'string' ? data.model : '',
  }
}

async function saveSecureSettings(_event, settings = {}) {
  const next = {
    apiKey: encryptText(settings.apiKey),
    baseUrl: typeof settings.baseUrl === 'string' ? settings.baseUrl : '',
    model: typeof settings.model === 'string' ? settings.model : '',
    updatedAt: new Date().toISOString(),
  }

  await writeJson(secureSettingsPath(), next)
  return { ok: true }
}

function hashMachineParts(parts) {
  return crypto
    .createHash('sha256')
    .update(parts.filter(Boolean).join('|'))
    .digest('hex')
    .slice(0, 32)
    .toUpperCase()
    .replace(/(.{4})/g, '$1-')
    .replace(/-$/, '')
}

async function getWindowsUuid() {
  if (process.platform !== 'win32') {
    return ''
  }

  try {
    const { stdout } = await execFileAsync('wmic', ['csproduct', 'get', 'uuid'], {
      windowsHide: true,
      timeout: 2500,
    })
    return stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line && !/^uuid$/i.test(line) && !/^0+$/.test(line)) ?? ''
  } catch {
    return ''
  }
}

async function getMachineCode() {
  const uuid = await getWindowsUuid()
  const parts = [
    'prehistoric-giants-writer',
    process.platform,
    os.arch(),
    os.hostname(),
    os.userInfo().username,
    uuid,
  ]

  return hashMachineParts(parts)
}

async function loadLicense() {
  const data = await readJson(licensePath(), {})
  const machineCode = await getMachineCode()
  const required = app.isPackaged || process.env.LICENSE_REQUIRED === '1'

  return {
    required,
    hasToken: Boolean(data.token),
    licensed: !required && Boolean(data.token),
    licenseKey: typeof data.licenseKey === 'string' ? data.licenseKey : '',
    machineCode,
    token: typeof data.token === 'string' ? data.token : '',
    expiresAt: typeof data.expiresAt === 'string' ? data.expiresAt : '',
    message: licenseServerUrl ? '' : '未配置授权服务器，当前仅显示机器码。',
  }
}

async function requestLicense(endpoint, payload) {
  if (!licenseServerUrl) {
    return {
      ok: false,
      message: '还没有配置授权服务器地址。请先部署授权服务，并用 LICENSE_SERVER_URL 指向它。',
    }
  }

  const response = await fetch(`${licenseServerUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const data = await response.json().catch(() => ({}))

  if (!response.ok || data.ok === false) {
    return {
      ok: false,
      message: data.message || data.error || `授权服务器返回 ${response.status}`,
    }
  }

  return data
}

async function activateLicense(_event, licenseKey = '') {
  const trimmedKey = typeof licenseKey === 'string' ? licenseKey.trim() : ''
  const machineCode = await getMachineCode()

  if (!trimmedKey) {
    return { ok: false, machineCode, message: '请输入授权码。' }
  }

  const result = await requestLicense('/api/license/activate', {
    licenseKey: trimmedKey,
    machineCode,
    appVersion: app.getVersion(),
  })

  if (!result.ok) {
    return { ...result, machineCode }
  }

  await writeJson(licensePath(), {
    licenseKey: trimmedKey,
    token: result.token,
    expiresAt: result.expiresAt || '',
    activatedAt: new Date().toISOString(),
  })

  return {
    ok: true,
    licensed: true,
    machineCode,
    expiresAt: result.expiresAt || '',
    message: result.message || '授权成功。',
  }
}

async function validateLicense() {
  const current = await loadLicense()

  if (!current.token) {
    return { ok: false, ...current, message: current.message || '未激活。' }
  }

  const result = await requestLicense('/api/license/validate', {
    token: current.token,
    machineCode: current.machineCode,
    appVersion: app.getVersion(),
  })

  if (!result.ok) {
    return { ok: false, ...current, licensed: false, message: result.message || '授权校验失败。' }
  }

  return {
    ok: true,
    licensed: true,
    licenseKey: current.licenseKey,
    machineCode: current.machineCode,
    token: current.token,
    expiresAt: result.expiresAt || current.expiresAt,
    message: result.message || '授权有效。',
  }
}

async function getLicenseServerStatus() {
  if (!licenseServerUrl) {
    return {
      configured: false,
      reachable: false,
      url: '',
      message: '未配置授权服务器。软件授权功能需要部署授权服务后才能正式启用。',
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(`${licenseServerUrl}/api/license/health`, {
      method: 'GET',
      signal: controller.signal,
    })

    return {
      configured: true,
      reachable: response.ok,
      url: licenseServerUrl,
      message: response.ok ? '授权服务器连接正常。' : `授权服务器返回 ${response.status}。`,
    }
  } catch (error) {
    return {
      configured: true,
      reachable: false,
      url: licenseServerUrl,
      message: error instanceof Error ? error.message : '授权服务器连接失败。',
    }
  } finally {
    clearTimeout(timeout)
  }
}

function getAppInfo() {
  return {
    version: app.getVersion(),
    packaged: app.isPackaged,
    updateFeed: 'https://tonixx.aimwise.cn/jushou-writer/',
  }
}

async function checkForUpdatesManually() {
  if (useDevServer || !app.isPackaged) {
    updateStatus = {
      checking: false,
      available: false,
      downloaded: false,
      version: '',
      message: '源码/开发模式不会执行自动更新；打包安装版会从七牛云检查更新。',
      checkedAt: new Date().toISOString(),
    }
    return updateStatus
  }

  updateStatus = {
    checking: true,
    available: false,
    downloaded: false,
    version: '',
    message: '正在检查更新...',
    checkedAt: new Date().toISOString(),
  }

  try {
    const result = await autoUpdater.checkForUpdates()
    const version = result?.updateInfo?.version || ''
    updateStatus = {
      checking: false,
      available: Boolean(version && version !== app.getVersion()),
      downloaded: false,
      version,
      message:
        version && version !== app.getVersion()
          ? `发现新版本 ${version}，正在后台下载。`
          : '当前已经是最新版本。',
      checkedAt: new Date().toISOString(),
    }
  } catch (error) {
    updateStatus = {
      checking: false,
      available: false,
      downloaded: false,
      version: '',
      message: error instanceof Error ? error.message : '检查更新失败。',
      checkedAt: new Date().toISOString(),
    }
  }

  return updateStatus
}

function setupIpc() {
  ipcMain.handle('settings:load', loadSecureSettings)
  ipcMain.handle('settings:save', saveSecureSettings)
  ipcMain.handle('license:status', loadLicense)
  ipcMain.handle('license:activate', activateLicense)
  ipcMain.handle('license:validate', validateLicense)
  ipcMain.handle('license:machine-code', getMachineCode)
  ipcMain.handle('license:server-status', getLicenseServerStatus)
  ipcMain.handle('app:info', getAppInfo)
  ipcMain.handle('update:status', () => updateStatus)
  ipcMain.handle('update:check', checkForUpdatesManually)
}

function setupAutoUpdater() {
  if (useDevServer || !app.isPackaged) {
    return
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-downloaded', () => {
    updateStatus = {
      ...updateStatus,
      checking: false,
      available: true,
      downloaded: true,
      message: '新版本已经下载完成，重启后会自动安装。',
      checkedAt: new Date().toISOString(),
    }

    void dialog
      .showMessageBox(mainWindow, {
        type: 'info',
        buttons: ['立即重启更新', '下次启动再说'],
        defaultId: 0,
        cancelId: 1,
        title: '发现新版本',
        message: '新版本已经下载完成。',
        detail: '重启后会自动安装更新。',
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall()
        }
      })
  })

  autoUpdater.on('error', (error) => {
    updateStatus = {
      checking: false,
      available: false,
      downloaded: false,
      version: '',
      message: error instanceof Error ? error.message : '自动更新失败。',
      checkedAt: new Date().toISOString(),
    }
    console.error('Auto update failed:', error)
  })

  setTimeout(() => {
    void autoUpdater.checkForUpdates()
  }, 2500)
}

async function createWindow() {
  apiServer = await startServer(apiPort)
  const address = apiServer.address()
  const resolvedApiPort = typeof address === 'object' && address ? address.port : 8787
  const apiBaseUrl = `http://127.0.0.1:${resolvedApiPort}`

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 680,
    title: '科普巨兽剧本台',
    backgroundColor: '#030407',
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      additionalArguments: [`--api-base-url=${encodeURIComponent(apiBaseUrl)}`],
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (!useDevServer) {
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' ${apiBaseUrl}; img-src 'self' data:; font-src 'self' data:;`,
          ],
        },
      })
    })
  }

  if (useDevServer) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5317')
    return
  }

  await mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  setupAutoUpdater()
}

app.whenReady().then(() => {
  setupIpc()
  void createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  apiServer?.close()
})
