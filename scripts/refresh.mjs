import { inflateSync } from "node:zlib";
import { readFile, writeFile } from "node:fs/promises";

const EVENT_URL = "https://www.bilibili.com/blackboard/era/aiarena.html?page=home#home";
const ARENA_API = "https://api.bilibili.com/x/product/growth/creation/rank/arena";
const SHEET_ID = "DYUdLaEpodUZ2Snhp";
const SHEET_TAB = "pyrw0j";
const SOURCE_URL = `https://docs.qq.com/sheet/${SHEET_ID}?tab=${SHEET_TAB}`;
const OPEN_DOC_URL = new URL("https://docs.qq.com/dop-api/opendoc");

for (const [key, value] of Object.entries({
  tab: SHEET_TAB, u: "", noEscape: "1", enableSmartsheetSplit: "1", startrow: "0", endrow: "200",
  needSheetState: "1", sliceStates: "1", block_end_col: "31", block_end_row: "255",
  block_start_col: "0", block_start_row: "0", id: SHEET_ID, normal: "1", outformat: "1",
  wb: "1", nowb: "0", callback: "clientVarsCallback", xsrf: ""
})) OPEN_DOC_URL.searchParams.set(key, value);

const arenaHeaders = {
  "user-agent": "Mozilla/5.0 (compatible; BilibiliAIArenaCatalog/2.0)",
  referer: EVENT_URL
};

const unique = (values) => [...new Set(values)];
const normalizeImage = (url) => url?.startsWith("//") ? `https:${url}` : url?.replace(/^http:/, "https:");
const examUrl = (examId) => `https://www.bilibili.com/blackboard/era/aiarena.html?page=exam&exam_id=${examId}#exam`;

function inferTags(title) {
  const rules = [
    ["coding", /代码|编程|bug|BUG|项目|全栈|开源|Coding|coding|前端|网站|数据库/i],
    ["games", /游戏|博弈|狼人杀|麻将|地牢|马里奥|狂扁|囚徒|象棋|GTA|弹珠/i],
    ["finance", /量化|交易|投资|搞钱|金融/i],
    ["reasoning", /推理|逻辑|高考|考试|知识|答题/i],
    ["creative", /创作|写作|网文|音游|画|生成|设计|建筑|视频/i],
    ["culture", /三国|诗|文化|二次元|梗/i]
  ];
  const tags = rules.filter(([, pattern]) => pattern.test(title)).map(([tag]) => tag);
  return tags.length ? tags : ["general"];
}

function parseJsonp(text) {
  const prefix = "clientVarsCallback(";
  const trimmed = text.trim();
  if (!trimmed.startsWith(prefix) || !trimmed.endsWith(")")) throw new Error("Unexpected Tencent Docs response format");
  return JSON.parse(trimmed.slice(prefix.length, -1));
}

async function fetchJson(url, headers = arenaHeaders) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.code !== 0) throw new Error(`${url}: ${payload.message || payload.code}`);
  return payload.data;
}

