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
  context?: string | null;
}

export interface EncounterResponse {
  source: "model" | "template";
  event_id: string;
  title: string;
  body: string;
  options: { option_id: string; option_text: string }[];
}

function accessCode(): string {
  try {
    return typeof localStorage !== "undefined" ? localStorage.getItem("qingyun_access_code") || "" : "";
  } catch {
    return "";
  }
}

export async function generateEncounter(
  body: EncounterRequestBody,
): Promise<EncounterResponse | null> {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const code = accessCode();
    if (code) headers["x-access-code"] = code;
    const resp = await fetch("/api/v1/encounter/generate", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(4000),
    });
    const data = await resp.json();
    if (resp.ok && data && data.options) return data as EncounterResponse;
    return null;
  } catch {
    return null;
  }
}
