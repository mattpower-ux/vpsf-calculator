import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const project = fileURLToPath(new URL("../", import.meta.url));
const visuals = JSON.parse(readFileSync(join(project, "src/seriesVisuals.json"), "utf8"));
const ffmpeg = join(project, "node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe");
const rawDir = join(project, "out/source-downloads");
mkdirSync(rawDir, { recursive: true });

const assertGbmUrl = (value) => {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "www.greenbuildermedia.com") {
    throw new Error(`Unexpected image source: ${value}`);
  }
  return url;
};

const getHeroImage = async (article) => {
  const response = await fetch(assertGbmUrl(article));
  if (!response.ok) throw new Error(`Article returned ${response.status}: ${article}`);
  const html = await response.text();
  const tag = html.match(/<meta\b[^>]*property=["']og:image["'][^>]*>/i)?.[0]
    ?? html.match(/<meta\b[^>]*content=["'][^"']+["'][^>]*property=["']og:image["'][^>]*>/i)?.[0];
  const url = tag?.match(/content=["']([^"']+)["']/i)?.[1]?.replaceAll("&amp;", "&");
  if (!url) throw new Error(`No og:image: ${article}`);
  return assertGbmUrl(url).toString();
};

const records = [];
for (const topic of visuals) {
  for (const photo of topic.photos.filter(({ article }) => article)) {
    const output = join(project, "public", photo.file);
    const imageUrl = photo.imageUrl ?? await getHeroImage(photo.article);
    records.push({ topic: topic.id, file: photo.file, article: photo.article, imageUrl });
    if (existsSync(output) && !process.argv.includes("--force")) {
      process.stdout.write(`Kept ${photo.file}\n`);
      continue;
    }
    const response = await fetch(assertGbmUrl(imageUrl));
    if (!response.ok) throw new Error(`Image returned ${response.status}: ${imageUrl}`);
    const extension = extname(new URL(imageUrl).pathname) || ".jpg";
    const raw = join(rawDir, `${basename(photo.file)}${extension}`);
    const imageBytes = Buffer.from(await response.arrayBuffer());
    writeFileSync(raw, imageBytes);
    mkdirSync(dirname(output), { recursive: true });
    if (extension.toLowerCase() === ".webp") {
      writeFileSync(output, imageBytes);
      process.stdout.write(`Fetched ${photo.file}\n`);
      continue;
    }
    const result = spawnSync(ffmpeg, [
      "-y", "-hide_banner", "-loglevel", "error", "-i", raw,
      "-vf", "scale=1440:810:force_original_aspect_ratio=decrease",
      "-frames:v", "1", "-q:v", "4", output,
    ], { encoding: "utf8" });
    if (result.status !== 0) throw new Error(`Could not convert ${photo.file}: ${result.stderr}`);
    process.stdout.write(`Fetched ${photo.file}\n`);
  }
}
writeFileSync(join(project, "src/seriesVisualSources.json"), `${JSON.stringify(records, null, 2)}\n`);
