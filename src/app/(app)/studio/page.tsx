import { getActiveProfile, seedRecordingProfilesIfEmpty } from "@/server/studio/recording-profiles";
import { listVideoProjects } from "@/server/studio/projects";
import { isYouTubeConnected } from "@/server/studio/publish";
import { StudioFlow } from "@/components/studio/studio-flow";

export default async function StudioPage() {
  let profileId = "";
  let recordingProfiles: Awaited<ReturnType<typeof seedRecordingProfilesIfEmpty>> = [];
  let projects: Awaited<ReturnType<typeof listVideoProjects>> = [];
  let ytConnected = false;
  try {
    const profile = await getActiveProfile();
    profileId = profile.id;
    recordingProfiles = await seedRecordingProfilesIfEmpty(profile.id);
    projects = await listVideoProjects(profile.id);
    ytConnected = await isYouTubeConnected(profile.id);
  } catch {
    // Render an empty studio if the DB/profile isn't ready (e.g. migrations not yet applied).
  }

  return (
    <div className="mx-auto max-w-content px-[30px] pb-[60px] pt-[26px] max-md:px-4">
      <div className="mb-[22px]">
        <h1 className="text-2xl font-bold tracking-[-0.02em]">Studio</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Trending topic → script → record → publish → repurpose.</p>
      </div>
      <StudioFlow
        profileId={profileId}
        recordingProfiles={recordingProfiles}
        initialProjects={projects}
        ytConnected={ytConnected}
      />
    </div>
  );
}
