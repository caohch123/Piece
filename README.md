# Piece / 剪辑 Agent

一个面向竖屏口播视频的自动剪辑原型：上传原始口播视频后，系统会完成语音转写和分镜规划。确认标题与字幕后，再生成图形包装、字幕、音效和视频，并在网页中提供预览与下载。

## 当前能力

- 上传 MP4、MOV、MKV 视频素材，最长 180 秒、不超过 800 MB，需包含音轨
- 本地 Whisper 中文语音转写和词级时间戳
- 可在页面配置 DeepSeek、OpenAI、通义千问或自定义 OpenAI 兼容服务，并填写模型 ID、API Base URL 和密钥；未配置时自动使用启发式规则
- 多种信息图场景：开场、要点、步骤、对比、结构图、趋势图和结尾
- 卡拉 OK 式字幕高亮、转场和提示音效
- 输出 1080×1920 的 H.264 MP4
- SSE 实时任务进度、日志、结果预览和下载
- 待确认文案编辑、最近任务列表、服务重启后恢复待确认与已完成任务

提示词入口目前生成**无旁白的字幕动画**，尚无 TTS 配音。

## 运行要求

- Node.js 22+
- FFmpeg 与 FFprobe
- Whisper CLI 和本地 Whisper 模型
- HyperFrames 运行所需的兼容浏览器
- 可选：所选大模型服务的 API 密钥；本地兼容服务可不使用密钥

需要配置的环境变量：

```text
HYPERFRAMES_WHISPER_PATH=C:\path\to\whisper-cli.exe
HF_WHISPER_MODEL=C:\path\to\ggml-small.bin
DEEPSEEK_API_KEY=optional  # 旧版配置兼容；也可直接在网页设置
PORT=5173
HOST=127.0.0.1
```

未设置 `HF_WHISPER_MODEL` 时，程序会在用户目录下的 `.cache/hyperframes/whisper/models` 中查找模型。

## 本地启动

```bash
npm install
npm run doctor
npm start
```

打开 <http://localhost:5173>。

在页面展开「模型 API 设置」，选择服务，确认 Base URL，填写模型 ID 和 API Key，然后保存。可点击「测试已保存的连接」验证；这会发起一次可能计费的模型请求。DeepSeek、OpenAI 和通义千问提供可编辑预设；其他提供 OpenAI 兼容 Chat Completions 接口的服务（含本地模型）可选「自定义」。区域或工作空间专用地址请以服务商控制台为准。切换服务地址时需重新填写该服务的密钥；只修改同一服务的模型 ID 时可留空保留密钥。

配置按浏览器会话保存在本机 `workspace/.llm-settings.json`，API Key 使用会话密钥加密，页面与任务记录均不回显密钥；请勿公开 `workspace/`。新任务会固定使用创建时所选的模型，修改设置不会改变已排队任务。模型仅用于提示词写稿和分镜规划；语音转写仍由本地 Whisper 完成。模型 API 不可用或返回不合格文案时，会记录原因并使用本地规则继续生成。`DEEPSEEK_API_KEY` 仍作为未保存网页配置时的兼容默认值。

运行 `npm test` 可执行接口与模板安全回归。服务默认仅监听本机；任务、上传素材和会话密钥保存在 `workspace/`。未关联任务的临时上传会在 24 小时后清理；成片目前不会自动删除。同一浏览器可查看自己的任务，服务重启后待确认与已完成任务可恢复，处理中任务会标记为中断。当前会话隔离只适用于本地试用，公开部署仍需正式账号与权限系统。

## 目录结构

```text
assets/          GSAP 与音效资源
lib/             转写、分镜、工程生成、任务和渲染逻辑
public/          Web 页面
tools/           冒烟测试脚本
server.mjs       HTTP 服务与 API
PRODUCT_REPORT.md 产品评审报告
```

运行时上传文件、中间工程和最终视频会写入 `workspace/`。该目录包含用户素材，已从 Git 中排除。

## 产品状态

当前版本属于可演示的 MVP / 技术闭环原型，适合本地验证和小范围试用。升级进度见 [TODO.md](./TODO.md)，初版评审见 [PRODUCT_REPORT.md](./PRODUCT_REPORT.md)。
