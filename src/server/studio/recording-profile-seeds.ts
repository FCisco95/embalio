export interface RecordingProfileInput {
  profile_id: string;
  device_label: string;
  os: string;
  monitors: { resolution: string; role: string }[];
  capture_tool: "OBS+Rapidemo" | "OBS";
  mic?: string;
  webcam?: string;
  teleprompter_placement: string;
  scene_presets: string[];
  export_path?: string;
  sync_target?: string;
}

export function defaultSeedProfiles(profileId: string): RecordingProfileInput[] {
  return [
    {
      profile_id: profileId,
      device_label: "Home (Windows)",
      os: "windows",
      monitors: [
        { resolution: "2560x1440", role: "primary" },
        { resolution: "1920x1080", role: "teleprompter" },
      ],
      capture_tool: "OBS+Rapidemo",
      teleprompter_placement: "second-monitor",
      scene_presets: ["face-cam", "screen+cam", "screen-only"],
      export_path: "C:/Recordings",
    },
    {
      profile_id: profileId,
      device_label: "Travel (Mac)",
      os: "macos",
      monitors: [{ resolution: "1512x982", role: "primary" }],
      capture_tool: "OBS",
      teleprompter_placement: "webcam-overlay",
      scene_presets: ["face-cam", "screen+cam"],
      export_path: "~/Recordings",
    },
  ];
}
