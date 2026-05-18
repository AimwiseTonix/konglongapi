const [, , command] = process.argv

function getArg(name, fallback = '') {
  const prefix = `--${name}=`
  const arg = process.argv.find((item) => item.startsWith(prefix))
  return arg ? arg.slice(prefix.length).trim() : fallback
}

function getConfig() {
  const baseUrl = (process.env.LICENSE_SERVER_URL || getArg('url')).replace(/\/+$/, '')
  const adminToken = process.env.LICENSE_ADMIN_TOKEN || getArg('token')

  if (!baseUrl || !adminToken) {
    throw new Error('Missing LICENSE_SERVER_URL or LICENSE_ADMIN_TOKEN')
  }

  return { baseUrl, adminToken }
}

async function request(method, body) {
  const { baseUrl, adminToken } = getConfig()
  const response = await fetch(`${baseUrl}/api/license/admin`, {
    method,
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await response.json().catch(() => ({}))

  if (!response.ok || data.ok === false) {
    throw new Error(data.message || data.error || `Request failed: ${response.status}`)
  }

  return data
}

function printLicense(license) {
  console.log(
    [
      license.key,
      `状态=${license.status}`,
      `设备=${license.machines?.length || 0}/${license.maxMachines}`,
      `到期=${license.expiresAt || '永久'}`,
      license.note ? `备注=${license.note}` : '',
    ]
      .filter(Boolean)
      .join(' | '),
  )
}

function printUsage() {
  console.log(`Usage:
  npm run license:remote:create -- --url=https://xxx.vercel.app --token=管理密钥 --days=365 --machines=1 --note="客户名"
  npm run license:remote:list -- --url=https://xxx.vercel.app --token=管理密钥
  npm run license:remote:disable -- --url=https://xxx.vercel.app --token=管理密钥 --key=授权码
  npm run license:remote:enable -- --url=https://xxx.vercel.app --token=管理密钥 --key=授权码
  npm run license:remote:reset-machines -- --url=https://xxx.vercel.app --token=管理密钥 --key=授权码
`)
}

try {
  if (command === 'create') {
    const data = await request('POST', {
      action: 'create',
      days: Number(getArg('days', '0')),
      maxMachines: Number(getArg('machines', '1')),
      note: getArg('note'),
    })
    printLicense(data.license)
  } else if (command === 'list') {
    const data = await request('GET')
    if (!data.licenses?.length) {
      console.log('暂无线上授权码。')
    } else {
      data.licenses.forEach(printLicense)
    }
  } else if (['disable', 'enable', 'reset-machines', 'delete'].includes(command)) {
    const data = await request('POST', {
      action: command,
      licenseKey: getArg('key'),
    })
    if (data.license) {
      printLicense(data.license)
    } else {
      console.log('操作完成。')
    }
  } else {
    printUsage()
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
