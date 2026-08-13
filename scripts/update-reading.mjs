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

const prompts = {
  english: `Create today's advanced C1 English-for-work lesson for a Commercial Excellence and Sales Operations professional in China. Focus on emails, meetings, presentations or cross-functional conversations. Return valid JSON only with keys title and body. body must be safe semantic HTML using only h3, p, b, ul, li and table tags. Include executive phrasing, a word bank, Chinglish corrections, one presentation phrase, and a 2-minute exercise. Do not use markdown fences. Date: ${date}.`,
  pharmacy: `Create a concise China retail pharmacy and Commercial Excellence learning brief for a Sales Operations professional. Focus on policy monitoring, procurement, pharmacy chains, channel execution, digital health and practical implications for KPI allocation, IMS/Offtake, inventory, pricing and reporting. Do not claim that an event happened today and do not invent news or sources. Clearly label the content as a monitoring and analysis framework. Return valid JSON only with keys title and body. body must be safe semantic HTML using only h3, p, b, ul, li and table tags. Do not use markdown fences. Observation date: ${date}.`
};

const response = await fetch("https://models.github.ai/inference/chat/completions", {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "openai/gpt-4.1-mini",
    messages: [
      { role: "system", content: "You create accurate, practical learning content for a bilingual Commercial Excellence professional. Return JSON only." },
      { role: "user", content: prompts[mode] }
    ],
    temperature: 0.5,
    max_tokens: 2200
  })
});
if (!response.ok) throw new Error(`GitHub Models ${response.status}: ${await response.text()}`);
const payload = await response.json();
const outputText = payload.choices?.[0]?.message?.content;
if (!outputText) throw new Error("No output text returned");
const generated = JSON.parse(outputText.replace(/^```json\s*|\s*```$/g, ""));

const path = new URL("../reading-data.json", import.meta.url);
const data = JSON.parse(await fs.readFile(path, "utf8"));
data[mode] = {
  title: generated.title,
  meta: `${date} · ${mode === "english" ? "工作日 21:05" : "每周一 08:05"} 自动更新`,
  body: generated.body
};
await fs.writeFile(path, JSON.stringify(data, null, 2) + "\n");
