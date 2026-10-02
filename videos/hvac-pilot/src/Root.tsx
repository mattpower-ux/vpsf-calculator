import { MyComposition } from "./Composition";
import { Composition } from "remotion";
import generated from "./generated-series.json";
import { LearnMoreSeries } from "./LearnMoreSeries";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <MyComposition />
      {generated.map((topic) => (
        <Composition
          key={topic.id}
          id={`LearnMore-${topic.id}`}
          component={LearnMoreSeries}
          durationInFrames={topic.totalFrames}
          fps={30}
          width={1280}
          height={720}
          defaultProps={{ topicId: topic.id }}
        />
      ))}
    </>
  );
};
