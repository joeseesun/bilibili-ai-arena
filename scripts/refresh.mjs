import { inflateSync } from "node:zlib";
import { writeFile } from "node:fs/promises";

const SHEET_ID = "DYUdLaEpodUZ2Snhp";
const SHEET_TAB = "pyrw0j";
const SOURCE_URL = `https://docs.qq.com/sheet/${SHEET_ID}?tab=${SHEET_TAB}`;
const OPEN_DOC_URL = new URL("https://docs.qq.com/dop-api/opendoc");

for (const [key, value] of Object.entries({
  tab: SHEET_TAB,
  u: "",
  noEscape: "1",
  enableSmartsheetSplit: "1",
  startrow: "0",
  endrow: "200",
  needSheetState: "1",
  sliceStates: "1",
  block_end_col: "31",
  block_end_row: "255",
  block_start_col: "0",
  block_start_row: "0",
  id: SHEET_ID,
  normal: "1",
  outformat: "1",
  wb: "1",
  nowb: "0",
  callback: "clientVarsCallback",
  xsrf: ""
})) {
  OPEN_DOC_URL.searchParams.set(key, value);
}

const headers = {
  "user-agent": "Mozilla/5.0 (compatible; BilibiliAIArenaCatalog/1.0)",
  referer: SOURCE_URL
};

function unique(values) {
  return [...new Set(values)];
}

function inferTags(title) {
  const rules = [
    ["coding", /代码|编程|bug|BUG|项目|全栈|开源|Coding|coding|前端|网站/i],
    ["games", /游戏|博弈|狼人杀|麻将|地牢|马里奥|狂扁|囚徒|象棋/i],
    ["finance", /量化|交易|投资|搞钱|金融/i],
    ["reasoning", /推理|逻辑|高考|考试|知识|答题/i],
    ["creative", /创作|写作|网文|音游|画|生成|设计/i],
    ["culture", /三国|诗|文化|二次元|梗/i]
  ];
  const tags = rules.filter(([, pattern]) => pattern.test(title)).map(([tag]) => tag);
  return tags.length ? tags : ["general"];
}

function parseJsonp(text) {
  const prefix = "clientVarsCallback(";
  const trimmed = text.trim();
  if (!trimmed.startsWith(prefix) || !trimmed.endsWith(")")) {
    throw new Error("Unexpected Tencent Docs response format");
  }
  return JSON.parse(trimmed.slice(prefix.length, -1));
}

async function fetchSourceBvids() {
  const response = await fetch(OPEN_DOC_URL, { headers });
  if (!response.ok) throw new Error(`Tencent Docs returned HTTP ${response.status}`);
  const payload = parseJsonp(await response.text());
  const textBlocks = payload.clientVars?.collab_client_vars?.initialAttributedText?.text ?? [];
  const binaryChunks = [];

  for (const block of textBlocks) {
    for (const data of block.block_datas ?? []) {
      if (data.related_sheet) {
        binaryChunks.push(inflateSync(Buffer.from(data.related_sheet, "base64")));
      }
    }
  }

  const sourceText = Buffer.concat(binaryChunks).toString("utf8");
  return unique(sourceText.match(/BV[0-9A-Za-z]{10}/g) ?? []);
}

async function fetchVideo(bvid, sourceOrder) {
  const endpoint = new URL("https://api.bilibili.com/x/web-interface/view");
  endpoint.searchParams.set("bvid", bvid);
  const response = await fetch(endpoint, { headers });
  if (!response.ok) throw new Error(`${bvid}: HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.code !== 0) throw new Error(`${bvid}: ${payload.message || payload.code}`);
  const video = payload.data;

  return {
    source_order: sourceOrder,
    bvid,
    url: `https://www.bilibili.com/video/${bvid}/`,
    title: video.title,
    up: {
      name: video.owner.name,
      mid: video.owner.mid,
      url: `https://space.bilibili.com/${video.owner.mid}`
    },
    thumbnail: video.pic.replace(/^http:/, "https:"),
    duration_seconds: video.duration,
    published_at: new Date(video.pubdate * 1000).toISOString(),
    topic_tags_inferred: inferTags(video.title),
    stats: {
      views: video.stat.view,
      danmaku: video.stat.danmaku,
      replies: video.stat.reply,
      favorites: video.stat.favorite,
      coins: video.stat.coin,
      shares: video.stat.share,
      likes: video.stat.like
    }
  };
}

async function mapConcurrent(items, concurrency, mapper) {
  const output = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return output;
}

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function renderMarkdown(videos, refreshedAt) {
  const lines = [
    "# 首期测评视频 / Inaugural Test Videos",
    "",
    `> ${videos.length} 个视频，元数据更新于 ${refreshedAt.slice(0, 10)}。所有内容均跳转 B 站观看。`,
    "",
    "| # | UP主 | 视频 / Video | 时长 | 标签 |",
    "|---:|---|---|---:|---|"
  ];
  for (const video of videos) {
    lines.push(`| ${video.source_order} | [UP主 ${video.up.name}](${video.up.url}) | [${video.title}](${video.url}) | ${formatDuration(video.duration_seconds)} | ${video.topic_tags_inferred.join(", ")} |`);
  }
  lines.push("", "> 主题标签由视频标题自动推断，不代表 B 站官方分类。", "");
  return lines.join("\n");
}

const bvids = await fetchSourceBvids();
if (!bvids.length) throw new Error("No Bilibili video IDs found in the source sheet");
const videos = await mapConcurrent(bvids, 6, (bvid, index) => fetchVideo(bvid, index + 1));
const refreshedAt = new Date().toISOString();
const catalog = {
  event: "B站AI无限竞技场",
  event_url: "https://www.bilibili.com/blackboard/era/aiarena.html?page=home#home",
  source_sheet: SOURCE_URL,
  refreshed_at: refreshedAt,
  video_count: videos.length,
  creator_count: new Set(videos.map((video) => video.up.mid)).size,
  videos
};

await writeFile("data/videos.json", `${JSON.stringify(catalog, null, 2)}\n`);
await writeFile("VIDEOS.md", renderMarkdown(videos, refreshedAt));
console.log(`Updated ${videos.length} videos from ${catalog.creator_count} creators.`);
