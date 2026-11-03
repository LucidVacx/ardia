import { isKeepActiveSiteValid, setMemorySaver, type MemorySaverMode } from "../../platform/performance";
import { useBrowser } from "../browser/store";
import type { Settings } from "../settings/settings";
import { railKeptSites } from "../side/side";

type MemorySaverSettings = Pick<Settings, "memorySaver" | "memorySaverMode" | "keepActiveSites">;

export type { MemorySaverMode };

const MODES: readonly MemorySaverMode[] = ["moderate", "balanced", "maximum"];

const store = () => useBrowser.getState();

export function memorySaverRequest(settings: MemorySaverSettings, railSites: string[] = []) {
  const kept = Array.isArray(settings.keepActiveSites) ? settings.keepActiveSites.filter((site) => typeof site === "string") : [];
  return {
    state: settings.memorySaver === false ? ("off" as const) : ("on" as const),
    aggressiveness: MODES.includes(settings.memorySaverMode) ? settings.memorySaverMode : ("balanced" as const),
    sites: [...kept, ...railSites.filter((site) => !kept.includes(site))],
  };
}

const changed = (a: MemorySaverSettings, b: MemorySaverSettings) =>
  a.memorySaver !== b.memorySaver || a.memorySaverMode !== b.memorySaverMode || a.keepActiveSites !== b.keepActiveSites;

let started = false;

export function startMemorySaver() {
  if (started) return;
  started = true;
  let railSites = railKeptSites(useBrowser.getState());
  const push = () => void setMemorySaver(memorySaverRequest(useBrowser.getState().settings, railSites)).catch(() => {});
  push();
  useBrowser.subscribe((s, prev) => {
    const railMayDiffer = s.windows !== prev.windows || s.tabs !== prev.tabs || s.settings.sidePane !== prev.settings.sidePane;
    const nextRail = railMayDiffer ? railKeptSites(s) : railSites;
    const railChanged = nextRail.join("\n") !== railSites.join("\n");
    railSites = nextRail;
    if (railChanged || changed(s.settings, prev.settings)) push();
  });
}

export function keepActiveSiteOf(typed: string): string {
  const [, scheme = "", host = "", rest = ""] = /^([a-z][\w+.-]*:\/\/)?([^/?#]*)(.*)$/is.exec(typed.trim()) ?? [];
  return `${scheme.toLowerCase()}${host.toLowerCase()}${rest === "/" ? "" : rest}`;
}

export async function keepSiteActive(typed: string): Promise<string | null> {
  const site = keepActiveSiteOf(typed);
  if (!site || /\s/.test(site) || !(await isKeepActiveSiteValid(site).catch(() => false))) return "Enter a site, like youtube.com.";
  const sites = store().settings.keepActiveSites;
  if (!sites.includes(site)) store().updateSettings({ keepActiveSites: [...sites, site] });
  return null;
}

export function stopKeepingSiteActive(site: string) {
  const sites = store().settings.keepActiveSites;
  if (sites.includes(site)) store().updateSettings({ keepActiveSites: sites.filter((s) => s !== site) });
}
