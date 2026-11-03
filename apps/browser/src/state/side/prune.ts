import type { BrowserState } from "../browser/store";
import type { BrowserWindow, SideRail } from "../browser/types";
import { splitTabIds } from "../splits/splits";
import { isFields, isString, isStringList } from "../../lib/decode";

export function prunedSide(side: SideRail, keep: (tabId: string) => boolean): SideRail | undefined {
  const tabIds = side.tabIds.filter(keep);
  if (!tabIds.length && !side.profileId) return undefined;
  const shown = Object.fromEntries(Object.entries(side.shown ?? {}).filter(([, id]) => keep(id)));
  return { ...side, tabIds, shown };
}

export const savedSideTabIds = (w: BrowserWindow): string[] => (isStringList(w.side?.tabIds) ? w.side.tabIds : []);

export function settledSide(s: Pick<BrowserState, "tabs" | "groups" | "splits" | "profiles">, w: BrowserWindow): SideRail | undefined {
  if (!w.side || !isStringList(w.side.tabIds)) return undefined;
  const active = new Set(Object.values(w.activeTabIds));
  const grouped = new Set(Object.values(s.groups).flatMap((g) => g.tabIds));
  const split = new Set(Object.values(s.splits).flatMap(splitTabIds));
  const shown = isFields(w.side.shown) ? Object.fromEntries(Object.entries(w.side.shown).filter(([, id]) => isString(id))) : {};
  const side = prunedSide(
    { ...w.side, shown: shown as Record<string, string> },
    (id) => w.tabIds.includes(id) && s.tabs[id]?.windowId === w.id && !s.tabs[id].pin && !grouped.has(id) && !split.has(id) && !active.has(id),
  );
  if (!side?.profileId || (isString(side.profileId) && s.profiles[side.profileId])) return side;
  const { profileId: _, ...rest } = side;
  return rest.tabIds.length ? rest : undefined;
}

const dockedTabsMoved = (s: BrowserState, prev: BrowserState) =>
  s.tabs !== prev.tabs &&
  Object.values(s.windows).some((w) =>
    w.side?.tabIds.some((id) => {
      const now = s.tabs[id];
      const was = prev.tabs[id];
      return now !== was && (!now || !was || now.pin !== was.pin || now.windowId !== was.windowId || now.profileId !== was.profileId);
    }),
  );

const sameSide = (a: SideRail | undefined, b: SideRail | undefined) =>
  a === b ||
  (!!a && !!b && a.profileId === b.profileId && a.tabIds.join() === b.tabIds.join() && JSON.stringify(a.shown ?? {}) === JSON.stringify(b.shown ?? {}));

export function settleSides(s: BrowserState, prev: BrowserState): Pick<BrowserState, "windows"> | null {
  if (s.settings.sidePane === false) return null;
  const turnedOn = prev.settings.sidePane === false;
  if (!turnedOn && s.windows === prev.windows && s.groups === prev.groups && s.splits === prev.splits && !dockedTabsMoved(s, prev)) return null;
  let windows: BrowserState["windows"] | null = null;
  for (const w of Object.values(s.windows)) {
    if (!w.side) continue;
    const side = settledSide(s, w);
    if (sameSide(side, w.side)) continue;
    windows ??= { ...s.windows };
    windows[w.id] = { ...w, side };
  }
  return windows ? { windows } : null;
}
