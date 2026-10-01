export type CopyMode = "ai" | "template";
export type Theme = "light" | "dark" | "system";

const COPY_MODE_KEY = "qingyun_copy_mode";
const THEME_KEY = "qingyun_theme";
const REDUCE_MOTION_KEY = "qingyun_reduce_motion";

function read(key: string): string | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function getCopyMode(): CopyMode {
  return read(COPY_MODE_KEY) === "template" ? "template" : "ai";
}

export function setCopyMode(mode: CopyMode): void {
  write(COPY_MODE_KEY, mode);
}

export function getTheme(): Theme {
  const v = read(THEME_KEY);
  return v === "dark" || v === "light" || v === "system" ? v : "dark";
}

export function setTheme(theme: Theme): void {
  write(THEME_KEY, theme);
}

export function getReduceMotion(): boolean {
  return read(REDUCE_MOTION_KEY) === "1";
}

export function setReduceMotion(on: boolean): void {
  write(REDUCE_MOTION_KEY, on ? "1" : "0");
}
