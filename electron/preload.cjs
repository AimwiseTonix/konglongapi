const { contextBridge, ipcRenderer } = require('electron')

const apiArg = process.argv.find((argument) => argument.startsWith('--api-base-url='))

if (apiArg) {
  contextBridge.exposeInMainWorld(
    '__PREHISTORIC_API_BASE_URL__',
    decodeURIComponent(apiArg.replace('--api-base-url=', '')),
  )
}

contextBridge.exposeInMainWorld('__PREHISTORIC_SECURE_SETTINGS__', {
  load: () => ipcRenderer.invoke('settings:load'),
  save: (settings) => ipcRenderer.invoke('settings:save', settings),
})

contextBridge.exposeInMainWorld('__PREHISTORIC_LICENSE__', {
  status: () => ipcRenderer.invoke('license:status'),
  activate: (licenseKey) => ipcRenderer.invoke('license:activate', licenseKey),
  validate: () => ipcRenderer.invoke('license:validate'),
  getMachineCode: () => ipcRenderer.invoke('license:machine-code'),
  getServerStatus: () => ipcRenderer.invoke('license:server-status'),
})

contextBridge.exposeInMainWorld('__PREHISTORIC_APP__', {
  getInfo: () => ipcRenderer.invoke('app:info'),
})

contextBridge.exposeInMainWorld('__PREHISTORIC_UPDATER__', {
  getStatus: () => ipcRenderer.invoke('update:status'),
  check: () => ipcRenderer.invoke('update:check'),
})
