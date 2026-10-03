import { Audio } from "@remotion/media";
import { AbsoluteFill, Img, Series, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import generated from "./generated-series.json";
import { seriesCopy, type TopicCopy } from "./seriesCopy";
import seriesVisuals from "./seriesVisuals.json";

const navy = "#082d4d";
const deepNavy = "#061d33";
const cyan = "#54c7eb";
const gold = "#ffd04a";
type TopicVisual = (typeof seriesVisuals)[number];
type PhotoData = TopicVisual["photos"][number];

const Header = ({ index }: { index: number }) => (
  <div style={{ position: "absolute", zIndex: 3, left: 62, right: 62, top: 42, display: "flex", alignItems: "center", justifyContent: "space-between", color: "white" }}>
    <div style={{ display: "flex", alignItems: "baseline", gap: 16, whiteSpace: "nowrap" }}>
      <strong style={{ fontSize: 36, fontWeight: 800 }}>VPSF</strong>
      <span style={{ width: 2, height: 26, background: gold }} />
      <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: 2.3 }}>VALUE PER SQUARE FOOT</span>
    </div>
    <span style={{ color: gold, fontSize: 20, fontWeight: 800, letterSpacing: 1.8 }}>{String(index + 1).padStart(2, "0")} / 05</span>
  </div>
);

const PhotoFrame = ({ photo, style }: { photo: PhotoData; style: React.CSSProperties }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.07], { extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", overflow: "hidden", ...style }}>
      <Img src={staticFile(photo.file)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", transform: `scale(${scale})` }} />
    </div>
  );
};

const captionChunks = (paragraph: string) => {
  const sentences = paragraph.match(/[^.!?]+[.!?]?/g)?.map((part) => part.trim()).filter(Boolean) ?? [paragraph];
  return sentences.flatMap((sentence) => {
    if (sentence.length <= 125) return [sentence];
    const chunks: string[] = [];
    let chunk = "";
    for (const word of sentence.split(/\s+/)) {
      if (chunk && `${chunk} ${word}`.length > 105) {
        chunks.push(chunk);
        chunk = word;
      } else chunk = chunk ? `${chunk} ${word}` : word;
    }
    if (chunk) chunks.push(chunk);
    return chunks;
  });
};

