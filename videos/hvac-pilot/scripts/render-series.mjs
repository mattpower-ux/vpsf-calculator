import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const project = fileURLToPath(new URL("../", import.meta.url));
const topics = JSON.parse(readFileSync(join(project, "src/generated-series.json"), "utf8"));
const cli = join(project, "node_modules/@remotion/cli/remotion-cli.js");
const ffmpeg = join(project, "node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe");
const ffprobe = join(project, "node_modules/@remotion/compositor-win32-x64-msvc/ffprobe.exe");
const outputDir = join(project, "out/revised");
mkdirSync(outputDir, { recursive: true });
const only = process.argv.find((arg) => arg.startsWith("--only="))?.slice(7).split(",");
if (only?.some((id) => !topics.some((topic) => topic.id === id))) {
  throw new Error(`Unknown topic in --only: ${only.join(", ")}`);
}

const run = (executable, args) => {
  const result = spawnSync(executable, args, { cwd: project, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${executable} failed:\n${result.stderr || result.stdout}`);
  return result.stdout;
};

for (const topic of topics.filter((topic) => !only || only.includes(topic.id))) {
  const video = join(outputDir, `learn-more-${topic.id}.mp4`);
  const poster = join(outputDir, `learn-more-${topic.id}-poster.jpg`);
  if (!existsSync(video) || process.argv.includes("--force")) {
    process.stdout.write(`Rendering ${topic.id}...\n`);
    run(process.execPath, [cli, "render", `LearnMore-${topic.id}`, video,
      "--codec", "h264", "--crf", "27", "--audio-bitrate", "96k", "--concurrency", "2"]);
  }
  const probe = JSON.parse(run(ffprobe, ["-v", "error", "-show_streams", "-show_format", "-of", "json", video]));
  const picture = probe.streams.find((stream) => stream.codec_type === "video");
  const sound = probe.streams.find((stream) => stream.codec_type === "audio");
  const duration = Number(probe.format.duration);
  if (picture?.codec_name !== "h264" || picture.width !== 1280 || picture.height !== 720 || sound?.codec_name !== "aac") {
    throw new Error(`Unexpected media streams for ${topic.id}`);
  }
  if (Math.abs(duration - topic.totalFrames / 30) > 1 || statSync(video).size > 15_000_000) {
    throw new Error(`Unexpected duration or size for ${topic.id}: ${duration}s, ${statSync(video).size} bytes`);
  }
  run(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", "-ss", "3", "-i", video, "-frames:v", "1", "-q:v", "4", poster]);
  process.stdout.write(`Verified ${topic.id}: ${duration.toFixed(1)}s, ${(statSync(video).size / 1_000_000).toFixed(1)} MB\n`);
}
