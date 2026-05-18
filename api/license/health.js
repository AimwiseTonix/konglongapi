import { getRedis, sendJson, setCors } from './_lib.js'

export default async function handler(_request, response) {
  setCors(response)

  try {
    const redis = getRedis()
    await redis.ping()
    return sendJson(response, { ok: true, storage: 'upstash-redis' })
  } catch (error) {
    return sendJson(
      response,
      {
        ok: false,
        message: error instanceof Error ? error.message : 'License server health check failed',
      },
      500,
    )
  }
}
