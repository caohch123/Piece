# Piece / 剪辑 Agent

一个面向竖屏口播视频的自动剪辑原型：上传原始口播视频后，系统会完成语音转写、分镜规划、图形包装、字幕、音效和视频渲染，并在网页中提供预览与下载。

## 当前能力

- 上传 MP4、MOV、MKV 等视频素材
- 本地 Whisper 中文语音转写和词级时间戳
- DeepSeek 分镜规划；未配置密钥时自动使用启发式规则
- 多种信息图场景：开场、要点、步骤、对比、结构图、趋势图和结尾
- 卡拉 OK 式字幕高亮、转场和提示音效
- 输出 1080×1920 的 H.264 MP4
- SSE 实时任务进度、日志、结果预览和下载

## 运行要求

- Node.js 20+
- FFmpeg 与 FFprobe
- Whisper CLI 和本地 Whisper 模型
- HyperFrames 运行所需的兼容浏览器
- 可选：DeepSeek API 密钥

需要配置的环境变量：

```text
HYPERFRAMES_WHISPER_PATH=C:\path\to\whisper-cli.exe
HF_WHISPER_MODEL=C:\path\to\ggml-small.bin
DEEPSEEK_API_KEY=optional
PORT=5173
```

未设置 `HF_WHISPER_MODEL` 时，程序会在用户目录下的 `.cache/hyperframes/whisper/models` 中查找模型。

## 本地启动

```bash
npm install
npm start
```

打开 <http://localhost:5173>。

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

当前版本属于可演示的 MVP / 技术闭环原型，适合本地验证和小范围试用。公开部署前仍需补齐任务持久化、身份与文件隔离、上传校验、错误恢复和成片质量门禁。详细评审见 [PRODUCT_REPORT.md](./PRODUCT_REPORT.md)。
