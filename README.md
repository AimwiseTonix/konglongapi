# 科普巨兽剧本台

黑色高科技苹果极简风格的本地 Web 程序，用于调用 `gemini-3.1-pro-preview` 生成 4-5 分钟史前巨兽科普视频剧本。

## 功能

- 第一个页面就是对话生成页面。
- 设置面板支持填写 API Key、接口落点和模型。
- 默认接口落点：`https://yunwu.ai`
- 默认模型：`gemini-3.1-pro-preview`
- 自动融合四个本地写作 skills：
  - 抖音巨兽科普开场
  - YouTube 纪录片叙事
  - 动物世界式旁白
  - 古生物事实护栏

## 网页启动

```bash
npm install
npm run dev
```

打开 `http://localhost:5317`。

## 桌面启动

开发预览：

```bash
npm run desktop:dev
```

构建后运行桌面版：

```bash
npm run desktop
```

打包 Windows 便携版：

```bash
npm run dist:win
```

生成文件会放在 `release` 目录。

## Key 安全

API Key 只保存在当前浏览器的 `localStorage`，项目文件中没有写入密钥。后端代理只在单次生成请求里把 Key 转发给模型接口。
