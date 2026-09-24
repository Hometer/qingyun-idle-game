export interface EncounterOptionIn {
  option_id: string;
  label: string;
  meaning: string;
}

export interface EncounterRequestBody {
  event_id: string;
  character: { name: string; realm: string; spirit_root: string };
  map_id: string;
  options: EncounterOptionIn[];
  recent_logs: string[];
}

export interface EncounterResponse {
  source: "model" | "template";
  event_id: string;
  title: string;
  body: string;
  options: { option_id: string; option_text: string }[];
}

export async function generateEncounter(
  body: EncounterRequestBody,
): Promise<EncounterResponse | null> {
  try {
    const resp = await fetch("/api/v1/encounter/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    const data = await resp.json();
    if (resp.ok && data && data.options) return data as EncounterResponse;
    return null;
  } catch {
    return null;
  }
}
