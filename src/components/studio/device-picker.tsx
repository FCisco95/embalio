"use client";
import { useEffect, useState } from "react";
import { StyledSelect } from "@/components/ui/select-native";
import { getOrCreateDeviceId, readDeviceMap, setDeviceMapping, resolveRecordingProfileId } from "@/lib/studio/recording-profile";

type RP = { id: string; device_label: string; os: string };

export function DevicePicker({ recordingProfiles, value, onChange }: {
  recordingProfiles: RP[]; value: string; onChange: (id: string) => void;
}) {
  const [deviceId, setDeviceId] = useState("");
  useEffect(() => {
    const id = getOrCreateDeviceId();
    setDeviceId(id);
    const resolved = resolveRecordingProfileId(id, readDeviceMap(), recordingProfiles[0]?.id);
    if (resolved && resolved !== value) onChange(resolved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <StyledSelect aria-label="Recording device" value={value} onChange={(e) => {
      onChange(e.target.value);
      if (deviceId) setDeviceMapping(deviceId, e.target.value);
    }}>
      {recordingProfiles.map((rp) => (
        <option key={rp.id} value={rp.id}>{rp.device_label} · {rp.os}</option>
      ))}
    </StyledSelect>
  );
}
