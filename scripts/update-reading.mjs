import fs from "node:fs/promises";

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year:"numeric", month:"2-digit", day:"2-digit", weekday:"short", hour:"2-digit", hour12:false });
const parts = Object.fromEntries(formatter.formatToParts(new Date()).map(x => [x.type, x.value]));
const mode = Number(parts.hour) < 12 ? "pharmacy" : "english";
const date = `${parts.year}-${parts.month}-${parts.day}`;

const prompts = {
  english: `Create today's advanced C1 English-for-work lesson for a Commercial Excellence and Sales Operations professional in China. Focus on emails, meetings, presentations or cross-functional conversations. Return valid JSON only with keys title and body. body must be safe semantic HTML using only h3, p, b, ul, li and table tags. Include executive phrasing, a word bank, Chinglish corrections, one presentation phrase, and a 2-minute exercise. Do not use markdown fences. Date: ${date}.`,
  pharmacy: `Research and create a concise China retail pharmacy and Commercial Excellence brief for a Sales Operations professional. Prioritize consequential and recent policy, procurement, pharmacy-chain, channel and digital-health developments. Explain implications for KPI allocation, IMS/Offtake, inventory, pricing and reporting. Use web search and distinguish confirmed facts from analysis. Return valid JSON only with keys title and body. body must be safe semantic HTML using only h3, p, b, ul, li and table tags. Do not use markdown fences. Observation date: ${date}.`
};

const request = { model:"gpt-5.6-sol", input:prompts[mode] };
if (mode === "pharmacy") request.tools = [{ type:"web_search" }];
const response = await fetch("https://api.openai.com/v1/responses", { method:"POST", headers:{"Authorization":`Bearer ${apiKey}`,"Content-Type":"application/json"}, body:JSON.stringify(request) });
if (!response.ok) throw new Error(`OpenAI API ${response.status}: ${await response.text()}`);
const payload = await response.json();
const outputText = payload.output_text || payload.output?.flatMap(x=>x.content||[]).find(x=>x.type==="output_text")?.text;
if (!outputText) throw new Error("No output text returned");
const generated = JSON.parse(outputText.replace(/^```json\s*|\s*```$/g,""));
const path = new URL("../reading-data.json", import.meta.url);
const data = JSON.parse(await fs.readFile(path,"utf8"));
data[mode] = { title:generated.title, meta:`${date} · ${mode==="english"?"工作日 21:05":"每周一 08:05"} 自动更新`, body:generated.body };
await fs.writeFile(path, JSON.stringify(data,null,2)+"\n");
