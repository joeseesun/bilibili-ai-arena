# B站 AI 无限竞技场 · Video Index

**中文** | [English](#english)

> 中国创作者给全球 AI 模型设计的一场非标准化考试。这里收录首期测评视频，只做索引与导流，点击即回到 B 站观看。
>
> A community-built, real-world test for leading AI models—curated as a searchable video index, with every view directed back to Bilibili and the original creator.

[进入 B站AI无限竞技场](https://www.bilibili.com/blackboard/era/aiarena.html?page=home#home) · [浏览 75 个视频](VIDEOS.md) · [查看源数据](data/videos.json) · [MIT License](LICENSE)

**2026-09-18 实测：** 从首期腾讯文档读取到 75 个有效 B 站视频，覆盖 22 位 UP 主；每个 BV 号均已通过 B 站公开接口读回。首期结果表顶部列出 `GPT-6 Astra`。

## 这是什么

B站AI无限竞技场不使用一套统一题库。代码、游戏、创作、文化、金融和生活决策等不同领域的 UP 主，按自己的专业场景设计任务，让模型在真实、开放、甚至有点刁钻的问题里直接交手。

这个仓库把首期公开清单整理成三个可复用入口：

| 入口 | 用途 |
|---|---|
| [网页索引](index.html) | 搜索标题、模型和 UP 主，按主题快速筛选 |
| [VIDEOS.md](VIDEOS.md) | 在 GitHub 内直接浏览完整视频清单 |
| [data/videos.json](data/videos.json) | 供研究、可视化和二次开发读取的结构化数据 |

## 为什么不是另一个 Benchmark

- **UP 主自主出题：** 题目来自真实项目与兴趣，而不是统一标准题库。
- **场景跨度更大：** 从祖传代码、量化交易，到游戏复刻、AI 狼人杀和内容创作。
- **记录能力变化：** 同一类任务可以随着新模型出现持续重测。
- **看完能做选择：** 目标不是只给一个分数，而是帮助用户理解模型在实际任务里的能力边界。

## 快速浏览

无需安装。直接打开 [完整清单](VIDEOS.md)，或在本地启动可搜索网页：

```bash
python3 -m http.server 8000
open http://localhost:8000
```

## 更新数据

刷新脚本只使用 Node.js 标准库，从 Brief 指定的腾讯表格提取 BV 号，再从 B 站公开接口读取视频元数据：

```bash
npm run refresh
npm test
```

生成字段包括原始顺序、BV 号、标题、UP 主、封面、时长、发布时间和抓取时的互动数据。`topic_tags_inferred` 根据标题自动推断，仅用于筛选，不代表 B 站官方分类。

## 数据来源与口径

- 活动名称：**B站AI无限竞技场**
- 活动开启时间：**2026-09-15**
- [竞技场主页](https://www.bilibili.com/blackboard/era/aiarena.html?page=home#home)
- [首期测评主题腾讯文档](https://docs.qq.com/sheet/DYUdLaEpodUZ2Snhp?tab=pyrw0j)
- 元数据快照：见 [data/videos.json](data/videos.json) 中的 `refreshed_at`

播放量、点赞等互动数字会持续变化，因此仓库只把它们视为抓取时快照，不据此重算官方排名。若要看最新结果，请以竞技场页面和原始表格为准。

## 引用、版权与边界

- 每条视频均明确标注“**UP主 xxx**”，并链接原视频与 UP 主主页。
- 本仓库不下载、不托管、不重新分发任何视频文件。
- 视频、封面、标题及 UP 主素材的版权归原作者及相关权利人所有；Bilibili/B站相关商标归其权利人所有。
- MIT License 只覆盖本仓库的代码与原创文档，不改变第三方内容的版权状态。
- 如果你是相关权利人并希望修正或移除索引，请通过 GitHub Issue 联系维护者。

## 海外传播提示

核心表述是：**Chinese creators designed a non-standardized, real-world exam for the world's leading AI models.**

按活动 Brief，X 平台传播需带：`#AI无限竞技场` `#B站` `#AI`。可按内容补充 `#ArtificialIntelligence` `#GenerativeAI` `#GenAI` `#LLM` `#LLMs`。中文引导语：**小破站 / 阿B / 小电视 / 隔壁站 / 字母站搜「AI竞技场」**。

## 贡献

欢迎补充缺失视频、修正元数据或改进展示。提交前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。维护者：[向阳乔木](https://github.com/joeseesun) · [X @vista8](https://x.com/vista8) · [qiaomu.ai](https://qiaomu.ai/)

---

<a name="english"></a>

# English

## A real-world AI exam designed by Chinese creators

The **Bilibili AI Infinite Arena** brings together creator-designed tests for leading AI models. Instead of another fixed benchmark, it asks models to solve open-ended tasks drawn from coding, games, finance, creative work, culture, and everyday decisions.

This repository is a searchable index of the inaugural collection:

- **75 verified Bilibili videos** from **22 creators**.
- Every item credits the creator as `UP主 <name>` and links to the original video.
- Structured metadata is available in [`data/videos.json`](data/videos.json).
- The inaugural results sheet lists **GPT-6 Astra** at the top.

### Browse

- [Open the official Arena](https://www.bilibili.com/blackboard/era/aiarena.html?page=home#home)
- [Browse the complete video list](VIDEOS.md)
- [Read the original source sheet](https://docs.qq.com/sheet/DYUdLaEpodUZ2Snhp?tab=pyrw0j)

Run the searchable page locally:

```bash
python3 -m http.server 8000
open http://localhost:8000
```

Refresh and validate the catalog with Node.js 20 or newer:

```bash
npm run refresh
npm test
```

### Rights and limitations

This project indexes and links to videos; it does not host or redistribute video files. Video, thumbnail, title, creator material, and trademark rights remain with their respective owners. The MIT License covers only this repository's original code and documentation. Engagement metrics are snapshots and will drift over time; use the official Arena and source sheet for the latest results.

Maintained by [向阳乔木](https://github.com/joeseesun) · [X @vista8](https://x.com/vista8) · [qiaomu.ai](https://qiaomu.ai/)
