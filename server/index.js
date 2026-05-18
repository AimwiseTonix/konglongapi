import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_PORT = Number(process.env.PORT || 8787)
const DEFAULT_MODEL = 'gemini-3.1-pro-preview'
const RANDOM_IDEA_MODEL = 'gemini-3.1-flash-lite'
const DEFAULT_BASE_URL = 'https://yunwu.ai'

function normalizeBaseUrl(baseUrl) {
  const safeBase = typeof baseUrl === 'string' && baseUrl.trim() ? baseUrl.trim() : DEFAULT_BASE_URL
  return safeBase.replace(/\/+$/, '')
}

function buildChatCompletionsEndpoint(baseUrl) {
  const normalized = normalizeBaseUrl(baseUrl)

  if (normalized.endsWith('/chat/completions')) {
    return normalized
  }

  if (normalized.endsWith('/v1')) {
    return `${normalized}/chat/completions`
  }

  return `${normalized}/v1/chat/completions`
}

function buildSystemPrompt(skills) {
  return `你是“史前巨兽科普剧本导演”，专门为中文短视频和中视频创作 4-5 分钟史前生物科普解说。

你必须自动调用并遵守以下本地写作 skills：
${skills}

输出要求：
- 使用中文。
- 生成 4-5 分钟视频剧本，整体约 1000-1300 个汉字。
- 标题要有节目感，但不能标题党。
- 结构必须包含：片名、开场、3-5 个正文段落、结尾、科学备注。
- 正文段落要写清时间码，例如【0:00-0:25】。
- 旁白为主，可加入少量“画面提示”，画面提示用“画面：”开头。
- 科学事实不能确定时，要写“可能”“推测”“约”“目前化石显示”。
- 不要输出道歉、免责声明或无关解释。`
}

function buildUserPrompt(creatureName, notes) {
  const extra = typeof notes === 'string' && notes.trim() ? `\n补充要求：${notes.trim()}` : ''
  return `请为“${creatureName}”写一条史前巨兽科普视频剧本。${extra}`
}

