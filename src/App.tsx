import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import {
  Check,
  ChevronRight,
  Copy,
  KeyRound,
  LockKeyhole,
  LoaderCircle,
  MessageSquareText,
  PanelRightOpen,
  PanelsTopLeft,
  RefreshCw,
  Shuffle,
  Send,
  Settings,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react'
import { generateRandomIdea, generateScript, generateStoryboard } from './api'
import type { StoryboardSegment } from './api'
import { scriptSkills } from './skills'

const DEFAULT_MODEL = 'gemini-3.1-pro-preview'
const RANDOM_IDEA_MODEL = 'gemini-3.1-flash-lite'
const DEFAULT_BASE_URL = 'https://yunwu.ai'
const STORAGE_KEY = 'prehistoric-giants-writer-settings'
const DEFAULT_SETTINGS: SettingsState = {
  apiKey: '',
  baseUrl: DEFAULT_BASE_URL,
  model: DEFAULT_MODEL,
}
const DEFAULT_LICENSE: LicenseState = {
  required: false,
  licensed: false,
  licenseKey: '',
  machineCode: '',
  expiresAt: '',
  message: '',
}
const DEFAULT_APP_STATE: AppState = {
  version: '0.1.3',
  packaged: false,
}
const DEFAULT_UPDATE_STATE: UpdateState = {
  checking: false,
  available: false,
  downloaded: false,
  version: '',
  message: '',
  checkedAt: '',
}
const DEFAULT_LICENSE_SERVER_STATE: LicenseServerState = {
  configured: false,
  reachable: false,
  message: '',
}

type SettingsState = {
  apiKey: string
  baseUrl: string
  model: string
}

type LicenseState = {
  required: boolean
  licensed: boolean
  licenseKey: string
  machineCode: string
  expiresAt: string
  message: string
}

type AppState = {
  version: string
  packaged: boolean
}

type UpdateState = {
  checking: boolean
  available: boolean
  downloaded: boolean
  version: string
  message: string
  checkedAt: string
}

type LicenseServerState = {
  configured: boolean
  reachable: boolean
  message: string
}

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type StoryboardMessage =
  | {
      role: 'user'
      content: string
    }
  | {
      role: 'assistant'
      segments: StoryboardSegment[]
      content?: string
    }

type WorkspaceTab = 'script' | 'storyboard'

type PromptIdea = {
  creature: string
  title: string
  theme: string
}

const promptIdeas: PromptIdea[] = [
  { creature: '霸王龙', title: '我穿越白垩纪，成了霸王龙巢穴旁唯一的人类', theme: '短剧穿越：第一人称误入白垩纪森林，中段科普霸王龙感官、咬合力、捕食与取食腐肉争议。' },
  { creature: '三角龙', title: '开局被三角龙救下，我才知道草食巨兽也能统治战场', theme: '史前求生：用护崽、角盾、防御阵型切入，中段科普角、颈盾、群居争议和白垩纪生态。' },
  { creature: '棘龙', title: '穿成河边小兵，迎面走来一只会捕鱼的龙王', theme: '玄幻水域：把棘龙写成河流霸主，中段科普背帆、吻部、半水生争议和鱼食性证据。' },
  { creature: '南方巨兽龙', title: '我在远古南美醒来，发现霸王龙不是唯一的噩梦', theme: '异大陆惊悚：突出南美巨型兽脚类，中段科普体型估计、猎物、与霸王龙时代地域差异。' },
  { creature: '鲨齿龙', title: '沙漠王朝的刀齿巨兽，一口咬碎我的穿越剧本', theme: '古埃及幻想：撒哈拉古河道与巨兽追踪，中段科普牙齿形态、北非环境和大型兽脚类竞争。' },
  { creature: '异特龙', title: '侏罗纪猎场开播，我成了异特龙盯上的新人主播', theme: '直播穿越：用弹幕式开场，中段科普异特龙颅骨、前肢、群猎假说和莫里逊组生态。' },
  { creature: '迅猛龙', title: '别再叫它小怪物，真正的迅猛龙比电影更危险', theme: '反套路科普：拆解影视误区，中段科普羽毛证据、体型、镰刀爪和真实发现地。' },
  { creature: '伶盗龙', title: '我捡到一枚蛋，结果被羽毛刺客跟踪三天', theme: '悬疑短剧：蛋、足迹、夜色追踪，中段科普伶盗龙与迅猛龙命名、羽毛和捕食方式。' },
  { creature: '恐爪龙', title: '学校后山裂开一道门，恐爪龙从白垩纪冲了出来', theme: '校园穿越：紧张追逐开头，中段科普镰刀爪、群体行为假说和鸟类演化启发。' },
  { creature: '犹他盗龙', title: '我以为是迅猛龙，直到它站得比我还高', theme: '巨型盗龙惊悚：体型反差开场，中段科普早白垩世、镰刀爪、羽毛可能性和猎物。' },
  { creature: '阿根廷龙', title: '我在巨人脚下醒来，每一步都是一场地震', theme: '巨物压迫：用地面震动切入，中段科普蜥脚类体型估计、长颈取食和化石残缺性。' },
  { creature: '腕龙', title: '当森林的天空开始移动，我看见了腕龙的脖子', theme: '自然史诗：高处取食与晨雾画面，中段科普前肢较长、心血管难题和侏罗纪环境。' },
  { creature: '梁龙', title: '一条尾巴扫过峡谷，我才明白什么叫侏罗纪长河', theme: '公路穿越：沿峡谷跟随巨兽，中段科普超长身体、尾巴功能和群体迁徙想象边界。' },
  { creature: '迷惑龙', title: '误入巨兽迁徙队，我被迷惑龙带进失落平原', theme: '迁徙短剧：幼龙与成年龙对照，中段科普名称历史、体型、食性和生态位。' },
  { creature: '马门溪龙', title: '巴蜀山谷里抬起一根长颈，像神话里的天桥', theme: '东方玄幻：山谷、雾气、古道，中段科普中国发现、极长颈椎和取食策略。' },
  { creature: '峨眉龙', title: '古蜀秘境的巨影，原来不是山神是峨眉龙', theme: '秘境探险：用山神误会开场，中段科普四川化石、蜥脚类身体结构和侏罗纪环境。' },
  { creature: '华阳龙', title: '我闯进侏罗纪竹影，遇见中国最古老的剑背战士', theme: '国风冒险：剑背视觉化，中段科普早期剑龙类、骨板与尾刺、防御策略。' },
  { creature: '剑龙', title: '背上插满巨刃的它，其实不是为了耍帅', theme: '冷知识反差：从骨板误解切入，中段科普骨板功能争议、尾刺和侏罗纪草食压力。' },
  { creature: '甲龙', title: '末日战甲启动，甲龙用尾锤教会我什么叫防御满级', theme: '机甲感科普：装甲与尾锤开场，中段科普骨板、尾锤力学和白垩纪生存策略。' },
  { creature: '包头龙', title: '我捡到一块活盾牌，下一秒它把猎手砸退三米', theme: '荒野护送：护甲巨兽保护路线，中段科普甲龙科、骨质装甲和尾部武器。' },
  { creature: '肿头龙', title: '史前擂台开场，头最硬的不一定最莽', theme: '擂台短剧：头槌悬念，中段科普厚头骨、是否撞击争议和白垩纪草食动物行为。' },
  { creature: '副栉龙', title: '远古森林传来号角声，我以为有人在求救', theme: '声波悬疑：神秘鸣叫开场，中段科普头冠共鸣、群体通讯和鸭嘴龙生活。' },
  { creature: '埃德蒙顿龙', title: '末日来临前，鸭嘴龙群为什么还在向北迁徙', theme: '灾变公路片：迁徙与灭绝倒计时，中段科普木乃伊化石、皮肤印痕和群居证据。' },
  { creature: '慈母龙', title: '我闯进恐龙育儿所，发现史前母爱有化石证据', theme: '温情短剧：巢穴视角，中段科普巢穴、幼龙照料假说和名称由来。' },
  { creature: '禽龙', title: '维多利亚时代挖出的怪手指，改写了人类对恐龙的想象', theme: '考古悬疑：化石误读开场，中段科普禽龙发现史、拇指刺和早期恐龙研究。' },
  { creature: '禽龙类', title: '我带着现代地图穿越，却被一群禽龙类改写路线', theme: '探险队穿越：迁徙路线冲突，中段科普鸟脚类演化、足迹和取食方式。' },
  { creature: '似鸟龙', title: '史前草原的影子闪过，速度快到我来不及尖叫', theme: '追逐短剧：速度与逃生，中段科普长腿、喙部、杂食可能和似鸟龙类生态。' },
  { creature: '似鸡龙', title: '别笑它像鸡，它可能是白垩纪最会跑路的幸存者', theme: '喜剧反差：名字轻松但节奏紧张，中段科普似鸟龙类速度、食性和群体活动。' },
  { creature: '镰刀龙', title: '我看见三把巨镰从林中伸出，却发现它可能在吃素', theme: '恐怖反转：巨爪误导为杀手，中段科普镰刀龙巨爪、草食倾向和奇特身体结构。' },
  { creature: '窃蛋龙', title: '它背了百年黑锅，真相藏在一窝恐龙蛋里', theme: '洗冤短剧：法庭式开场，中段科普窃蛋龙命名误会、抱窝姿态和育幼证据。' },
  { creature: '伤齿龙', title: '白垩纪夜班猎手上线，智商传说是真的吗', theme: '夜行悬疑：月光追踪，中段科普大眼眶、脑容量、感官和“聪明”表达边界。' },
  { creature: '美颌龙', title: '我以为它是宠物，直到它盯上我的手指', theme: '微型惊悚：小体型反差，中段科普小型兽脚类、胃内容物和早期发现史。' },
  { creature: '始祖鸟', title: '一片羽毛坠落，恐龙与鸟类的秘密开始松动', theme: '化石悬疑：羽毛化石开场，中段科普始祖鸟特征、过渡形态和演化意义。' },
  { creature: '小盗龙', title: '四翼黑影掠过树冠，我才知道恐龙也能滑翔', theme: '空中玄幻：树冠逃生，中段科普四翼羽毛、滑翔争议和早白垩世森林。' },
  { creature: '中国鸟龙', title: '辽宁化石床醒来，我看见恐龙披着羽毛走过黎明', theme: '东方化石传奇：热河生物群开场，中段科普羽毛恐龙、颜色研究和鸟类起源。' },
  { creature: '帝龙', title: '暴君的祖先竟然这么小，霸王之路从这里开始', theme: '王朝起源：小型祖先反差，中段科普早期暴龙类、羽毛可能和演化路线。' },
  { creature: '冠龙', title: '头顶王冠的猎手，不靠蛮力也能吓退对手', theme: '王冠设定：仪式感开场，中段科普头冠功能、视觉展示和中国侏罗纪发现。' },
  { creature: '永川龙', title: '重庆山城地下，藏着一头侏罗纪杀手', theme: '城市考古：地下工地发现线索，中段科普中国大型兽脚类、发现地点和猎食生态。' },
  { creature: '中华盗龙', title: '一具化石揭开残酷真相，它可能正在进食同类', theme: '犯罪现场：化石证据推理，中段科普胃内容物、捕食行为和证据解释边界。' },
  { creature: '马普龙', title: '巨兽猎团包围平原，南美风暴开始收网', theme: '团队狩猎短剧：围猎悬念，中段科普马普龙化石群、群居假说和大型猎物。' },
  { creature: '魁纣龙', title: '北方寒原的暴君，不需要热带也能称王', theme: '冰原玄幻：寒冷边疆开场，中段科普高纬度恐龙、暴龙类适应和白垩纪气候。' },
  { creature: '特暴龙', title: '亚洲版暴君登场，它和霸王龙到底谁更狠', theme: '双王对比：竞技场式标题，中段科普亚洲发现、头骨特征和亲缘关系。' },
  { creature: '惧龙', title: '名字就叫恐惧，但它真正可怕的是生存效率', theme: '末日猎手：名字反差，中段科普大型暴龙类、化石个体和生态位。' },
  { creature: '艾伯塔龙', title: '白垩纪追猎小队出现，暴龙家族不只会单挑', theme: '追猎小队：群体悬念，中段科普艾伯塔龙骨床、群居可能和北美环境。' },
  { creature: '蛇发女怪龙', title: '这头暴龙的名字像诅咒，头骨却写满科学证据', theme: '神话悬疑：名字切入，中段科普暴龙超科、北美发现和头骨特征。' },
  { creature: '食肉牛龙', title: '长着牛角的短臂猎手，奔跑起来像一场噩梦', theme: '恶魔骑士：角与速度开场，中段科普南美兽脚类、短臂和尾部肌肉。' },
  { creature: '玛君龙', title: '孤岛猎王现身，它可能留下了同类相食的证据', theme: '孤岛惊悚：马达加斯加封闭生态，中段科普同类咬痕、岛屿生态和阿贝力龙类。' },
  { creature: '阿贝力龙', title: '短脸猎手从南方大陆崛起，霸王龙看不到的战场', theme: '失落大陆：冈瓦纳叙事，中段科普阿贝力龙类特征、短吻和南半球生态。' },
  { creature: '角鼻龙', title: '鼻尖一根角，侏罗纪猎场多了一个狠角色', theme: '荒野对决：角与牙齿视觉，中段科普角鼻龙特征、莫里逊组和与异特龙共存。' },
  { creature: '双脊龙', title: '别被电影骗了，真正的双脊龙比毒液传说更离奇', theme: '影视辟谣：强钩子开场，中段科普头冠、真实体型和电影误区。' },
  { creature: '冰脊龙', title: '南极不是只有冰雪，那里也走过戴冠猎手', theme: '极地穿越：冰原裂隙开场，中段科普南极恐龙、早侏罗世气候和冠饰。' },
  { creature: '腔骨龙', title: '幽灵牧场的骨床里，藏着最早猎手的秘密', theme: '西部悬疑：骨床现场，中段科普三叠纪末、早期兽脚类和化石群解释。' },
  { creature: '板龙', title: '恐龙时代刚开场，第一批巨人已经站了起来', theme: '远古序章：三叠纪开篇，中段科普早期蜥脚形类、体型演化和取食方式。' },
  { creature: '始盗龙', title: '如果恐龙有第一章，它可能写在始盗龙身上', theme: '起源故事：时间回到三叠纪，中段科普早期恐龙特征、分类争议和演化起点。' },
  { creature: '黑瑞龙', title: '恐龙王朝的黎明，不是从巨兽开始的', theme: '王朝开端：小型祖先反差，中段科普三叠纪恐龙、早期生态和竞争压力。' },
  { creature: '腱龙', title: '它用千万年时间证明，吃素也能进化成巨兽路线', theme: '进化升级：从小到大路线，中段科普早期鸟脚类、植食策略和奔跑能力。' },
  { creature: '豪勇龙', title: '欧洲岛屿上的巨影，可能是孤岛法则开的玩笑', theme: '岛屿迷案：大小反差，中段科普欧洲白垩纪、岛屿生态和蜥脚类发现。' },
  { creature: '无畏龙', title: '名字叫无畏，因为它大到几乎没有天敌', theme: '巨兽神话：体型压迫开场，中段科普泰坦巨龙类、骨骼完整度和质量估算。' },
  { creature: '潮汐龙', title: '海风吹过远古河口，一头巨龙正在穿越潮汐', theme: '海岸史诗：河口迁徙，中段科普北美泰坦巨龙、发现史和白垩纪沿海环境。' },
  { creature: '萨尔塔龙', title: '披甲的长颈巨兽，把防御点满的素食者', theme: '重甲巨人：护甲反差，中段科普泰坦巨龙类皮内成骨、南美发现和防御。' },
  { creature: '掠食龙', title: '名字像反派，其实它的真实身份更值得追问', theme: '身份悬疑：从名字误导切入，中段科普命名、分类变化和化石证据不完整。' },
  { creature: '福井龙', title: '日本山谷深处，一头温和巨兽留下白垩纪脚印', theme: '东亚秘境：地方发现开场，中段科普日本恐龙、鸟脚类特征和生态环境。' },
  { creature: '福井盗龙', title: '东瀛山林裂开，一只猎手从白垩纪回头看我', theme: '日式奇幻：山林追踪，中段科普福井发现、兽脚类特征和亚洲恐龙多样性。' },
  { creature: '蒙古栉龙', title: '戈壁号角再次响起，鸭嘴龙群开始穿越沙海', theme: '沙海迁徙：号角与群体，中段科普头冠、亚洲鸭嘴龙和古环境变化。' },
  { creature: '原角龙', title: '它不是三角龙，却可能是白垩纪沙漠里最倔的盾牌', theme: '沙漠小巨兽：护巢与防御，中段科普戈壁化石、鹦鹉嘴和与伶盗龙化石。' },
  { creature: '鹦鹉嘴龙', title: '一只小恐龙的尾巴，保存了白垩纪最细的秘密', theme: '化石细节：皮肤与尾刺毛，中段科普中国发现、颜色复原和植食生活。' },
  { creature: '开角龙', title: '白垩纪北境开战，角龙家族亮出第一面巨盾', theme: '北境战争：角盾视觉，中段科普角龙类演化、颈盾功能和群体行为。' },
  { creature: '戟龙', title: '它的头盾像一排长矛，白垩纪没有比这更夸张的脸', theme: '外形奇观：头盾即武器感，中段科普角龙类展示结构、防御和性选择假说。' },
  { creature: '尖角龙', title: '头上长矛指向天空，它却可能把胜负交给群体', theme: '部落守卫：群体防线，中段科普角龙骨床、颈盾与鼻角。' },
  { creature: '五角龙', title: '它顶着恐龙界最大头骨之一，走进白垩纪黄昏', theme: '巨头传说：头骨尺度开场，中段科普角龙头骨、展示功能和晚白垩世生态。' },
  { creature: '牛角龙', title: '我被一堵长角城墙拦住，才知道角龙也有王者气场', theme: '城墙意象：长角视觉，中段科普牛角龙角形、颈盾和与三角龙对比。' },
  { creature: '厚鼻龙', title: '它没有长鼻角，却用一张重脸撞开生存之门', theme: '反常角龙：厚鼻突起，中段科普鼻部结构、群体化石和高纬度迁徙想象。' },
  { creature: '敏迷龙', title: '澳洲夜路上，一只小型甲龙从灌木里走出', theme: '澳洲秘境：小型装甲恐龙，中段科普南半球恐龙、甲龙类防御和发现意义。' },
  { creature: '加斯顿龙', title: '像刺猬一样的装甲车，挡在我和猎手之间', theme: '护卫短剧：装甲屏障，中段科普早白垩世甲龙、肩刺和防御策略。' },
  { creature: '多刺甲龙', title: '全身带刺的它，可能是白垩纪最不好下口的猎物', theme: '防御美学：刺甲视觉，中段科普甲龙装甲、掠食压力和生态位。' },
  { creature: '北山龙', title: '戈壁深处的巨爪谜案，它到底是怪物还是素食者', theme: '巨爪悬疑：化石谜题，中段科普镰刀龙类、中国发现和食性反差。' },
  { creature: '南雄龙', title: '岭南秘境里的巨爪身影，像从玄幻书里走出来', theme: '岭南玄幻：雾林与巨爪，中段科普中国镰刀龙类、身体结构和植食可能。' },
  { creature: '重爪龙', title: '河边钓鱼的不是人，是一只长着巨爪的猎手', theme: '河岸惊悚：捕鱼开场，中段科普鱼鳞胃内容物、长吻和棘龙科关系。' },
  { creature: '似鳄龙', title: '鳄鱼脸的恐龙趴在浅滩，等我走进水边', theme: '浅滩陷阱：鳄形吻部悬念，中段科普棘龙科、牙齿、鱼食性和非洲环境。' },
  { creature: '激龙', title: '化石商人的错误，意外揭开一只怪脸猎手', theme: '化石市场悬疑：命名故事，中段科普头骨修复、棘龙科特征和科学纠错。' },
  { creature: '昆卡猎龙', title: '西班牙工地挖出利爪，我的穿越门也跟着打开', theme: '现代工地穿越：化石触发，中段科普欧洲兽脚类、手部结构和发现地。' },
  { creature: '蛮龙', title: '欧洲侏罗纪的血色黄昏，蛮龙正在接管猎场', theme: '暗黑史诗：欧洲猎场，中段科普大型兽脚类、牙齿和侏罗纪生态。' },
  { creature: '斑龙', title: '第一批被命名的恐龙，曾让科学家以为巨蜥复活', theme: '科学史短剧：博物馆夜醒，中段科普斑龙发现史、恐龙概念诞生和早期误读。' },
  { creature: '巨齿龙', title: '它的名字像神兽，但化石告诉我们要谨慎', theme: '名字陷阱：传说与证据对比，中段科普命名混乱、化石不完整和科学修订。' },
  { creature: '嗜鸟龙', title: '夜色里最轻的脚步，可能来自一只小型猎手', theme: '夜行追踪：小型敏捷猎手，中段科普小兽脚类、牙齿和食性推测。' },
  { creature: '橡树龙', title: '白垩纪森林里的小个子，靠速度活过巨兽阴影', theme: '小人物求生：森林逃亡，中段科普小型鸟脚类、奔跑和植食生活。' },
  { creature: '棱齿龙', title: '它不是最强，却可能是最会躲的史前幸存者', theme: '弱者生存：躲避大型猎手，中段科普小型植食恐龙、牙齿和分类历史。' },
  { creature: '木他龙', title: '南美荒原的鸭嘴巨影，正在寻找最后的水源', theme: '旱季求生：水源争夺，中段科普南美鸭嘴龙、迁徙和晚白垩世生态。' },
  { creature: '赖氏龙', title: '远古北方传来低鸣，头冠像一顶战盔', theme: '北境号角：头冠声音，中段科普鸭嘴龙类头冠、加拿大化石和群体生活。' },
  { creature: '栉龙', title: '没有夸张头冠的鸭嘴龙，为什么也能称霸河岸', theme: '低调巨兽：反差科普，中段科普鸭嘴龙类取食、牙列电池和河岸生态。' },
  { creature: '盔龙', title: '戴着空心头盔的它，可能用声音统治族群', theme: '声音王国：共鸣头冠，中段科普盔龙冠饰、通讯和加拿大白垩纪。' },
  { creature: '亚冠龙', title: '半截王冠也能说话，鸭嘴龙的社交密码藏在头上', theme: '社交悬疑：头冠密码，中段科普冠饰发育、声音和视觉展示。' },
  { creature: '慈母龙幼龙', title: '我救下一只幼龙，却引来了整个恐龙育儿园', theme: '亲情短剧：幼龙视角，中段科普幼体成长、巢穴证据和父母照料假说。' },
  { creature: '冥河龙', title: '名字来自冥河，头顶尖刺像地狱王冠', theme: '暗黑玄幻：名字与头刺，中段科普厚头龙类、分类争议和头骨装饰。' },
  { creature: '龙王龙', title: '霍格沃茨没教过我，白垩纪真有龙王龙', theme: '魔法梗反转：名字吸睛，中段科普厚头龙类命名、分类可能和科学修订。' },
  { creature: '平头龙', title: '它头不厚，却可能藏着成长阶段的秘密', theme: '成长谜案：幼年与成年争议，中段科普厚头龙类发育、分类和化石解释。' },
  { creature: '单爪龙', title: '只剩一根巨爪的手，能在荒漠里做什么', theme: '荒漠谜题：奇怪手部开场，中段科普阿尔瓦雷斯龙类、挖掘昆虫假说和体型。' },
  { creature: '临河爪龙', title: '戈壁沙丘下伸出一根爪子，像在召唤我过去', theme: '沙丘悬疑：爪子线索，中段科普单爪龙类、前肢特化和亚洲发现。' },
  { creature: '阿瓦拉慈龙', title: '它不是巨兽，却把恐龙演化写成了奇怪支线', theme: '支线进化：小型特化恐龙，中段科普阿尔瓦雷斯龙类、前肢和食性推测。' },
  { creature: '斑比盗龙', title: '名字像童话，真实身份却是敏捷小猎手', theme: '童话反差：可爱名字开场，中段科普小型驰龙类、幼体化石和鸟类亲缘。' },
]

function loadSettings(): SettingsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return DEFAULT_SETTINGS
    }

    return {
      ...DEFAULT_SETTINGS,
      ...JSON.parse(raw),
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

async function saveSettings(settings: SettingsState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  await window.__PREHISTORIC_SECURE_SETTINGS__?.save(settings)
}

function normalizeSettings(settings?: PrehistoricSettings): SettingsState {
  return {
    apiKey: settings?.apiKey || DEFAULT_SETTINGS.apiKey,
    baseUrl: settings?.baseUrl || DEFAULT_SETTINGS.baseUrl,
    model: settings?.model || DEFAULT_SETTINGS.model,
  }
}

function normalizeLicense(status?: PrehistoricLicenseStatus): LicenseState {
  return {
    required: Boolean(status?.required),
    licensed: Boolean(status?.licensed || status?.ok),
    licenseKey: status?.licenseKey || '',
    machineCode: status?.machineCode || '',
    expiresAt: status?.expiresAt || '',
    message: status?.message || '',
  }
}

function normalizeAppInfo(info?: PrehistoricAppInfo): AppState {
  return {
    version: info?.version || DEFAULT_APP_STATE.version,
    packaged: Boolean(info?.packaged),
  }
}

function normalizeUpdateStatus(status?: PrehistoricUpdateStatus): UpdateState {
  return {
    checking: Boolean(status?.checking),
    available: Boolean(status?.available),
    downloaded: Boolean(status?.downloaded),
    version: status?.version || '',
    message: status?.message || '',
    checkedAt: status?.checkedAt || '',
  }
}

function normalizeLicenseServerStatus(status?: PrehistoricLicenseServerStatus): LicenseServerState {
  return {
    configured: Boolean(status?.configured),
    reachable: Boolean(status?.reachable),
    message: status?.message || '',
  }
}

export function App() {
  const [settings, setSettings] = useState<SettingsState>(() => loadSettings())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('script')
  const [creatureName, setCreatureName] = useState('霸王龙')
  const [scriptTitle, setScriptTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [storyboardInput, setStoryboardInput] = useState('')
  const [storyboardMessages, setStoryboardMessages] = useState<StoryboardMessage[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [isStoryboarding, setIsStoryboarding] = useState(false)
  const [isIdeating, setIsIdeating] = useState(false)
  const [license, setLicense] = useState<LicenseState>(DEFAULT_LICENSE)
  const [licenseKeyInput, setLicenseKeyInput] = useState('')
  const [appInfo, setAppInfo] = useState<AppState>(DEFAULT_APP_STATE)
  const [updateStatus, setUpdateStatus] = useState<UpdateState>(DEFAULT_UPDATE_STATE)
  const [licenseServer, setLicenseServer] = useState<LicenseServerState>(
    DEFAULT_LICENSE_SERVER_STATE,
  )
  const [isActivating, setIsActivating] = useState(false)
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)
  const [toast, setToast] = useState('')
  const notesRef = useRef<HTMLTextAreaElement>(null)

  const hasApiKey = settings.apiKey.trim().length > 0
  const needsLicense = license.required && !license.licensed
  const activeSkills = useMemo(() => scriptSkills.map((skill) => skill.name).join(' / '), [])

  const updateSetting = (key: keyof SettingsState, value: string) => {
    const next = { ...settings, [key]: value }
    setSettings(next)
    void saveSettings(next).catch(() => showToast('本地加密保存失败，请稍后再试'))
  }

  useEffect(() => {
    let alive = true

    const loadDesktopState = async () => {
      try {
        const secureSettings = await window.__PREHISTORIC_SECURE_SETTINGS__?.load()

        if (alive && secureSettings) {
          const hasSecureSettings = Boolean(
            secureSettings.apiKey || secureSettings.baseUrl || secureSettings.model,
          )
          const localSettings = loadSettings()

          if (hasSecureSettings) {
            const nextSettings = normalizeSettings(secureSettings)
            setSettings(nextSettings)
            localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSettings))
          } else if (localSettings.apiKey) {
            await saveSettings(localSettings)
          }
        }
      } catch {
        if (alive) {
          showToast('读取本地加密设置失败，已使用普通本地设置')
        }
      }

      try {
        const info = await window.__PREHISTORIC_APP__?.getInfo()

        if (alive && info) {
          setAppInfo(normalizeAppInfo(info))
        }
      } catch {
        if (alive) {
          showToast('读取版本信息失败')
        }
      }

      try {
        const update = await window.__PREHISTORIC_UPDATER__?.getStatus()

        if (alive && update) {
          setUpdateStatus(normalizeUpdateStatus(update))
        }
      } catch {
        if (alive) {
          showToast('读取更新状态失败')
        }
      }

      try {
        const server = await window.__PREHISTORIC_LICENSE__?.getServerStatus()

        if (alive && server) {
          setLicenseServer(normalizeLicenseServerStatus(server))
        }
      } catch {
        if (alive) {
          showToast('读取授权服务器状态失败')
        }
      }

      try {
        const status = await window.__PREHISTORIC_LICENSE__?.validate()

        if (alive && status) {
          const normalized = normalizeLicense(status)
          setLicense(normalized)
          setLicenseKeyInput(normalized.licenseKey)
        }
      } catch {
        if (alive) {
          showToast('读取授权状态失败')
        }
      }
    }

    void loadDesktopState()

    return () => {
      alive = false
    }
  }, [])

  useLayoutEffect(() => {
    const textarea = notesRef.current

    if (!textarea) {
      return
    }

    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [notes])

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2200)
  }

  const handleActivateLicense = async () => {
    if (!window.__PREHISTORIC_LICENSE__) {
      showToast('浏览器预览模式不支持机器码授权，请用桌面端测试')
      return
    }

    setIsActivating(true)

    try {
      const result = await window.__PREHISTORIC_LICENSE__.activate(licenseKeyInput)
      const normalized = normalizeLicense(result)
      setLicense(normalized)
      showToast(normalized.message || (normalized.licensed ? '授权成功' : '授权失败'))
    } catch (error) {
      showToast(error instanceof Error ? error.message : '授权请求失败')
    } finally {
      setIsActivating(false)
    }
  }

  const handleCopyMachineCode = async () => {
    try {
      await copyText(license.machineCode)
      showToast('机器码已复制')
    } catch {
      showToast('复制机器码失败')
    }
  }

  const handleCheckUpdate = async () => {
    if (!window.__PREHISTORIC_UPDATER__) {
      showToast('浏览器预览模式不支持检查更新')
      return
    }

    setIsCheckingUpdate(true)

    try {
      const result = await window.__PREHISTORIC_UPDATER__.check()
      const normalized = normalizeUpdateStatus(result)
      setUpdateStatus(normalized)
      showToast(normalized.message || '检查更新完成')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '检查更新失败')
    } finally {
      setIsCheckingUpdate(false)
    }
  }

  const copyText = async (content: string) => {
    if (!content.trim()) {
      throw new Error('没有可复制的内容')
    }

    try {
      await navigator.clipboard.writeText(content)
      return
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = content
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      textarea.style.top = '0'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()

      try {
        const copied = document.execCommand('copy')

        if (!copied) {
          throw new Error('execCommand copy failed')
        }
      } finally {
        document.body.removeChild(textarea)
      }
    }
  }

  const handleCopy = async (content: string) => {
    try {
      await copyText(content)
      showToast('已复制内容')
    } catch {
      showToast('复制失败，请手动选择文本复制')
    }
  }

  const buildSegmentCopyText = (segment: StoryboardSegment) => {
    const parts = [
      `【${segment.title}】`,
      segment.environment ? `【环境与角色设定】\n${segment.environment}` : '',
      ...segment.rows.map((row, index) =>
        [
          `【镜头${index + 1}】${row.shot}`,
          row.duration ? `时长：${row.duration}` : '',
          `纯视觉描述：${row.visual}`,
          `纯音效设计 (SFX)：${row.sfx}`,
        ]
          .filter(Boolean)
          .join('\n'),
      ),
    ]

    return parts.filter(Boolean).join('\n\n')
  }

  const handleCopySegment = async (segment: StoryboardSegment) => {
    try {
      await copyText(buildSegmentCopyText(segment))
      showToast(`已复制：${segment.title}`)
    } catch {
      showToast('复制失败，请手动选择本段提示词复制')
    }
  }

  const applyIdea = (idea: PromptIdea) => {
    setCreatureName(idea.creature)
    setScriptTitle(idea.title)
    setNotes(`主题：${idea.theme}
请按短剧开场写得强吸引，中段保持严谨科普，结尾有动物世界式余韵。`)
    showToast(`已填入：${idea.creature}`)
  }

  const runGeneration = async (name: string, generationNotes: string) => {
    if (needsLicense) {
      setSettingsOpen(true)
      showToast('请先完成机器码授权')
      return
    }

    if (!name) {
      showToast('先填一个巨兽名字')
      return
    }

    if (!hasApiKey) {
      setSettingsOpen(true)
      showToast('请先在设置里填写 API Key')
      return
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: `写一条 4-5 分钟史前巨兽科普视频剧本：${name}${
        scriptTitle.trim() ? `\n标题：《${scriptTitle.trim()}》` : ''
      }${generationNotes.trim() ? `\n补充要求：${generationNotes.trim()}` : ''
      }`,
    }

    setMessages((current) => [...current, userMessage])
    setIsGenerating(true)

    try {
      const result = await generateScript({
        apiKey: settings.apiKey,
        baseUrl: settings.baseUrl,
        model: settings.model,
        creatureName: name,
        notes: `${scriptTitle.trim() ? `标题：《${scriptTitle.trim()}》\n` : ''}${generationNotes}`,
      })

      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: result.script,
        },
      ])
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content:
            error instanceof Error
              ? `生成失败：${error.message}`
              : '生成失败：请检查 API Key、模型名和接口地址。',
        },
      ])
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    await runGeneration(creatureName.trim(), notes)
  }

  const handleNotesChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setNotes(event.target.value)
  }

  const handleStoryboardInputChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setStoryboardInput(event.target.value)
  }

  const handleStoryboardSubmit = async (event: FormEvent) => {
    event.preventDefault()

    if (needsLicense) {
      setSettingsOpen(true)
      showToast('请先完成机器码授权')
      return
    }

    const narration = storyboardInput.trim()

    if (!narration) {
      showToast('请先粘贴解说旁白或剧本')
      return
    }

    if (!hasApiKey) {
      setSettingsOpen(true)
      showToast('请先在设置里填写 API Key')
      return
    }

    const userMessage: StoryboardMessage = {
      role: 'user',
      content: narration,
    }

    setStoryboardMessages((current) => [...current, userMessage])
    setIsStoryboarding(true)

    try {
      const result = await generateStoryboard({
        apiKey: settings.apiKey,
        baseUrl: settings.baseUrl,
        model: settings.model,
        narration,
      })

      setStoryboardMessages((current) => [
        ...current,
        {
          role: 'assistant',
          segments: result.storyboard.segments,
        },
      ])
    } catch (error) {
      setStoryboardMessages((current) => [
        ...current,
        {
          role: 'assistant',
          segments: [],
          content:
            error instanceof Error ? `生成失败：${error.message}` : '生成失败：请检查 API Key、模型名和接口地址。',
        },
      ])
    } finally {
      setIsStoryboarding(false)
    }
  }

  const handleRandomGenerate = async () => {
    if (isGenerating || isIdeating) {
      return
    }

    if (needsLicense) {
      setSettingsOpen(true)
      showToast('请先完成机器码授权')
      return
    }

    if (!hasApiKey) {
      setSettingsOpen(true)
      showToast('请先在设置里填写 API Key')
      return
    }

    const seedIdea = promptIdeas[Math.floor(Math.random() * promptIdeas.length)]
    setIsIdeating(true)

    try {
      const result = await generateRandomIdea({
        apiKey: settings.apiKey,
        baseUrl: settings.baseUrl,
        model: RANDOM_IDEA_MODEL,
        seedIdea,
      })
      applyIdea(result.idea)
      showToast('已生成随机套路，满意后点生成剧本')
    } catch (error) {
      showToast(error instanceof Error ? `随机失败：${error.message}` : '随机失败，请检查 API。')
    } finally {
      setIsIdeating(false)
    }
  }

  const currentMessages = activeTab === 'script' ? messages : storyboardMessages
  const isActiveLoading = activeTab === 'script' ? isGenerating : isStoryboarding
  const activeTitle = activeTab === 'script' ? '巨兽剧本生成' : '巨兽分镜提示词'
  const activeEyebrow = activeTab === 'script' ? '对话页面' : '分镜聊天'
  const emptyText = activeTab === 'script' ? '等待生成剧本' : '粘贴解说旁白，生成分镜提示词'
  const loadingText =
    activeTab === 'script'
      ? '正在调用模型，组织镜头、旁白和科学备注...'
      : '正在切分旁白，设计纯音效分镜与镜头调度...'

  const renderMessage = (message: ChatMessage | StoryboardMessage, index: number) => {
    const isStoryboardAssistant =
      activeTab === 'storyboard' && message.role === 'assistant' && 'segments' in message

    return (
      <article className={`message ${message.role}`} key={`${message.role}-${index}`}>
        <div className="messageAvatar">
          {message.role === 'assistant' ? <Wand2 size={17} /> : <ChevronRight size={17} />}
        </div>
        <div className={isStoryboardAssistant ? 'messageBody storyboardBody' : 'messageBody'}>
          {isStoryboardAssistant ? (
            message.segments.length > 0 ? (
              <div className="storyboardSegments">
                {message.segments.map((segment, segmentIndex) => (
                  <section className="storyboardSegment" key={`${segment.title}-${segmentIndex}`}>
                    <div className="segmentHeader">
                      <div>
                        <span>{segment.title}</span>
                        <strong>参考旁白进度</strong>
                      </div>
                      <button
                        className="copyButton segmentCopy"
                        type="button"
                        onClick={() => void handleCopySegment(segment)}
                      >
                        <Copy size={15} />
                        复制本段提示词
                      </button>
                    </div>

                    <p className="referenceNarration">{segment.referenceNarration}</p>

                    <div className="storyboardTableWrap">
                      <table className="storyboardTable">
                        <thead>
                          <tr>
                            <th>镜头</th>
                            <th>时长</th>
                            <th>纯视觉描述</th>
                            <th>纯音效 SFX</th>
                          </tr>
                        </thead>
                        <tbody>
                          {segment.environment ? (
                            <tr className="environmentRow">
                              <td colSpan={4}>
                                <strong>环境与角色设定</strong>
                                <p>{segment.environment}</p>
                              </td>
                            </tr>
                          ) : null}
                          {segment.rows.map((row, rowIndex) => (
                            <tr key={`${row.shot}-${rowIndex}`}>
                              <td>{row.shot}</td>
                              <td>{row.duration}</td>
                              <td>{row.visual}</td>
                              <td>{row.sfx}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <pre>{message.content || '生成失败：模型没有返回可用分镜。'}</pre>
            )
          ) : (
            <>
              <pre>{message.content || ''}</pre>
              {message.role === 'assistant' ? (
                <button
                  className="copyButton"
                  type="button"
                  onClick={() => void handleCopy(message.content || '')}
                >
                  <Copy size={15} />
                  复制
                </button>
              ) : null}
            </>
          )}
        </div>
      </article>
    )
  }

  return (
    <main className="shell">
      <section className="workspace" aria-label="史前巨兽科普剧本工作台">
        <header className="topbar">
          <div className="brand">
            <span className="brandMark">
              <Sparkles size={18} />
            </span>
            <div>
              <strong>科普巨兽剧本台</strong>
              <span>Gemini 史前巨兽解说工作流</span>
            </div>
          </div>

          <div className="topbarActions">
            <span className={license.licensed ? 'status ready' : 'status'}>
              <LockKeyhole size={14} />
              {license.licensed ? '已授权' : '未授权'}
            </span>
            <span className={hasApiKey ? 'status ready' : 'status'}>
              <Check size={14} />
              {hasApiKey ? 'Key 已配置' : '待配置 Key'}
            </span>
            <button className="iconButton" type="button" onClick={() => setSettingsOpen(true)}>
              <Settings size={18} />
              <span>设置</span>
            </button>
          </div>
        </header>

        <nav className="tabBar" aria-label="工作流切换">
          <button
            className={activeTab === 'script' ? 'tabButton active' : 'tabButton'}
            type="button"
            onClick={() => setActiveTab('script')}
          >
            <MessageSquareText size={17} />
            剧本生成
          </button>
          <button
            className={activeTab === 'storyboard' ? 'tabButton active' : 'tabButton'}
            type="button"
            onClick={() => setActiveTab('storyboard')}
          >
            <PanelsTopLeft size={17} />
            分镜提示词
          </button>
        </nav>

        <section className="chatSurface">
          <div className="chatHeader">
            <div>
              <span>{activeEyebrow}</span>
              <strong>{activeTitle}</strong>
            </div>
            <button
              className="ghostButton"
              type="button"
              onClick={() =>
                activeTab === 'script' ? setMessages([]) : setStoryboardMessages([])
              }
            >
              <X size={16} />
              清空
            </button>
          </div>

          <div className="messages" aria-live="polite">
            {currentMessages.length === 0 ? (
              <div className="emptyState">
                {activeTab === 'script' ? <MessageSquareText size={26} /> : <PanelsTopLeft size={26} />}
                <p>{emptyText}</p>
              </div>
            ) : (
              currentMessages.map((message, index) => renderMessage(message, index))
            )}
            {isActiveLoading ? (
              <article className="message assistant loading">
                <div className="messageAvatar">
                  <LoaderCircle size={17} />
                </div>
                <div className="messageBody">
                  <pre>{loadingText}</pre>
                </div>
              </article>
            ) : null}
          </div>

          {activeTab === 'script' ? (
            <>
              <div className="randomBar">
                <button
                  className="randomButton"
                  type="button"
                  onClick={() => void handleRandomGenerate()}
                  disabled={isGenerating || isIdeating || needsLicense}
                >
                  {isIdeating ? <LoaderCircle size={18} /> : <Shuffle size={18} />}
                  随机生成套路剧本
                </button>
                <span>会请求模型在 100 个套路上再加创意，只填好标题和主题，满意后再点生成剧本。</span>
              </div>

              <form className="composer" onSubmit={handleSubmit}>
                <label>
                  <span>巨兽名字</span>
                  <input
                    value={creatureName}
                    onChange={(event) => setCreatureName(event.target.value)}
                    placeholder="例如：棘龙、沧龙、邓氏鱼"
                  />
                </label>

                <label>
                  <span>标题</span>
                  <input
                    value={scriptTitle}
                    onChange={(event) => setScriptTitle(event.target.value)}
                    placeholder="例如：我穿越白垩纪，成了唯一的人类"
                  />
                </label>

                <label className="wide">
                  <span>补充要求</span>
                  <textarea
                    ref={notesRef}
                    value={notes}
                    onChange={handleNotesChange}
                    placeholder="可选：更惊险、更适合抖音、加入分镜、偏动物世界语气..."
                  />
                </label>

                <button className="sendButton" type="submit" disabled={isGenerating || needsLicense}>
                  {isGenerating ? <LoaderCircle size={18} /> : <Send size={18} />}
                  生成剧本
                </button>
              </form>

              <section className="ideaLibrary" aria-label="恐龙剧本灵感库">
                <div className="ideaLibraryHeader">
                  <div>
                    <span>灵感库</span>
                    <strong>100 个恐龙爆款主题</strong>
                  </div>
                  <small>点击任意主题，自动填入上方对话框。</small>
                </div>

                <div className="ideaGrid">
                  {promptIdeas.map((idea, index) => (
                    <button
                      className="ideaCard"
                      type="button"
                      key={`${idea.creature}-${idea.title}`}
                      onClick={() => applyIdea(idea)}
                    >
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <strong>{idea.title}</strong>
                      <em>{idea.creature}</em>
                      <small>{idea.theme}</small>
                    </button>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <form className="storyboardComposer" onSubmit={handleStoryboardSubmit}>
              <label>
                <span>解说旁白全文</span>
                <textarea
                  value={storyboardInput}
                  onChange={handleStoryboardInputChange}
                  placeholder="把之前生成的剧本旁白，或你自己修改后的完整解说文案粘贴到这里..."
                />
              </label>
              <button className="sendButton storyboardSend" type="submit" disabled={isStoryboarding || needsLicense}>
                {isStoryboarding ? <LoaderCircle size={18} /> : <PanelsTopLeft size={18} />}
                生成分镜提示词
              </button>
            </form>
          )}
        </section>
      </section>

      <aside className={`settingsPanel ${settingsOpen ? 'open' : ''}`} aria-hidden={!settingsOpen}>
        <div className="settingsHeader">
          <div>
            <span>本地设置</span>
            <strong>模型与 Key</strong>
          </div>
          <button className="iconOnly" type="button" onClick={() => setSettingsOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <div className="settingsBody">
          <label>
            <span>
              <KeyRound size={15} />
              API Key
            </span>
            <input
              type="password"
              value={settings.apiKey}
              onChange={(event) => updateSetting('apiKey', event.target.value)}
              placeholder="sk-..."
            />
          </label>

          <label>
            <span>接口落点</span>
            <input
              value={settings.baseUrl}
              onChange={(event) => updateSetting('baseUrl', event.target.value)}
              placeholder="https://yunwu.ai"
            />
          </label>

          <label>
            <span>模型</span>
            <select
              value={settings.model}
              onChange={(event) => updateSetting('model', event.target.value)}
            >
              <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview</option>
              <option value="gemini-3-pro-preview">gemini-3-pro-preview</option>
              <option value="gemini-2.5-pro">gemini-2.5-pro</option>
            </select>
          </label>

          <div className="settingsNote">
            <PanelRightOpen size={17} />
            API Key 由用户自己购买并填写；软件授权只解锁本软件，不包含任何模型额度或 Key。桌面端会加密保存 Key，下次打开不用重填。
          </div>

          <div className="versionBox">
            <div className="licenseHeader">
              <div>
                <span>版本与更新</span>
                <strong>当前版本 v{appInfo.version}</strong>
              </div>
              <small>{appInfo.packaged ? '安装版' : '开发预览'}</small>
            </div>

            <div className="statusRows">
              <div>
                <span>更新状态</span>
                <strong>{updateStatus.message || '尚未手动检查'}</strong>
              </div>
              {updateStatus.version ? (
                <div>
                  <span>线上版本</span>
                  <strong>v{updateStatus.version}</strong>
                </div>
              ) : null}
            </div>

            <button
              className="ghostButton"
              type="button"
              onClick={() => void handleCheckUpdate()}
              disabled={isCheckingUpdate || updateStatus.checking}
            >
              {isCheckingUpdate || updateStatus.checking ? (
                <LoaderCircle size={15} />
              ) : (
                <RefreshCw size={15} />
              )}
              检查更新
            </button>
          </div>

          <div className="licenseBox">
            <div className="licenseHeader">
              <div>
                <span>软件机器码授权</span>
                <strong>{license.licensed ? '当前设备已授权' : '当前设备未授权'}</strong>
              </div>
              {license.expiresAt ? <small>到期：{license.expiresAt}</small> : null}
            </div>

            <div className="statusRows">
              <div>
                <span>授权服务器</span>
                <strong>
                  {!licenseServer.configured
                    ? '未配置'
                    : licenseServer.reachable
                      ? '连接正常'
                      : '连接失败'}
                </strong>
              </div>
              <div>
                <span>说明</span>
                <strong>{licenseServer.message || '授权只控制软件使用，不提供 API Key。'}</strong>
              </div>
            </div>

            <label>
              <span>授权码</span>
              <input
                value={licenseKeyInput}
                onChange={(event) => setLicenseKeyInput(event.target.value)}
                placeholder="客户购买软件后获得的授权码"
              />
            </label>

            <label>
              <span>本机机器码</span>
              <input value={license.machineCode || '桌面端启动后自动生成'} readOnly />
            </label>

            <div className="licenseActions">
              <button
                className="ghostButton"
                type="button"
                onClick={() => void handleCopyMachineCode()}
                disabled={!license.machineCode}
              >
                <Copy size={15} />
                复制机器码
              </button>
              <button
                className="ghostButton"
                type="button"
                onClick={() => void handleActivateLicense()}
                disabled={isActivating}
              >
                {isActivating ? <LoaderCircle size={15} /> : <LockKeyhole size={15} />}
                激活
              </button>
            </div>

            {license.message ? <p>{license.message}</p> : null}
          </div>

          <div className="skillSummary">
            <span>自动调用的 skills</span>
            <p>{activeSkills}</p>
          </div>
        </div>
      </aside>

      {settingsOpen ? (
        <button className="backdrop" type="button" onClick={() => setSettingsOpen(false)}>
          <span>关闭设置</span>
        </button>
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}
    </main>
  )
}
