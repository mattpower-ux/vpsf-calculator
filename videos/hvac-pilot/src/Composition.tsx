import { Composition } from "remotion";
import timings from "./timings.json";
import { HvacPilot } from "./Video";

export const MyComposition = () => (
  <Composition
    id="HvacSmartControls"
    component={HvacPilot}
    durationInFrames={timings.reduce((sum, scene) => sum + scene.frames, 0)}
    fps={30}
    width={1280}
    height={720}
  />
);
