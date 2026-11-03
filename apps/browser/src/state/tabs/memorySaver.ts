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

const RAIL_SITES_SETTLE_MS = 1000;
const sameSites = (a: string[], b: string[]) => a.join("\n") === b.join("\n");

export function startMemorySaver() {
  if (started) return;
  started = true;
  let railSites = railKeptSites(useBrowser.getState());
  let railTimer: ReturnType<typeof setTimeout> | null = null;
  const push = () => void setMemorySaver(memorySaverRequest(useBrowser.getState().settings, railSites)).catch(() => {});
  const sendRailSites = () => {
    railTimer = null;
    const next = railKeptSites(useBrowser.getState());
    if (sameSites(next, railSites)) return;
    railSites = next;
    push();
  };
  push();
  useBrowser.subscribe((s, prev) => {
    if (changed(s.settings, prev.settings)) push();
    const touched = s.windows !== prev.windows || s.tabs !== prev.tabs || s.settings.sidePane !== prev.settings.sidePane;
    const railMayDiffer = touched && (railSites.length > 0 || Object.values(s.windows).some((w) => !!w.side?.tabIds.length));
    if (railMayDiffer && !railTimer && !sameSites(railKeptSites(s), railSites)) railTimer = setTimeout(sendRailSites, RAIL_SITES_SETTLE_MS);
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
