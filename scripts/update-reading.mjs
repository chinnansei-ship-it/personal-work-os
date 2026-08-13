import fs from "node:fs/promises";

const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error("GITHUB_TOKEN is not available");

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit",
  day: "2-digit", weekday: "short", hour: "2-digit", hour12: false
});
const parts = Object.fromEntries(formatter.formatToParts(new Date()).map(x => [x.type, x.value]));
const mode = Number(parts.hour) < 12 ? "pharmacy" : "english";
const date = `${parts.year}-${parts.month}-${parts.day}`;

function decodeXml(value = "") {
  return value.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

async function fetchPharmacySources() {
  const queries = ["中国 零售药房 医保 政策", "连锁药店 集采 处方外流", "药品 零售 渠道 数字医疗"];
  const items = [];
  for (const query of queries) {
    try {
      const url = `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss`;
      const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 Personal Work OS" } });
      if (!response.ok) continue;
      const xml = await response.text();
      for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
        const item = match[1];
        const get = tag => decodeXml(item.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))?.[1]);
        const source = { title: get("title"), link: get("link"), summary: get("description"), published: get("pubDate") };
        if (source.title && source.link && !items.some(x => x.link === source.link)) items.push(source);
        if (items.length >= 15) return items;
      }
    } catch (error) {
      console.warn(`Source fetch failed for ${query}: ${error.message}`);
    }
  }
  return items;
}

const pharmacySources = mode === "pharmacy" ? await fetchPharmacySources() : [];
const sourceContext = pharmacySources.length
  ? pharmacySources.map((x, i) => `${i + 1}. ${x.title}\nPublished: ${x.published}\nSummary: ${x.summary}\nURL: ${x.link}`).join("\n\n")
  : "No current external source items were retrieved. Do not invent current events; provide a monitoring framework and clearly state this limitation.";

const prompts = {
  english: `Create today's substantial advanced C1 English-for-work lesson for a Commercial Excellence and Sales Operations professional in China. It must be comparable to a full ChatGPT lesson, not a short summary. Focus on emails, meetings, presentations or cross-functional conversations. Return valid JSON only with keys title and body. body must be safe semantic HTML using only h3, p, b, ul, li, table, tr, th and td tags. Include exactly these 8 clearly developed sections: Today's Focus with a Chinese explanation, Executive-ready model, Useful meeting phrases, Cross-functional follow-up, Word bank with at least 6 entries and examples, at least 2 Chinglish corrections, Presentation phrase with usage guidance, and a 2-minute exercise with a suggested answer. Target 900-1400 English words plus concise Chinese explanations. Do not use markdown fences. Date: ${date}.`,
  pharmacy: `Create a full weekly China retail pharmacy trend and Sales Operations impact report for a Commercial Excellence professional. This must be a substantial report, not a short summary. Use only the source items supplied below for time-sensitive factual claims; never invent events, dates, statistics or sources. Separate confirmed source signals from your analysis. Return valid JSON only with keys title and body. body must be semantic HTML using only h3, p, b, ul, li, table, tr, th, td and a tags. Include 8 developed sections: 1) Executive summary with 3-5 key judgments, 2) Policy and market access, 3) pharmacy chains and channel execution, 4) procurement, pricing and volume-based purchasing, 5) digital health and patient access, 6) implications for IMS, Offtake, Inventory and Sales/Billing, 7) next-week action checklist with owner suggestions, and 8) source list containing clickable links. For each signal state What happened / Why it matters / What to monitor. Target 1800-2800 Chinese characters. If sources are insufficient, say so clearly and use a monitoring framework rather than fabricated news. Do not use markdown fences. Observation date: ${date}.\n\nSOURCE ITEMS:\n${sourceContext}`
};

const response = await fetch("https://models.github.ai/inference/chat/completions", {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "openai/gpt-4.1",
    messages: [
      { role: "system", content: "You create accurate, practical learning content for a bilingual Commercial Excellence professional. Return JSON only." },
      { role: "user", content: prompts[mode] }
    ],
    temperature: 0.5,
    max_tokens: 4200
  })
});
const path = new URL("../reading-data.json", import.meta.url);
const data = JSON.parse(await fs.readFile(path, "utf8"));
if (response.ok) {
  const payload = await response.json();
  const outputText = payload.choices?.[0]?.message?.content;
  if (!outputText) throw new Error("No output text returned");
  const generated = JSON.parse(outputText.replace(/^```json\s*|\s*```$/g, ""));
  data[mode] = {
    title: generated.title,
    meta: `${date} · ${mode === "english" ? "工作日 21:05" : "每周一 08:05"} 自动更新`,
    body: generated.body
  };
} else {
  const reason = await response.text();
  console.warn(`GitHub Models ${response.status}: ${reason}`);
  data[mode].meta = `${date} · 免费模型暂时不可用，已保留上一期内容`;
}
await fs.writeFile(path, JSON.stringify(data, null, 2) + "\n");
