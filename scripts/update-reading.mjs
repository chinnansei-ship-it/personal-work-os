import fs from "node:fs/promises";

const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error("GITHUB_TOKEN is not available");

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit",
  day: "2-digit", weekday: "short", hour: "2-digit", hour12: false
});
const parts = Object.fromEntries(formatter.formatToParts(new Date()).map(x => [x.type, x.value]));
const mode = process.env.UPDATE_MODE === "pharmacy" ? "pharmacy" : "english";
const date = `${parts.year}-${parts.month}-${parts.day}`;

function fallbackEnglish() {
  const lessons = [
    ["Challenging an assumption without creating friction","pressure-test a recommendation","The recommendation is directionally sound, but two assumptions need to be pressure-tested before we lock the plan."],
    ["Turning analysis into an executive recommendation","move from findings to action","The analysis points to a concentrated execution gap, so I recommend a targeted intervention rather than a broad reset."],
    ["Managing a cross-functional dependency","protect the critical path","The remaining dependency sits with Sales; agreeing a firm cut-off today will protect the review timeline."],
    ["Explaining a forecast change with confidence","reframe the outlook","We are revising the outlook to reflect current run-rate evidence while preserving upside as a clearly defined scenario."],
    ["Escalating a risk constructively","surface a decision risk","The issue is still manageable, but delaying the decision would reduce our room to course-correct."],
    ["Leading a concise WIP review","focus the room on exceptions","Most workstreams remain on track; I will focus today on the two exceptions that require a decision or owner intervention."],
    ["Aligning stakeholders on next steps","convert discussion into commitment","Before we close, let me confirm the decision, accountable owner, deadline and condition that would cause us to revisit it."]
  ];
  const n = Math.floor((Date.UTC(Number(parts.year), Number(parts.month)-1, Number(parts.day)) - Date.UTC(Number(parts.year),0,0))/86400000);
  const [focus, skill, model] = lessons[n % lessons.length];
  return {
    title: "English for Work — Advanced (C1)",
    body: `<h3>Today's Focus｜${focus}</h3><p>今天练习的核心不是使用更复杂的词，而是用清晰、克制并且可推动决策的语言来完成 <b>${skill}</b>。高级商务表达需要同时做到：说明事实、标记判断、提出建议，并给对方留下参与空间。</p><h3>1. Executive-ready model</h3><p><b>${model}</b></p><p>My current view is based on the latest available evidence. The immediate impact is contained, but the trajectory deserves attention. I propose that we confirm the owner and timing today, then revisit the recommendation when the next data point becomes available.</p><h3>2. Useful meeting phrases</h3><ul><li><b>Let me distinguish the confirmed facts from our current interpretation.</b></li><li><b>The conclusion is directionally clear, although one assumption still needs validation.</b></li><li><b>I would recommend a targeted response rather than a broad intervention.</b></li><li><b>What would need to be true for us to support this recommendation?</b></li><li><b>Can we align on the decision this discussion needs to enable?</b></li><li><b>If there are no objections, I will capture this as the working agreement.</b></li></ul><h3>3. Cross-functional follow-up</h3><p><b>To keep the workstream on track, could each function confirm its final input and accountable owner by noon? If any dependency cannot be closed by then, please flag the specific decision or support required rather than simply reporting a delay.</b></p><h3>4. Word bank</h3><table><tr><th>Expression</th><th>Business meaning</th><th>Example</th></tr><tr><td>working assumption</td><td>当前用于推进工作的假设</td><td>We will use this as our working assumption.</td></tr><tr><td>directionally sound</td><td>方向基本正确</td><td>The recommendation is directionally sound.</td></tr><tr><td>critical path</td><td>决定项目时间的关键路径</td><td>This dependency sits on the critical path.</td></tr><tr><td>course-correct</td><td>及时调整方向</td><td>We still have time to course-correct.</td></tr><tr><td>decision threshold</td><td>触发决策的标准</td><td>We have not yet reached the decision threshold.</td></tr><tr><td>accountable owner</td><td>最终负责的责任人</td><td>Each action needs one accountable owner.</td></tr></table><h3>5. Chinglish upgrade</h3><p><b>Less natural:</b> I think maybe this method has some problems.<br><b>Executive version:</b> The approach is directionally sound, but two assumptions need further validation.</p><p><b>Less natural:</b> Please push your team and give me the data quickly.<br><b>Executive version:</b> Could we agree a firm cut-off and flag any dependency that may prevent delivery?</p><h3>6. Presentation phrase of the day</h3><p><b>The immediate impact is contained, but the trajectory deserves attention.</b></p><p>Use this when the current gap is manageable but the direction could create a larger future risk. It communicates control without understating the issue.</p><h3>7. Two-minute practice</h3><p>Choose one current project. Deliver five sentences covering: confirmed status, interpretation, business impact, recommendation and required decision. Avoid listing every detail; prioritize what the audience needs in order to act.</p><h3>8. Suggested answer</h3><p><b>The monthly refresh is largely on track, with one customer file still outstanding. The delay appears isolated rather than structural, but it affects our ability to complete the customer-level variance analysis. I recommend that we proceed with the management summary and treat the detailed view as a controlled follow-up. Could Sales confirm the accountable owner and final delivery time today? We will revisit the conclusion once the missing file is incorporated.</b></p>`
  };
}

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
let generated = null;
if (response.ok) {
  try {
    const payload = await response.json();
    const outputText = payload.choices?.[0]?.message?.content;
    generated = JSON.parse(outputText.replace(/^```json\s*|\s*```$/g, ""));
  } catch (error) {
    console.warn(`Generated content could not be parsed: ${error.message}`);
  }
} else {
  console.warn(`GitHub Models ${response.status}: ${await response.text()}`);
}
if (generated) {
  data[mode] = { title: generated.title, meta: `${date} · ${mode === "english" ? "今日 08:20" : "每周一 08:05"} · AI 完整版`, body: generated.body };
} else if (mode === "english") {
  const fallback = fallbackEnglish();
  data.english = { ...fallback, meta: `${date} · 今日 08:20 · 备用课程已更新` };
} else {
  data.pharmacy.meta = `${date} · 本周公开模型暂不可用 · 已保留上一期`;
}
await fs.writeFile(path, JSON.stringify(data, null, 2) + "\n");