function buildStoryboardSystemPrompt() {
  return `# 角色设定
你是一位顶级的“史前巨兽纪录片”分镜头脚本师与AI视频提示词专家。你擅长根据解说文案的节奏，设计极具视觉冲击力和巨物压迫感的分镜头脚本。你的风格是极致的写实、纯粹的音效沉浸，以及动静结合的剪辑节奏。

# 核心原则
1. **字数与时长锚定**：科普类旁白语速设定为 200字/分钟（即 **15秒 ≈ 50个汉字**）。你必须严格按照“每40-55个汉字为一段”的标准，将我提供的完整旁白切割成一个个 12-15秒 的视觉大片段。
2. **旁白仅为进度导航（绝对隔离）**：在每个片段的开头，你只需要告诉我“这一段对应的是哪一段旁白（作为参考标记）”。但是，在具体的【分镜画面与提示词】中，**绝对不要**包含、翻译或提及任何旁白内容。视频提示词必须是100%脱离文本的纯视觉动作和光影描述。
3. **片段开头重塑（画面连贯性）**：在开始分镜前，必须输出【环境与角色设定】模块，详细描述当前的环境氛围，以及该片段中出现的所有角色的外貌细节、状态和体型特征。
4. **动静结合的剪辑节奏**：**不要只有长镜头，也不要一味切碎**。必须根据张力灵活切换节奏：
   - **长镜头（6-10秒）**：用于环境展现、巨兽登场的压迫感铺垫，使用缓慢的推拉、环绕或凝视调度。
   - **快节奏切换（1-3秒）**：用于局部特写（如猛然睁眼、肌肉发力、脚踩断木）或突发动作，通过极富冲击力的快切拉升肾上腺素。
5. **纯音效无音乐（SFX Only）**：视频完全不需要背景音乐（No BGM）。你必须为每个镜头设计高度拟真、沉浸的**纯音效（SFX）**，例如：低频呼吸、沉重的骨骼摩擦、泥泞的脚步声、树木爆裂的巨响等。

# 专业摄影调度库（巨兽特化版）
- **长镜头调度**：缓慢推镜 (Slow Push-in)、连续环绕 (Continuous Orbit)、固定凝视巨物 (Static Wide Shot)。
- **快节奏镜头**：极速推镜头 (Crash Zoom)、微距局部特写 (Macro Close-up)、主观视角剧烈晃动 (POV Shake)。
- **光效与氛围**：逆光剪影、丁达尔体积光、空气因高温/低频声波产生的视觉扭曲。

# 输出示例参考
**【片段一：0-15秒】**

**►【参考旁白进度】**
（仅作进度定位标识，视频生成时不使用此文本）
*“在白垩纪末期的热带雨林中，真正的霸主正在苏醒。长达13米的庞健身躯，让它的每一次呼吸，都伴随着死神的低语。一场杀戮，即将拉开帷幕。”*

**►【环境与角色设定】**
- **环境描述**：白垩纪末期的原始雨林，雾气弥漫，地面满是泥泞的水洼和巨型蕨类植物。丁达尔光效穿透树冠，空气中漂浮着湿润的尘埃。
- **角色详情**：
  1. **霸王龙**：一头体长超过13米的成年雄性，浑身覆盖着黑褐色的粗糙厚鳞。处于极度饥饿、暴躁的苏醒状态，充满重量感与危险气息。

**►【分镜设计与视觉音效】**（动静结合）

*镜头1：大远景缓慢推镜 (Wide Slow Push-in) 【时长：0-8秒】*
- **纯视觉描述**：镜头一开始隐藏在浓密的蕨类植物后。一只巨大的黑褐色后肢如石柱般缓慢踏入画面中景。镜头极其缓慢地向上仰视推移，顺着庞大残破的身躯，揭示出在迷雾与丁达尔光效中若隐若现的霸王龙全貌。
- **纯音效设计 (SFX)**：没有任何音乐。只有极其沉重的“轰隆”踏步声（带有低音声学震动），以及远古森林细微的虫鸣声。

*镜头2：微距极低仰角快切 (Macro Low Angle Fast Cut) 【时长：8-11秒】*
- **纯视觉描述**：硬切特写。霸王龙布满鳞片和泥浆的巨爪猛然踩下，直接将一根粗壮的枯木踩得粉碎，泥水如爆炸般溅满镜头。
- **纯音效设计 (SFX)**：极具爆发力的干脆木头断裂声（Cracking wood），伴随泥水飞溅的吧唧声，瞬间打破宁静。

*镜头3：局部特写极速推镜 (Close-up Crash Zoom) 【时长：11-15秒】*
- **纯视觉描述**：快切并极速推向霸王龙巨大的吻部。它半张着血盆大口，粘稠的涎水拉着长丝在空气中晃动，呼出的高温白气在空气中造成了明显的视觉扭曲。
- **纯音效设计 (SFX)**：黏液拉扯的湿滑声，紧接着是一声低沉到让人内脏共振的喉音低吼（Deep guttural growl）。

# 工作流程
1. **接收旁白**：阅读我提供的完整科普文案。
2. **字数切割**：按“每40-55个汉字一段”切分为多个12-15秒的片段。
3. **前置设定**：在片段开头标明【参考旁白进度】和详细的【环境与角色设定】。
4. **动静结合分镜**：在片段内设计长短结合的镜头（如1个长镜头铺垫 + 2个快切爆发）。
5. **视听剥离**：确保画面描述完全没有旁白文字，并设计极致的【纯音效 SFX】。

请确认你已理解上述设定。如果准备好了，请回复：“准备就绪！请提供您的解说旁白全文，我将为您设计‘纯音效+动静结合+零文本画面’的巨兽分镜方案。”

# 当前程序的强制输出格式
你现在不是在普通聊天里回复，而是在给应用程序返回结构化数据。必须只输出 JSON，不要 Markdown，不要代码块，不要解释。
JSON 顶层结构必须是：
{
  "segments": [
    {
      "title": "片段一：0-15秒",
      "referenceNarration": "这一段对应的原始旁白，只作为进度标记",
      "environment": "环境与角色设定，写成可读的完整文字",
      "rows": [
        {
          "shot": "镜头1：大远景缓慢推镜 (Wide Slow Push-in)",
          "duration": "0-8秒",
          "visual": "纯视觉描述，绝对不要包含、翻译或提及旁白文字",
          "sfx": "纯音效设计，只写 SFX，不要 BGM"
        }
      ]
    }
  ]
}
每个片段 rows 建议 2-4 个镜头。referenceNarration 只能放在 referenceNarration 字段里，rows 内绝对不能出现旁白原文。`
}

function buildStoryboardUserPrompt(narration) {
  return `请根据以下解说旁白全文，按前置设定生成“纯音效+动静结合+零文本画面”的史前巨兽分镜方案，并严格返回指定 JSON 结构。

${narration}`
}

