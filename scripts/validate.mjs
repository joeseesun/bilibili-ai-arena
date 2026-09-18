import { readFile } from "node:fs/promises";

const catalog = JSON.parse(await readFile("data/videos.json", "utf8"));
const readme = await readFile("README.md", "utf8");
const videosMarkdown = await readFile("VIDEOS.md", "utf8");

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

for (const [index, video] of catalog.videos.entries()) {
  if (video.source_order !== index + 1) errors.push(`${video.bvid}: source_order is not sequential`);
  if (!/^BV[0-9A-Za-z]{10}$/.test(video.bvid)) errors.push(`${video.bvid}: invalid BVID`);
  if (!video.title || !video.up?.name || !video.url) errors.push(`${video.bvid}: missing required metadata`);
  if (!videosMarkdown.includes(`UP主 ${video.up.name}`)) errors.push(`${video.bvid}: missing required UP主 credit`);
}

for (const required of ["B站AI无限竞技场", "AI竞技场", "版权", "VIDEOS.md"]) {
  if (!readme.includes(required)) errors.push(`README missing: ${required}`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`Validated ${catalog.video_count} unique videos and ${catalog.creator_count} creators.`);
