import { Audio } from "@remotion/media";
import {
  AbsoluteFill,
  Img,
  Series,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import generated from "./generated-series.json";
import { seriesCopy } from "./seriesCopy";

const navy = "#082d4d";
const deepNavy = "#061d33";
const cyan = "#54c7eb";
const gold = "#ffd04a";

const brand = (
  <div style={{ display: "flex", alignItems: "baseline", gap: 16, color: "white", whiteSpace: "nowrap" }}>
    <strong style={{ fontSize: 36, fontWeight: 800 }}>VPSF</strong>
    <span style={{ width: 2, height: 26, background: gold }} />
    <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: 2.3 }}>VALUE PER SQUARE FOOT</span>
  </div>
);

const Header = ({ index }: { index: number }) => (
  <div style={{ position: "absolute", zIndex: 3, left: 62, right: 62, top: 42, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
    {brand}
    <span style={{ color: gold, fontSize: 20, fontWeight: 800, letterSpacing: 1.8 }}>{String(index + 1).padStart(2, "0")} / 05</span>
  </div>
);

const Photo = ({ src, focus = "center" }: { src: string; focus?: string }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const scale = interpolate(frame, [0, durationInFrames], [1.01, 1.09], { extrapolateRight: "clamp" });
  return <Img src={staticFile(`topics/${src}.jpg`)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: focus, transform: `scale(${scale})` }} />;
};

const captionChunks = (paragraph: string) => {
  const sentences = paragraph.match(/[^.!?]+[.!?]?/g)?.map((part) => part.trim()).filter(Boolean) ?? [paragraph];
  return sentences.flatMap((sentence) => {
    if (sentence.length <= 125) return [sentence];
    const words = sentence.split(/\s+/);
    const chunks: string[] = [];
    let chunk = "";
    for (const word of words) {
      if (chunk && `${chunk} ${word}`.length > 105) {
        chunks.push(chunk);
        chunk = word;
      } else {
        chunk = chunk ? `${chunk} ${word}` : word;
      }
    }
    if (chunk) chunks.push(chunk);
    return chunks;
  });
};

const Caption = ({ paragraph, frames }: { paragraph: string; frames: number }) => {
  const frame = useCurrentFrame();
  const chunks = captionChunks(paragraph);
  const index = Math.min(chunks.length - 1, Math.floor(frame / (frames / chunks.length)));
  return (
    <div style={{ position: "absolute", zIndex: 4, left: 0, right: 0, bottom: 0, height: 106, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", padding: "10px 78px", background: deepNavy, color: "white", fontSize: 27, fontWeight: 600, lineHeight: 1.22, textAlign: "center" }}>
      {chunks[index]}
    </div>
  );
};

const Title = ({ eyebrow, title, intro, width = 560 }: { eyebrow: string; title: string; intro?: string; width?: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const reveal = spring({ frame, fps, config: { damping: 18, stiffness: 85 } });
  return (
    <div style={{ width, opacity: reveal, transform: `translateY(${(1 - reveal) * 26}px)` }}>
      <div style={{ color: gold, fontSize: 19, fontWeight: 800, letterSpacing: 2, lineHeight: 1.3, marginBottom: 20 }}>{eyebrow}</div>
      <h1 style={{ margin: 0, color: "white", fontSize: title.length > 32 ? 51 : 57, lineHeight: 1.12, fontWeight: 800, letterSpacing: 0 }}>{title}</h1>
      {intro && <p style={{ margin: "20px 0 0", color: "#d6ecfa", fontSize: 27, lineHeight: 1.25, maxWidth: 520 }}>{intro}</p>}
    </div>
  );
};

type SceneProps = {
  id: string;
  pillar: string;
  title: string;
  intro: string;
  beats: [string, string, string, string, string];
  detail: [string, string, string];
  steps: [string, string, string];
  paragraph: string;
  frames: number;
  index: number;
};

const Scene = (props: SceneProps) => {
  const { id, pillar, title, intro, beats, detail, steps, paragraph, frames, index } = props;
  const frame = useCurrentFrame();
  const leftPhoto = index === 2 || index === 3;
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: index === 4 ? deepNavy : navy, fontFamily: "Arial, Helvetica, sans-serif" }}>
      {index < 4 && (
        <div style={{ position: "absolute", top: 120, bottom: 106, left: leftPhoto ? 0 : "52%", right: leftPhoto ? "52%" : 0, overflow: "hidden" }}>
          <Photo src={id} focus="70% center" />
        </div>
      )}
      <Header index={index} />
      {index === 0 && <div style={{ position: "absolute", left: 62, top: 197 }}><Title eyebrow={`VPSF LEARN MORE / ${pillar}`} title={title} intro={intro} width={610} /></div>}
      {(index === 1 || index === 2) && (
        <div style={{ position: "absolute", left: leftPhoto ? 680 : 62, top: 198 }}>
          <Title eyebrow={`${String(index).padStart(2, "0")} / ${index === 1 ? "THE PRINCIPLE" : "HOW IT WORKS"}`} title={beats[index]} width={leftPhoto ? 525 : 550} />
          <div style={{ width: 110, height: 6, background: cyan, marginTop: 38 }} />
        </div>
      )}
      {index === 3 && (
        <div style={{ position: "absolute", right: 64, top: 192, width: 550 }}>
          <Title eyebrow="03 / WHAT TO LOOK FOR" title={beats[3]} width={540} />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 34, maxWidth: 535 }}>
            {detail.map((item, itemIndex) => {
              const opacity = interpolate(frame, [itemIndex * 14 + 12, itemIndex * 14 + 28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              return <span key={item} style={{ padding: "10px 14px", background: gold, color: deepNavy, fontSize: 16, lineHeight: 1.1, fontWeight: 800, opacity }}>{item}</span>;
            })}
          </div>
        </div>
      )}
      {index === 4 && (
        <>
          <div style={{ position: "absolute", left: 62, top: 176 }}><Title eyebrow="THE SUSTAINABLE PATH" title={beats[4]} width={1000} /></div>
          <div style={{ position: "absolute", left: 62, right: 62, top: 419, display: "flex", gap: 15 }}>
            {steps.map((step, itemIndex) => {
              const opacity = interpolate(frame, [itemIndex * 18 + 12, itemIndex * 18 + 29], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              return <div key={step} style={{ flex: 1, minWidth: 0, minHeight: 86, boxSizing: "border-box", padding: "16px 15px", borderTop: `5px solid ${itemIndex === 2 ? gold : cyan}`, background: navy, color: "white", fontSize: 18, fontWeight: 800, lineHeight: 1.2, opacity }}>{step}</div>;
            })}
          </div>
        </>
      )}
      <Caption paragraph={paragraph} frames={frames} />
    </AbsoluteFill>
  );
};

export const LearnMoreSeries = ({ topicId }: { topicId: string }) => {
  const data = generated.find((topic) => topic.id === topicId);
  const copy = seriesCopy.find((topic) => topic.id === topicId);
  const { fps } = useVideoConfig();
  if (!data || !copy) throw new Error(`Unknown Learn More topic: ${topicId}`);
  return (
    <AbsoluteFill>
      <Audio src={staticFile(`audio/${topicId}.mp3`)} />
      <Series>
        {data.paragraphs.map((paragraph, index) => (
          <Series.Sequence key={index} name={copy.beats[index]} durationInFrames={data.sceneFrames[index]} premountFor={fps}>
            <Scene {...copy} paragraph={paragraph} frames={data.sceneFrames[index]} index={index} />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
};