const Caption = ({ paragraph, frames }: { paragraph: string; frames: number }) => {
  const frame = useCurrentFrame();
  const chunks = captionChunks(paragraph);
  const index = Math.min(chunks.length - 1, Math.floor(frame / (frames / chunks.length)));
  return <div style={{ position: "absolute", zIndex: 4, left: 0, right: 0, bottom: 0, height: 106, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", padding: "10px 78px", background: deepNavy, color: "white", fontSize: 27, fontWeight: 600, lineHeight: 1.22, textAlign: "center" }}>{chunks[index]}</div>;
};

const Title = ({ eyebrow, title, intro, width = 560 }: { eyebrow: string; title: string; intro?: string; width?: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const reveal = spring({ frame, fps, config: { damping: 18, stiffness: 85 } });
  return (
    <div style={{ width, opacity: reveal, transform: `translateY(${(1 - reveal) * 26}px)` }}>
      <div style={{ color: gold, fontSize: 19, fontWeight: 800, letterSpacing: 2, lineHeight: 1.3, marginBottom: 20 }}>{eyebrow}</div>
      <h1 style={{ margin: 0, color: "white", fontSize: title.length > 32 ? 49 : 56, lineHeight: 1.12, fontWeight: 800 }}>{title}</h1>
      {intro && <p style={{ margin: "20px 0 0", color: "#d6ecfa", fontSize: 27, lineHeight: 1.25, maxWidth: 520 }}>{intro}</p>}
    </div>
  );
};

const ChartScene = ({ chart, index }: { chart: TopicVisual["chart"]; index: number }) => {
  const frame = useCurrentFrame();
  const maxValue = Math.max(...chart.rows.map(({ value }) => value), 1);
  return (
    <>
      <div style={{ position: "absolute", left: 62, right: 62, top: 140 }}>
        <div style={{ color: gold, fontSize: 19, fontWeight: 800, letterSpacing: 2, marginBottom: 14 }}>{String(index).padStart(2, "0")} / BY THE NUMBERS</div>
        <h2 style={{ color: "white", fontSize: 47, lineHeight: 1.1, margin: 0 }}>{chart.title}</h2>
        <div style={{ color: cyan, fontSize: 22, fontWeight: 800, marginTop: 10, letterSpacing: 1 }}>{chart.unit}</div>
        <div style={{ color: "#bcd6e7", fontSize: 20, marginTop: 7 }}>SOURCE: {chart.source}</div>
      </div>
      <div style={{ position: "absolute", left: 62, right: 62, top: 315, display: "grid", gap: chart.rows.length === 3 ? 15 : 26 }}>
        {chart.rows.map((row, rowIndex) => {
          const progress = interpolate(frame, [rowIndex * 10 + 16, rowIndex * 10 + 55], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div key={row.label} style={{ height: chart.rows.length === 3 ? 64 : 83, display: "flex", alignItems: "center", gap: 18 }}>
              <div style={{ width: 335, flexShrink: 0, color: "white", fontSize: 27, fontWeight: 700, lineHeight: 1.1 }}>{row.label}</div>
              <div style={{ height: 36, flex: 1, background: "#1a4567", overflow: "hidden" }}>
                <div style={{ width: `${row.value / maxValue * 100 * progress}%`, height: "100%", background: rowIndex === 0 ? cyan : gold }} />
              </div>
              <div style={{ width: 134, flexShrink: 0, color: rowIndex === 0 ? cyan : gold, fontSize: 39, fontWeight: 800, textAlign: "right" }}>{row.display}</div>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 62, right: 62, bottom: 125, color: "#d6ecfa", fontSize: 23, lineHeight: 1.2 }}>{chart.note}</div>
    </>
  );
};

type SceneProps = TopicCopy & { visual: TopicVisual; paragraph: string; frames: number; index: number };

const Scene = ({ pillar, title, intro, beats, detail, steps, visual, paragraph, frames, index }: SceneProps) => {
  const frame = useCurrentFrame();
  const chartScene = index === visual.chartScene;
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: index === 4 || chartScene ? deepNavy : navy, fontFamily: "Arial, Helvetica, sans-serif" }}>
      {index === 0 && <>
        <PhotoFrame photo={visual.photos[0]} style={{ top: 120, bottom: 106, left: "51%", right: 0 }} />
        <div style={{ position: "absolute", left: 62, top: 195 }}><Title eyebrow={`VPSF LEARN MORE / ${pillar}`} title={title} intro={intro} width={575} /></div>
      </>}
      {chartScene && <ChartScene chart={visual.chart} index={index} />}
      {(index === 1 || index === 2) && !chartScene && <>
        <PhotoFrame photo={visual.photos[1]} style={{ top: 120, bottom: 106, left: index === 1 ? 0 : "52%", right: index === 1 ? "52%" : 0 }} />
        <div style={{ position: "absolute", left: index === 1 ? 680 : 62, top: 190 }}>
          <Title eyebrow={`${String(index).padStart(2, "0")} / ${index === 1 ? "THE PRINCIPLE" : "HOW IT WORKS"}`} title={beats[index]} width={index === 1 ? 515 : 550} />
          <div style={{ width: 110, height: 6, background: cyan, marginTop: 32 }} />
        </div>
      </>}
      {index === 3 && <>
        <PhotoFrame photo={visual.photos[2]} style={{ top: 120, bottom: 106, left: 0, right: "52%" }} />
        <div style={{ position: "absolute", left: 680, top: 175, width: 520 }}>
          <Title eyebrow="03 / WHAT TO LOOK FOR" title={beats[3]} width={510} />
          <div style={{ display: "grid", gap: 10, marginTop: 27 }}>
            {detail.map((item, itemIndex) => {
              const opacity = interpolate(frame, [itemIndex * 14 + 12, itemIndex * 14 + 28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              return <div key={item} style={{ borderLeft: `5px solid ${gold}`, padding: "10px 15px", color: "white", background: "#123e60", fontSize: 22, fontWeight: 800, lineHeight: 1.1, opacity }}>{item}</div>;
            })}
          </div>
        </div>
      </>}
      {index === 4 && <>
        <PhotoFrame photo={visual.photos[0]} style={{ top: 120, height: 244, left: 0, width: 535 }} />
        <PhotoFrame photo={visual.photos[2]} style={{ top: 370, bottom: 106, left: 0, width: 535 }} />
        <div style={{ position: "absolute", left: 615, top: 162, width: 585 }}>
          <Title eyebrow="THE SUSTAINABLE PATH" title={beats[4]} width={575} />
          <div style={{ display: "grid", gap: 12, marginTop: 30 }}>
            {steps.map((step, itemIndex) => {
              const opacity = interpolate(frame, [itemIndex * 18 + 12, itemIndex * 18 + 29], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              return <div key={step} style={{ minHeight: 46, boxSizing: "border-box", padding: "12px 16px", borderLeft: `5px solid ${itemIndex === 2 ? gold : cyan}`, background: navy, color: "white", fontSize: 22, fontWeight: 800, lineHeight: 1.12, opacity }}>{step}</div>;
            })}
          </div>
        </div>
      </>}
      <div style={{ position: "absolute", left: 0, right: 0, top: 116, height: 4, background: cyan, opacity: 0.7 }} />
      <Header index={index} />
      <Caption paragraph={paragraph} frames={frames} />
    </AbsoluteFill>
  );
};

export const LearnMoreSeries = ({ topicId }: { topicId: string }) => {
  const data = generated.find((topic) => topic.id === topicId);
  const copy = seriesCopy.find((topic) => topic.id === topicId);
  const visual = seriesVisuals.find((topic) => topic.id === topicId);
  const { fps } = useVideoConfig();
  if (!data || !copy || !visual) throw new Error(`Unknown Learn More topic: ${topicId}`);
  return <AbsoluteFill>
    <Audio src={staticFile(`audio/${topicId}.mp3`)} />
    <Series>
      {data.paragraphs.map((paragraph, index) => <Series.Sequence key={index} name={copy.beats[index]} durationInFrames={data.sceneFrames[index]} premountFor={fps}>
        <Scene {...copy} visual={visual} paragraph={paragraph} frames={data.sceneFrames[index]} index={index} />
      </Series.Sequence>)}
    </Series>
  </AbsoluteFill>;
};
