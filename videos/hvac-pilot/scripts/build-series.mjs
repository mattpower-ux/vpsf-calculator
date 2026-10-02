import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repo = path.resolve(project, "../..");
const ffprobe = path.join(project, "node_modules", "@remotion", "compositor-win32-x64-msvc", "ffprobe.exe");
const ids = [
  "energy-water-heating",
  "water-fixtures",
  "water-leak-detection",
  "health-ventilation",
  "health-filtration",
  "roof-risk",
  "resilience-backup-power",
  "carbon-materials",
  "tree-risk",
  "community-connectivity",
  "ownership-insurance",
];

const topics = ids.map((id) => {
  const script = readFileSync(path.join(repo, "videos", "learn-more-narration", `${id}.txt`), "utf8").trim();
  const paragraphs = script.split(/\r?\n\s*\r?\n/).map((text) => text.trim());
  if (paragraphs.length !== 5) throw new Error(`${id}: expected five narration paragraphs`);
  const audio = path.join(project, "public", "audio", `${id}.mp3`);
  const duration = Number(execFileSync(ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", audio], { encoding: "utf8" }).trim());
  const totalFrames = Math.ceil((duration + 0.4) * 30);
  const weights = paragraphs.map((text) => text.match(/\S+/g).length + 2);
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  const sceneFrames = weights.map((weight) => Math.round(totalFrames * weight / totalWeight));
  sceneFrames[4] += totalFrames - sceneFrames.reduce((sum, value) => sum + value, 0);
  return { id, paragraphs, duration, totalFrames, sceneFrames };
});

writeFileSync(path.join(project, "src", "generated-series.json"), `${JSON.stringify(topics, null, 2)}\n`);
console.log(`Prepared ${topics.length} narration-synced videos.`);
