import { buildSkillPrompt } from './skills'

export type GenerateScriptPayload = {
  apiKey: string
  baseUrl: string
  model: string
  creatureName: string
  notes: string
}

export type GenerateScriptResponse = {
  script: string
  model: string
}

export type PromptIdeaPayload = {
  apiKey: string
  baseUrl: string
  model: string
  seedIdea: {
    creature: string
    title: string
    theme: string
  }
}

export type PromptIdeaResponse = {
  idea: {
    creature: string
    title: string
    theme: string
  }
  model: string
}

export type GenerateStoryboardPayload = {
  apiKey: string
  baseUrl: string
  model: string
  narration: string
}

export type StoryboardSegment = {
  title: string
  referenceNarration: string
  environment: string
  rows: Array<{
    shot: string
    duration: string
    visual: string
    sfx: string
  }>
}

export type GenerateStoryboardResponse = {
  storyboard: {
    segments: StoryboardSegment[]
  }
  model: string
}

function getApiBaseUrl() {
  return (
    window.__PREHISTORIC_API_BASE_URL__ ??
    (window.location.protocol === 'file:' ? 'http://127.0.0.1:8787' : '')
  )
}

export async function generateScript(payload: GenerateScriptPayload) {
  const apiBaseUrl = getApiBaseUrl()

  const response = await fetch(`${apiBaseUrl}/api/generate-script`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...payload,
      skills: buildSkillPrompt(),
    }),
  })

  const data = (await response.json().catch(() => ({}))) as
    | GenerateScriptResponse
    | { error?: string }

  if (!response.ok) {
    throw new Error('error' in data && data.error ? data.error : '生成失败，请稍后再试。')
  }

  return data as GenerateScriptResponse
}

export async function generateRandomIdea(payload: PromptIdeaPayload) {
  const apiBaseUrl = getApiBaseUrl()

  const response = await fetch(`${apiBaseUrl}/api/random-idea`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...payload,
      skills: buildSkillPrompt(),
    }),
  })

  const data = (await response.json().catch(() => ({}))) as
    | PromptIdeaResponse
    | { error?: string }

  if (!response.ok) {
    throw new Error('error' in data && data.error ? data.error : '随机创意失败，请稍后再试。')
  }

  return data as PromptIdeaResponse
}

export async function generateStoryboard(payload: GenerateStoryboardPayload) {
  const apiBaseUrl = getApiBaseUrl()

  const response = await fetch(`${apiBaseUrl}/api/generate-storyboard`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const data = (await response.json().catch(() => ({}))) as
    | GenerateStoryboardResponse
    | { error?: string }

  if (!response.ok) {
    throw new Error('error' in data && data.error ? data.error : '生成分镜失败，请稍后再试。')
  }

  return data as GenerateStoryboardResponse
}
