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
import content from "./content.json";
import timings from "./timings.json";

const navy = "#082d4d";
const deepNavy = "#061d33";
const blue = "#1474d4";
const cyan = "#54c7eb";
const gold = "#ffd04a";

type SceneData = (typeof content)[number];

const captionParts = (text: string) => text.match(/[^.]+\.?/g)?.map((s) => s.trim()).filter(Boolean) ?? [text];

const Brand = () => (
  <div style={{ display: "flex", alignItems: "baseline", gap: 17, color: "white" }}>
    <strong style={{ fontSize: 36, fontWeight: 800, letterSpacing: 1 }}>VPSF</strong>
    <span style={{ width: 2, height: 25, background: gold }} />
    <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: 2.5 }}>VALUE PER SQUARE FOOT</span>
  </div>
);

const Photo = ({ src, focus = "center" }: { src: string; focus?: string }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const scale = interpolate(frame, [0, durationInFrames], [1.03, 1.13], { extrapolateRight: "clamp" });
  return (
    <Img
      src={staticFile(src)}
      style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: focus, transform: `scale(${scale})` }}
    />
  );
};

const Caption = ({ narration, duration }: { narration: string; duration: number }) => {
  const frame = useCurrentFrame();
  const parts = captionParts(narration);
  const index = Math.min(parts.length - 1, Math.floor(frame / (duration / parts.length)));
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, minHeight: 84, display: "flex", alignItems: "center", justifyContent: "center", padding: "12px 86px", background: deepNavy, color: "white", fontSize: 31, fontWeight: 600, lineHeight: 1.25, textAlign: "center" }}>
      {parts[index]}
    </div>
  );
};

const Header = ({ index }: { index: number }) => (
  <div style={{ position: "absolute", left: 62, right: 62, top: 44, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
    <Brand />
    <span style={{ color: gold, fontSize: 19, fontWeight: 800, letterSpacing: 2 }}>{String(index + 1).padStart(2, "0")} / 05</span>
  </div>
);

const SceneCopy = ({ scene, align = "left", titleSize = 62, showSubtitle = true }: { scene: SceneData; align?: "left" | "right"; titleSize?: number; showSubtitle?: boolean }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const reveal = spring({ frame, fps, config: { damping: 18, stiffness: 85 } });
  return (
    <div style={{ textAlign: align, opacity: reveal, transform: `translateY(${(1 - reveal) * 35}px)` }}>
      <div style={{ color: gold, fontSize: 20, fontWeight: 800, letterSpacing: 2.4, marginBottom: 19 }}>{scene.eyebrow}</div>
      <h1 style={{ fontSize: titleSize, lineHeight: 1.14, margin: 0, maxWidth: 780, fontWeight: 800, letterSpacing: 0 }}>{scene.id === "close" ? <>Reduce.<br />Right-size. Verify.</> : scene.title}</h1>
      {showSubtitle && <p style={{ fontSize: 29, lineHeight: 1.3, marginTop: 22, color: "#d6ecfa", maxWidth: 570 }}>{scene.subtitle}</p>}
    </div>
  );
};

const Intro = ({ scene }: { scene: SceneData }) => (
  <AbsoluteFill style={{ overflow: "hidden", background: navy }}>
    <Photo src="cutaway-home.png" />
    <div style={{ position: "absolute", inset: "0 42% 0 0", background: navy, opacity: 0.96 }} />
    <Header index={0} />
    <div style={{ position: "absolute", left: 64, top: 220, width: 680, color: "white" }}><SceneCopy scene={scene} /></div>
    <Caption narration={scene.narration} duration={timings[0].frames} />
  </AbsoluteFill>
);

const Envelope = ({ scene }: { scene: SceneData }) => {
  const frame = useCurrentFrame();
  const focus = interpolate(frame, [0, timings[1].frames], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: navy }}>
      <Photo src="cutaway-home.png" focus="65% center" />
      <div style={{ position: "absolute", inset: "0 47% 0 0", background: navy, opacity: 0.96 }} />
      <Header index={1} />
      <div style={{ position: "absolute", left: 64, top: 193, width: 555, color: "white" }}><SceneCopy scene={scene} /></div>
      <div style={{ position: "absolute", right: 183, top: 143, width: 102, height: 102, border: `5px solid ${gold}`, borderRadius: "50%", boxShadow: `0 0 ${18 + focus * 28}px ${gold}`, opacity: 0.86 }} />
      <div style={{ position: "absolute", right: 165, top: 278, padding: "10px 20px", color: navy, background: "white", fontSize: 22, fontWeight: 800 }}>ATTIC INSULATION</div>
      <div style={{ position: "absolute", right: 155, top: 412, padding: "10px 20px", color: navy, background: "white", fontSize: 22, fontWeight: 800 }}>SEALED ENVELOPE</div>
      <Caption narration={scene.narration} duration={timings[1].frames} />
    </AbsoluteFill>
  );
};

