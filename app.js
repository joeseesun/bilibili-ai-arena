const labels = {
  all: "全部",
  coding: "编程",
  games: "游戏",
  finance: "金融",
  reasoning: "推理",
  creative: "创作",
  culture: "文化",
  general: "综合"
};

const search = document.querySelector("#search");
const filters = document.querySelector("#filters");
const grid = document.querySelector("#videos");
const status = document.querySelector("#status");
let catalog;
let activeTag = "all";

const formatDuration = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
const formatViews = (views) => new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 1 }).format(views);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

function card(video) {
  const article = document.createElement("article");
  article.className = "card";
  article.innerHTML = `
    <a class="thumb" href="${video.url}">
      <img src="${escapeHtml(video.thumbnail)}" alt="${escapeHtml(video.title)}" loading="lazy" referrerpolicy="no-referrer" />
    </a>
    <div class="meta"><span>#${String(video.source_order).padStart(2, "0")}</span><span>${formatDuration(video.duration_seconds)} · ${formatViews(video.stats.views)} views</span></div>
    <h2><a href="${video.url}">${escapeHtml(video.title)}</a></h2>
    ${video.arena_topics.length ? `<div class="topics">${video.arena_topics.map((topic) => `<a href="${topic.url}">${escapeHtml(topic.name)}</a>`).join("")}</div>` : ""}
    <a class="up" href="${video.up.url}">UP主 ${escapeHtml(video.up.name)} ↗</a>`;
  return article;
}

function render() {
  const query = search.value.trim().toLocaleLowerCase();
  const visible = catalog.videos.filter((video) => {
    const matchesTag = activeTag === "all" || video.topic_tags_inferred.includes(activeTag);
    const topicText = video.arena_topics.map((topic) => topic.name).join(" ");
    const topicModels = video.arena_topics.flatMap((ref) => catalog.topics.find((topic) => topic.exam_id === ref.exam_id)?.ranking ?? []).map((entry) => `${entry.model} ${entry.version}`).join(" ");
    const haystack = `${video.title} ${video.up.name} ${video.bvid} ${topicText} ${topicModels}`.toLocaleLowerCase();
    return matchesTag && haystack.includes(query);
  });
  grid.replaceChildren(...(visible.length ? visible.map(card) : [Object.assign(document.createElement("p"), { className: "empty", textContent: "没有匹配的视频 / No matching videos" })]));
  status.textContent = `${visible.length} / ${catalog.video_count} videos`;
}

catalog = await fetch("data/videos.json").then((response) => {
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
});

document.querySelector("#video-count").textContent = catalog.video_count;
document.querySelector("#creator-count").textContent = catalog.creator_count;
document.querySelector("#topic-count").textContent = catalog.topic_count;
const tags = ["all", ...new Set(catalog.videos.flatMap((video) => video.topic_tags_inferred))];
for (const tag of tags) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = labels[tag] ?? tag;
  button.setAttribute("aria-pressed", String(tag === activeTag));
  button.addEventListener("click", () => {
    activeTag = tag;
    for (const item of filters.children) item.setAttribute("aria-pressed", String(item === button));
    render();
  });
  filters.append(button);
}
search.addEventListener("input", render);
render();