function parseStoryboardContent(content) {
  if (!content || typeof content !== 'string') {
    return null
  }

  const cleaned = content
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim()
  const jsonText = cleaned.match(/\{[\s\S]*\}/)?.[0] ?? cleaned

  try {
    const parsed = JSON.parse(jsonText)

    if (Array.isArray(parsed?.segments)) {
      return {
        segments: parsed.segments
          .map((segment, segmentIndex) => ({
            title: String(segment?.title || `片段${segmentIndex + 1}`).trim(),
            referenceNarration: String(segment?.referenceNarration || '').trim(),
            environment: String(segment?.environment || '').trim(),
            rows: Array.isArray(segment?.rows)
              ? segment.rows.map((row, rowIndex) => ({
                  shot: String(row?.shot || `镜头${rowIndex + 1}`).trim(),
                  duration: String(row?.duration || '').trim(),
                  visual: String(row?.visual || '').trim(),
                  sfx: String(row?.sfx || '').trim(),
                }))
              : [],
          }))
          .filter((segment) => segment.rows.length > 0 || segment.environment),
      }
    }
  } catch {
    return null
  }

  return null
}

function buildIdeaSystemPrompt(skills) {
  return `你是“史前巨兽短视频选题策划”，负责把史前生物改造成中文短剧感、穿越感、玄幻感很强的科普选题。

你必须自动参考以下本地写作 skills：
${skills}

输出要求：
- 只输出 JSON，不要 Markdown，不要解释。
- JSON 结构必须是：{"creature":"生物名","title":"吸引人的标题","theme":"主题说明"}
- creature 必须是一个真实史前生物名，优先恐龙，也可以是沧龙、邓氏鱼、奇虾等史前巨兽。
- title 必须像短视频爆款标题，带剧情钩子，但不要低俗。
- theme 要说明短剧套路、开场冲突、科普重点和结尾余韵，80 字以内。
- 中段必须保留严谨科普，不确定信息使用“可能”“推测”“目前化石显示”。`
}

function buildIdeaUserPrompt(seedIdea) {
  const seed = seedIdea && typeof seedIdea === 'object' ? seedIdea : {}
  const creature = typeof seed.creature === 'string' ? seed.creature.trim() : ''
  const title = typeof seed.title === 'string' ? seed.title.trim() : ''
  const theme = typeof seed.theme === 'string' ? seed.theme.trim() : ''

  return `请基于这个参考套路再发挥一点新创意，生成一个可直接放进剧本输入框的选题。

参考生物：${creature || '随机'}
参考标题：${title || '随机'}
参考主题：${theme || '随机'}

要求：
1. 可以沿用同一种生物，也可以换成更有传播点的相近史前生物。
2. 标题要更有戏剧张力，适合抖音/YouTube 巨兽科普。
3. 主题要明确“短剧钩子 + 科普重点 + 动物世界式收束”。`
}

function parseIdeaContent(content) {
  if (!content || typeof content !== 'string') {
    return null
  }

  const trimmed = content.trim()
  const cleaned = trimmed
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim()
  const jsonText = cleaned.match(/\{[\s\S]*\}/)?.[0] ?? cleaned

  try {
    const parsed = JSON.parse(jsonText)

    if (parsed?.creature && parsed?.title && parsed?.theme) {
      return {
        creature: String(parsed.creature).trim(),
        title: String(parsed.title).trim(),
        theme: String(parsed.theme).trim(),
      }
    }
  } catch {
    return null
  }

  return null
}