const Sizing = ({ scene }: { scene: SceneData }) => {
  const frame = useCurrentFrame();
  const output = interpolate(frame, [0, timings[2].frames], [52, 67], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: navy, color: "white" }}>
      <div style={{ position: "absolute", top: 0, right: 0, bottom: 84, width: "44%", overflow: "hidden" }}><Photo src="cutaway-home.png" focus="74% center" /></div>
      <div style={{ position: "absolute", top: 0, right: "39%", bottom: 84, width: 85, background: blue }} />
      <Header index={2} />
      <div style={{ position: "absolute", left: 64, top: 155, width: 690 }}><SceneCopy scene={scene} /></div>
      <div style={{ position: "absolute", left: 64, top: 454, width: 580, fontSize: 19, fontWeight: 800, letterSpacing: 1.5 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}><span>HOME'S CHANGING LOAD</span><span style={{ color: cyan }}>VARIABLE OUTPUT</span></div>
        <div style={{ height: 28, background: "#41647c" }}><div style={{ height: "100%", width: `${output}%`, background: cyan }} /></div>
        <div style={{ fontSize: 18, color: "#b8ccda", marginTop: 9 }}>Illustrative: a real load calculation is home-specific.</div>
      </div>
      <Caption narration={scene.narration} duration={timings[2].frames} />
    </AbsoluteFill>
  );
};

const Controls = ({ scene }: { scene: SceneData }) => (
  <AbsoluteFill style={{ overflow: "hidden", background: navy }}>
    <Photo src="smart-controls.png" />
    <div style={{ position: "absolute", inset: "0 0 0 48%", background: navy, opacity: 0.96 }} />
    <Header index={3} />
    <div style={{ position: "absolute", right: 62, top: 178, width: 525, color: "white" }}><SceneCopy scene={scene} align="right" titleSize={54} showSubtitle={false} /></div>
    <div style={{ position: "absolute", right: 62, top: 518, display: "flex", gap: 11, color: navy, fontSize: 17, fontWeight: 800 }}>
      {["AIRFLOW", "HUMIDITY", "SCHEDULE"].map((label) => <span key={label} style={{ background: gold, padding: "8px 12px" }}>{label}</span>)}
    </div>
    <Caption narration={scene.narration} duration={timings[3].frames} />
  </AbsoluteFill>
);

const Close = ({ scene }: { scene: SceneData }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: deepNavy, color: "white" }}>
      <Header index={4} />
      <div style={{ position: "absolute", left: 62, top: 155, width: 780 }}><SceneCopy scene={scene} titleSize={58} /></div>
      <div style={{ position: "absolute", left: 62, top: 452, right: 62, display: "flex", gap: 16 }}>
        {["01  LOWER THE LOAD", "02  RIGHT-SIZE EQUIPMENT", "03  KEEP THE RECORDS"].map((step, index) => {
          const opacity = interpolate(frame, [index * 28 + 18, index * 28 + 42], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return <div key={step} style={{ width: "33%", padding: "20px 18px", borderTop: `6px solid ${index === 2 ? gold : cyan}`, background: navy, fontSize: 19, lineHeight: 1.25, fontWeight: 800, opacity }}>{step}</div>;
        })}
      </div>
      <Caption narration={scene.narration} duration={timings[4].frames} />
    </AbsoluteFill>
  );
};

const sceneComponents = [Intro, Envelope, Sizing, Controls, Close];

export const HvacPilot = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      <Audio src={staticFile("audio/hvac-overview.mp3")} />
      <Series>
        {content.map((scene, index) => {
          const Component = sceneComponents[index];
          return (
            <Series.Sequence key={scene.id} name={scene.title} durationInFrames={timings[index].frames} premountFor={fps}>
              <Component scene={scene} />
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
};