async function fetchSourceBvids() {
  const response = await fetch(OPEN_DOC_URL, { headers: { ...arenaHeaders, referer: SOURCE_URL } });
  if (!response.ok) throw new Error(`Tencent Docs returned HTTP ${response.status}`);
  const payload = parseJsonp(await response.text());
  const blocks = payload.clientVars?.collab_client_vars?.initialAttributedText?.text ?? [];
  const chunks = [];
  for (const block of blocks) {
    for (const data of block.block_datas ?? []) {
      if (data.related_sheet) chunks.push(inflateSync(Buffer.from(data.related_sheet, "base64")));
    }
  }
  return unique(Buffer.concat(chunks).toString("utf8").match(/BV[0-9A-Za-z]{10}/g) ?? []);
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

async function fetchArena() {
  const listData = await fetchJson(`${ARENA_API}/exam/list?sort=hot&page=1&size=100`);
  const details = await mapConcurrent(listData.list ?? [], 6, (item) => fetchJson(`${ARENA_API}/exam/detail?exam_id=${item.exam_id}`));
  const topics = details.map((detail, index) => {
    const listItem = listData.list[index];
    return {
      hot_order: index + 1,
      exam_id: detail.exam.exam_id,
      name: detail.exam.exam_name,
      url: examUrl(detail.exam.exam_id),
      brief: detail.exam.brief,
      tags: detail.exam.tags ?? [],
      up: { name: detail.exam.up.name, mid: detail.exam.up.mid, url: `https://space.bilibili.com/${detail.exam.up.mid}` },
      cover: normalizeImage(listItem.cover),
      model_count: listItem.model_count,
      champion_version: listItem.champion_version,
      episode_count: detail.exam.episode_count,
      bvids: detail.videos.map((video) => video.bv),
      ranking: detail.rank.map((entry) => ({
        rank: entry.rank_no, model: entry.model, version: entry.version, vendor: entry.vendor, scores: entry.dim_values
      }))
    };
  });
  const videoByBvid = new Map();
  for (const detail of details) {
    for (const video of detail.videos) if (!videoByBvid.has(video.bv)) videoByBvid.set(video.bv, video);
  }
  return { topics, bvids: topics.flatMap((topic) => topic.bvids), videoByBvid };
}

async function fetchVideo(bvid, sourceOrder, topicRefs, fromSheet, arenaFallback) {
  let data;
  let metadataSource = "bilibili_view_api";
  try {
    data = await fetchJson(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`);
  } catch (error) {
    if (!arenaFallback) throw error;
    metadataSource = "arena_detail_api";
    const fallbackAuthor = arenaFallback.author ?? topicRefs[0]?.up;
    data = {
      title: arenaFallback.title || `${topicRefs[0]?.name ?? bvid}（竞技场收录视频，当前元数据不可用）`,
      owner: fallbackAuthor,
      pic: arenaFallback.cover || topicRefs[0]?.cover,
      duration: arenaFallback.duration,
      pubdate: arenaFallback.pub_time,
      stat: { view: arenaFallback.view, danmaku: arenaFallback.danmaku, reply: 0, favorite: 0, coin: 0, share: 0, like: 0 }
    };
  }
  return {
    source_order: sourceOrder,
    bvid,
    url: `https://www.bilibili.com/video/${bvid}/`,
    title: data.title,
    up: { name: data.owner.name, mid: data.owner.mid, url: `https://space.bilibili.com/${data.owner.mid}` },
    thumbnail: normalizeImage(data.pic),
    duration_seconds: data.duration,
    published_at: data.pubdate ? new Date(data.pubdate * 1000).toISOString() : null,
    metadata_source: metadataSource,
    topic_tags_inferred: inferTags(`${data.title} ${topicRefs.flatMap((topic) => topic.tags).join(" ")}`),
    sources: { arena_homepage: topicRefs.length > 0, inaugural_sheet: fromSheet },
    arena_topics: topicRefs.map((topic) => ({ exam_id: topic.exam_id, name: topic.name, url: topic.url })),
    stats: {
      views: data.stat.view, danmaku: data.stat.danmaku, replies: data.stat.reply,
      favorites: data.stat.favorite, coins: data.stat.coin, shares: data.stat.share, likes: data.stat.like
    }
  };
}

const formatDuration = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
const escapeCell = (value) => String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

function renderVideos(videos, refreshedAt) {
  const lines = [
    "# B站AI无限竞技场视频 / Videos", "",
    `> ${videos.length} 个不重复视频，元数据更新于 ${refreshedAt.slice(0, 10)}。所有标题均跳转 B 站原视频。`, "",
    "| # | 来源 | UP主 | 视频 / Video | 时长 | 竞技场主题 |", "|---:|---|---|---|---:|---|"
  ];
  for (const video of videos) {
    const sources = [video.sources.arena_homepage && "竞技场", video.sources.inaugural_sheet && "首期表格"].filter(Boolean).join(" + ");
    const topics = video.arena_topics.map((topic) => `[${escapeCell(topic.name)}](${topic.url})`).join("、") || "—";
    lines.push(`| ${video.source_order} | ${sources} | [UP主 ${escapeCell(video.up.name)}](${video.up.url}) | [${escapeCell(video.title)}](${video.url}) | ${formatDuration(video.duration_seconds)} | ${topics} |`);
  }
  lines.push("", "> 主题标签由视频标题和竞技场主题自动推断，不代表 B 站官方分类。", "");
  return lines.join("\n");
}

function renderTopics(topics, videos, refreshedAt) {
  const videoByBvid = new Map(videos.map((video) => [video.bvid, video]));
  const lines = [
    "# 竞技场公开测评主题 / Arena Topics", "",
    `> ${topics.length} 个公开主题，按竞技场“热门”顺序抓取于 ${refreshedAt.slice(0, 10)}。`, ""
  ];
  for (const topic of topics) {
    lines.push(`## ${topic.hot_order}. [${topic.name}](${topic.url})`, "");
    lines.push(`- UP主：[UP主 ${topic.up.name}](${topic.up.url})`);
    lines.push(`- 标签：${topic.tags.map((tag) => `#${tag}`).join(" ") || "—"}`);
    lines.push(`- 参赛模型：${topic.model_count}；榜首：${topic.champion_version || "—"}`);
    lines.push(`- 简介：${topic.brief || "—"}`, "", "视频：", "");
    for (const bvid of topic.bvids) {
      const video = videoByBvid.get(bvid);
      lines.push(`- [${video?.title || bvid}](https://www.bilibili.com/video/${bvid}/) · ${bvid}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function renderReadmeGallery(videos) {
  const lines = ["<table>"];
  for (let index = 0; index < videos.length; index += 3) {
    lines.push("  <tr>");
    for (const video of videos.slice(index, index + 3)) {
      const title = escapeHtml(video.title);
      const upName = escapeHtml(video.up.name);
      const thumbnail = escapeHtml(video.thumbnail);
      lines.push("    <td width=\"33.333%\" valign=\"top\">");
      lines.push(`      <a href="${video.url}"><img src="${thumbnail}" width="100%" alt="${title}"></a><br>`);
      lines.push(`      <strong><a href="${video.url}">${title}</a></strong><br>`);
      lines.push(`      <sub><a href="${video.up.url}">UP主 ${upName}</a> · ${video.bvid}</sub><br>`);
      lines.push(`      <sub><a href="${video.url}">bilibili.com/video/${video.bvid}/</a></sub>`);
      lines.push("    </td>");
    }
    lines.push("  </tr>");
  }
  lines.push("</table>");
  return lines.join("\n");
}

function replaceReadmeGallery(readme, gallery) {
  const start = "<!-- VIDEO_CATALOG_START -->";
  const end = "<!-- VIDEO_CATALOG_END -->";
  if (!readme.includes(start) || !readme.includes(end)) throw new Error("README video catalog markers are missing");
  return readme.replace(new RegExp(`${start}[\\s\\S]*?${end}`), `${start}\n${gallery}\n${end}`);
}

const [{ topics, bvids: arenaBvids, videoByBvid }, sheetBvids] = await Promise.all([fetchArena(), fetchSourceBvids()]);
if (!topics.length || !arenaBvids.length) throw new Error("No topics or videos found on the Arena homepage");
const sheetSet = new Set(sheetBvids);
const allBvids = unique([...arenaBvids, ...sheetBvids]);
const videos = await mapConcurrent(allBvids, 6, (bvid, index) => fetchVideo(
  bvid, index + 1, topics.filter((topic) => topic.bvids.includes(bvid)), sheetSet.has(bvid), videoByBvid.get(bvid)
));
const refreshedAt = new Date().toISOString();
const catalog = {
  event: "B站AI无限竞技场",
  event_url: EVENT_URL,
  sources: { arena_homepage: EVENT_URL, inaugural_sheet: SOURCE_URL },
  refreshed_at: refreshedAt,
  topic_count: topics.length,
  video_count: videos.length,
  arena_video_count: new Set(arenaBvids).size,
  sheet_video_count: sheetBvids.length,
  creator_count: new Set(videos.map((video) => video.up.mid)).size,
  topics,
  videos
};

await writeFile("data/videos.json", `${JSON.stringify(catalog, null, 2)}\n`);
await writeFile("VIDEOS.md", renderVideos(videos, refreshedAt));
await writeFile("TOPICS.md", renderTopics(topics, videos, refreshedAt));
const readme = await readFile("README.md", "utf8");
await writeFile("README.md", replaceReadmeGallery(readme, renderReadmeGallery(videos)));
console.log(`Updated ${catalog.topic_count} topics and ${catalog.video_count} unique videos from ${catalog.creator_count} creators.`);