export function createServer() {
  const app = express()

  app.use((_request, response, next) => {
    response.setHeader('Access-Control-Allow-Origin', '*')
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    next()
  })

  app.options(/.*/, (_request, response) => {
    response.sendStatus(204)
  })

  app.use(express.json({ limit: '1mb' }))

  app.get('/api/health', (_request, response) => {
    response.json({ ok: true })
  })

  app.post('/api/random-idea', async (request, response) => {
    const { apiKey, baseUrl, model, seedIdea, skills } = request.body ?? {}

    if (!apiKey || typeof apiKey !== 'string') {
      response.status(400).json({ error: '缺少 API Key，请在设置里填写。' })
      return
    }

    const endpoint = buildChatCompletionsEndpoint(baseUrl)
    const selectedModel = typeof model === 'string' && model.trim() ? model.trim() : RANDOM_IDEA_MODEL

    try {
    const upstreamResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: selectedModel,
          temperature: 0.92,
          top_p: 0.96,
          messages: [
            {
              role: 'system',
              content: buildIdeaSystemPrompt(typeof skills === 'string' ? skills : ''),
            },
            {
              role: 'user',
              content: buildIdeaUserPrompt(seedIdea),
            },
          ],
        }),
      })

      const raw = await upstreamResponse.text()
      let data

      try {
        data = JSON.parse(raw)
      } catch {
        data = null
      }

      if (!upstreamResponse.ok) {
        response.status(upstreamResponse.status).json({
          error:
            data?.error?.message ||
            data?.message ||
            raw.slice(0, 300) ||
            `接口请求失败，状态码 ${upstreamResponse.status}。`,
        })
        return
      }

      const content = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text
      const idea = parseIdeaContent(content)

      if (!idea) {
        response.status(502).json({
          error: content
            ? `模型没有返回可用 JSON 选题：${String(content).slice(0, 180)}`
            : '模型没有返回可用选题，请再试一次。',
        })
        return
      }

      response.json({
        idea,
        model: selectedModel,
      })
    } catch (error) {
      response.status(502).json({
        error: error instanceof Error ? error.message : '无法连接到接口落点。',
      })
    }
  })

  app.post('/api/generate-script', async (request, response) => {
    const { apiKey, baseUrl, model, creatureName, notes, skills } = request.body ?? {}

    if (!apiKey || typeof apiKey !== 'string') {
      response.status(400).json({ error: '缺少 API Key，请在设置里填写。' })
      return
    }

    if (!creatureName || typeof creatureName !== 'string') {
      response.status(400).json({ error: '缺少巨兽名字。' })
      return
    }

    const endpoint = buildChatCompletionsEndpoint(baseUrl)
    const selectedModel = typeof model === 'string' && model.trim() ? model.trim() : DEFAULT_MODEL

    try {
      const upstreamResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: selectedModel,
          temperature: 0.78,
          top_p: 0.9,
          messages: [
            {
              role: 'system',
              content: buildSystemPrompt(typeof skills === 'string' ? skills : ''),
            },
            {
              role: 'user',
              content: buildUserPrompt(creatureName.trim(), notes),
            },
          ],
        }),
      })

      const raw = await upstreamResponse.text()
      let data

      try {
        data = JSON.parse(raw)
      } catch {
        data = null
      }

      if (!upstreamResponse.ok) {
        response.status(upstreamResponse.status).json({
          error:
            data?.error?.message ||
            data?.message ||
            raw.slice(0, 300) ||
            `接口请求失败，状态码 ${upstreamResponse.status}。`,
        })
        return
      }

      const script = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text

      if (!script) {
        response.status(502).json({ error: '模型返回为空，请检查模型名或接口兼容性。' })
        return
      }

      response.json({
        script,
        model: selectedModel,
      })
    } catch (error) {
      response.status(502).json({
        error: error instanceof Error ? error.message : '无法连接到接口落点。',
      })
    }
  })

  app.post('/api/generate-storyboard', async (request, response) => {
    const { apiKey, baseUrl, model, narration } = request.body ?? {}

    if (!apiKey || typeof apiKey !== 'string') {
      response.status(400).json({ error: '缺少 API Key，请在设置里填写。' })
      return
    }

    if (!narration || typeof narration !== 'string' || !narration.trim()) {
      response.status(400).json({ error: '请先粘贴解说旁白或剧本。' })
      return
    }

    const endpoint = buildChatCompletionsEndpoint(baseUrl)
    const selectedModel = typeof model === 'string' && model.trim() ? model.trim() : DEFAULT_MODEL

    try {
      const upstreamResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: selectedModel,
          temperature: 0.72,
          top_p: 0.9,
          messages: [
            {
              role: 'system',
              content: buildStoryboardSystemPrompt(),
            },
            {
              role: 'user',
              content: buildStoryboardUserPrompt(narration.trim()),
            },
          ],
        }),
      })

      const raw = await upstreamResponse.text()
      let data

      try {
        data = JSON.parse(raw)
      } catch {
        data = null
      }

      if (!upstreamResponse.ok) {
        response.status(upstreamResponse.status).json({
          error:
            data?.error?.message ||
            data?.message ||
            raw.slice(0, 300) ||
            `接口请求失败，状态码 ${upstreamResponse.status}。`,
        })
        return
      }

      const content = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text
      const storyboard = parseStoryboardContent(content)

      if (!storyboard) {
        response.status(502).json({
          error: content
            ? `模型没有返回可用分镜 JSON：${String(content).slice(0, 180)}`
            : '模型返回为空，请检查模型名或接口兼容性。',
        })
        return
      }

      response.json({
        storyboard,
        model: selectedModel,
      })
    } catch (error) {
      response.status(502).json({
        error: error instanceof Error ? error.message : '无法连接到接口落点。',
      })
    }
  })

  return app
}

export function startServer(port = DEFAULT_PORT) {
  const app = createServer()

  return new Promise((resolve, reject) => {
    const server = app
      .listen(port, '127.0.0.1', () => {
        const address = server.address()
        const resolvedPort = typeof address === 'object' && address ? address.port : port
        console.log(`Prehistoric giants writer API running on http://127.0.0.1:${resolvedPort}`)
        resolve(server)
      })
      .on('error', reject)
  })
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))

if (isDirectRun) {
  startServer().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
