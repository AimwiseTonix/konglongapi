export {}

declare global {
  type PrehistoricSettings = {
    apiKey?: string
    baseUrl?: string
    model?: string
  }

  type PrehistoricLicenseStatus = {
    ok?: boolean
    required?: boolean
    hasToken?: boolean
    licensed?: boolean
    licenseKey?: string
    machineCode?: string
    token?: string
    expiresAt?: string
    message?: string
  }

  type PrehistoricLicenseServerStatus = {
    configured?: boolean
    reachable?: boolean
    url?: string
    message?: string
  }

  type PrehistoricAppInfo = {
    version?: string
    packaged?: boolean
    updateFeed?: string
  }

  type PrehistoricUpdateStatus = {
    checking?: boolean
    available?: boolean
    downloaded?: boolean
    version?: string
    message?: string
    checkedAt?: string
  }

  interface Window {
    __PREHISTORIC_API_BASE_URL__?: string | undefined
    __PREHISTORIC_SECURE_SETTINGS__?:
      | {
          load: () => Promise<PrehistoricSettings>
          save: (settings: PrehistoricSettings) => Promise<{ ok: boolean }>
        }
      | undefined
    __PREHISTORIC_LICENSE__?:
      | {
          status: () => Promise<PrehistoricLicenseStatus>
          activate: (licenseKey: string) => Promise<PrehistoricLicenseStatus>
          validate: () => Promise<PrehistoricLicenseStatus>
          getMachineCode: () => Promise<string>
          getServerStatus: () => Promise<PrehistoricLicenseServerStatus>
        }
      | undefined
    __PREHISTORIC_APP__?:
      | {
          getInfo: () => Promise<PrehistoricAppInfo>
        }
      | undefined
    __PREHISTORIC_UPDATER__?:
      | {
          getStatus: () => Promise<PrehistoricUpdateStatus>
          check: () => Promise<PrehistoricUpdateStatus>
        }
      | undefined
  }
}
