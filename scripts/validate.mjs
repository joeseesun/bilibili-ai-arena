import { readFile } from "node:fs/promises";

const catalog = JSON.parse(await readFile("data/videos.json", "utf8"));
const readme = await readFile("README.md", "utf8");
const videosMarkdown = await readFile("VIDEOS.md", "utf8");
const topicsMarkdown = await readFile("TOPICS.md", "utf8");
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

const errors = [];
if (!Array.isArray(catalog.videos) || catalog.videos.length !== catalog.video_count) {
  errors.push("video_count does not match videos length");
}
if (new Set(catalog.videos.map((video) => video.bvid)).size !== catalog.videos.length) {
  errors.push("duplicate BVIDs found");
}
if (catalog.creator_count !== new Set(catalog.videos.map((video) => video.up.mid)).size) {
  errors.push("creator_count is inaccurate");
}
if (!Array.isArray(catalog.topics) || catalog.topics.length !== catalog.topic_count) errors.push("topic_count does not match topics length");
if (new Set(catalog.topics.map((topic) => topic.exam_id)).size !== catalog.topics.length) errors.push("duplicate topic IDs found");
if (catalog.arena_video_count !== new Set(catalog.topics.flatMap((topic) => topic.bvids)).size) errors.push("arena_video_count is inaccurate");

for (const [index, video] of catalog.videos.entries()) {
  if (video.source_order !== index + 1) errors.push(`${video.bvid}: source_order is not sequential`);
  if (!/^BV[0-9A-Za-z]{10}$/.test(video.bvid)) errors.push(`${video.bvid}: invalid BVID`);
  if (!video.title || !video.up?.name || !video.url) errors.push(`${video.bvid}: missing required metadata`);
  if (video.url !== `https://www.bilibili.com/video/${video.bvid}/`) errors.push(`${video.bvid}: invalid direct Bilibili URL`);
  if (!videosMarkdown.includes(`UP主 ${video.up.name}`)) errors.push(`${video.bvid}: missing required UP主 credit`);
  if (!readme.includes(`<img src="${video.thumbnail}"`)) errors.push(`${video.bvid}: README missing cover`);
  if (!readme.includes(`>${escapeHtml(video.title)}</a></strong>`)) errors.push(`${video.bvid}: README missing linked title`);
  if (!readme.includes(`UP主 ${escapeHtml(video.up.name)}</a>`)) errors.push(`${video.bvid}: README missing linked creator`);
  if (!readme.includes(`bilibili.com/video/${video.bvid}/</a>`)) errors.push(`${video.bvid}: README missing displayed video address`);
}

const screenshotTopics = ["AI博弈论·囚徒困境", "AI世界杯", "神烦老狗的Benchmark", "AI模型建模演示横测", "没人比TA更懂新三国", "AI复刻游戏狂扁小朋友"];
for (const name of screenshotTopics) {
  const topic = catalog.topics.find((item) => item.name === name);
  if (!topic) errors.push(`missing screenshot topic: ${name}`);
  else if (!topic.bvids.length) errors.push(`screenshot topic has no videos: ${name}`);
  if (!topicsMarkdown.includes(name)) errors.push(`TOPICS.md missing screenshot topic: ${name}`);
}

for (const topic of catalog.topics) {
  if (!topic.url || !topic.up?.name || !topic.bvids?.length) errors.push(`topic ${topic.exam_id}: missing required data`);
  if (!topicsMarkdown.includes(`UP主 ${topic.up.name}`)) errors.push(`topic ${topic.exam_id}: missing UP主 credit`);
  for (const bvid of topic.bvids) {
    if (!catalog.videos.some((video) => video.bvid === bvid)) errors.push(`topic ${topic.exam_id}: video ${bvid} missing from catalog`);
  }
}

for (const required of ["B站AI无限竞技场", "AI竞技场", "版权", "VIDEOS.md"]) {
  if (!readme.includes(required)) errors.push(`README missing: ${required}`);
}
for (const required of [`${catalog.topic_count} 个主题`, `${catalog.video_count} 个视频`, `${catalog.creator_count} 位 UP 主`]) {
  if (!readme.includes(required)) errors.push(`README count missing: ${required}`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`Validated ${catalog.topic_count} topics, ${catalog.video_count} unique videos, and ${catalog.creator_count} creators.`);
