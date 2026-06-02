"use client";
import { useEffect } from "react";
import { StyledSelect } from "@/components/ui/select-native";
import { getOrCreateDeviceId, readDeviceMap, setDeviceMapping, resolveRecordingProfileId } from "@/lib/studio/recording-profile";

type RP = { id: string; device_label: string; os: string };

export function DevicePicker({ recordingProfiles, value, onChange }: {
  recordingProfiles: RP[]; value: string; onChange: (id: string) => void;
}) {
  // On mount, resolve this machine's saved recording profile from localStorage and
  // initialize the parent's selection. getOrCreateDeviceId() is idempotent, so the
  // deviceId is read on demand in the change handler rather than held in state.
  useEffect(() => {
    const resolved = resolveRecordingProfileId(getOrCreateDeviceId(), readDeviceMap(), recordingProfiles[0]?.id);
    if (resolved && resolved !== value) onChange(resolved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <StyledSelect aria-label="Recording device" value={value} onChange={(e) => {
      onChange(e.target.value);
      const id = getOrCreateDeviceId();
      if (id) setDeviceMapping(id, e.target.value);
    }}>
      {recordingProfiles.map((rp) => (
        <option key={rp.id} value={rp.id}>{rp.device_label} · {rp.os}</option>
      ))}
    </StyledSelect>
  );
}
