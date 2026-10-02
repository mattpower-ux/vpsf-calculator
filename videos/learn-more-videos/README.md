# VPSF Learn More video series

Eleven narration-led videos accompany the calculator's Learn More topics. Each MP4 is 1280 x 720 H.264 with AAC audio, approximately 45-55 seconds long. The same MP4s and opening-frame posters are installed under `frontend/public/videos/`.

Each recording name in the table begins with `ElevenLabs_audio_elevenlabs-v4_[warmly] `; the table shows the remaining unique portion of its filename.

| Topic / script | Supplied ElevenLabs recording | Finished video |
| --- | --- | --- |
| Heat Pump Water Heating (`energy-water-heating.txt`) | `Water _2026-10-02T20_53_58.mp3` | [energy-water-heating.mp4](../../frontend/public/videos/learn-more-energy-water-heating.mp4) |
| Water-Smart Fixtures (`water-fixtures.txt`) | `Water _2026-10-02T20_54_10.mp3` | [water-fixtures.mp4](../../frontend/public/videos/learn-more-water-fixtures.mp4) |
| Whole-Home Leak Detection (`water-leak-detection.txt`) | `A hidd_2026-10-02T20_55_14.mp3` | [water-leak-detection.mp4](../../frontend/public/videos/learn-more-water-leak-detection.mp4) |
| Balanced Fresh-Air Ventilation (`health-ventilation.txt`) | `As hom_2026-10-02T20_54_02.mp3` | [health-ventilation.mp4](../../frontend/public/videos/learn-more-health-ventilation.mp4) |
| Filtration + Moisture Control (`health-filtration.txt`) | `Indoor_2026-10-02T20_54_38.mp3` | [health-filtration.mp4](../../frontend/public/videos/learn-more-health-filtration.mp4) |
| Roof Durability + Risk (`roof-risk.txt`) | `A roof_2026-10-02T20_54_20.mp3` | [roof-risk.mp4](../../frontend/public/videos/learn-more-roof-risk.mp4) |
| Backup Power for Essentials (`resilience-backup-power.txt`) | `During_2026-10-02T20_54_19.mp3` | [resilience-backup-power.mp4](../../frontend/public/videos/learn-more-resilience-backup-power.mp4) |
| Lower-Carbon Materials (`carbon-materials.txt`) | `A home_2026-10-02T20_53_51.mp3` | [carbon-materials.mp4](../../frontend/public/videos/learn-more-carbon-materials.mp4) |
| Shade Trees + Storm Risk (`tree-risk.txt`) | `Trees _2026-10-02T20_54_06.mp3` | [tree-risk.mp4](../../frontend/public/videos/learn-more-tree-risk.mp4) |
| Community + Connectivity (`community-connectivity.txt`) | `A home_2026-10-02T20_53_57.mp3` | [community-connectivity.mp4](../../frontend/public/videos/learn-more-community-connectivity.mp4) |
| Ownership + Insurance Costs (`ownership-insurance.txt`) | `The pu_2026-10-02T20_54_48.mp3` | [ownership-insurance.mp4](../../frontend/public/videos/learn-more-ownership-insurance.mp4) |

The source compositions are in `videos/hvac-pilot/src/LearnMoreSeries.tsx` and `seriesCopy.ts`. To refresh narration durations and scene timing after replacing an audio file, run `node scripts/build-series.mjs` from `videos/hvac-pilot`, then render the corresponding Remotion composition.

## Visual assets

The eleven background images in `videos/hvac-pilot/public/topics/` were made with the built-in image-generation tool. The common prompt style was: photorealistic 16:9 architectural-magazine image, bright natural daylight, realistic building-science context, no text or logos, with composition suitable for a video text panel. Topic prompts called for: (1) heat-pump water heater and condensate drain, (2) efficient bathroom fixtures and native garden, (3) smart shutoff valve and leak sensor, (4) balanced ERV ducts, (5) accessible HVAC air filter, (6) layered roof assembly and flashing, (7) battery and critical-load panel, (8) lower-carbon building materials, (9) shade trees clear of the roof, (10) walkable neighborhood and transit, and (11) home maintenance records and major systems. These are illustrative images, not verified photographs of specific equipment or homes.
