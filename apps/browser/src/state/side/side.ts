import type { StateCreator } from "zustand";
import { hostOf } from "@ardia/core";
import type { BrowserState } from "../browser/store";
import type { BrowserWindow, SideRail } from "../browser/types";
import { activeTabId, dockedTabIds, inPinnedContainer, isIncognitoProfile } from "../browser/model";
import { activated, apply, removeTabs, withNewTab } from "../tabs/tabs";
import { removeFromSplits } from "../splits/splits";
import { leaveGroups } from "../groups/groups";

export type SideSlice = {
  dockToSide(tabId: string): void;
  undockFromSide(tabId: string): void;
  toggleSideTab(windowId: string, tabId: string): void;
  setSideProfile(windowId: string, profileId: string): void;
  openSideTab(windowId: string, profileId: string): void;
};

export const sideProfileOf = (w: BrowserWindow | undefined) => w?.side?.profileId ?? w?.profileId ?? "";

export function shownSideTab(s: BrowserState, windowId: string): string | undefined {
  const w = s.windows[windowId];
  if (s.settings.sidePane === false) return undefined;
  const id = w?.side?.shown?.[sideProfileOf(w)];
  return id && w?.side?.tabIds.includes(id) && s.tabs[id]?.windowId === windowId ? id : undefined;
}

export function sideTabsOf(s: BrowserState, windowId: string): string[] {
  const w = s.windows[windowId];
  const profileId = sideProfileOf(w);
  return (w?.side?.tabIds ?? []).filter((id) => s.tabs[id]?.profileId === profileId);
}

export function railKeptSites(s: Pick<BrowserState, "settings" | "windows" | "tabs">): string[] {
  const sites = new Set<string>();
  for (const w of Object.values(s.windows)) {
    if (w.kind !== "main") continue;
    for (const id of dockedTabIds(s, w)) {
      const url = s.tabs[id]?.url ?? "";
      const host = /^https?:\/\//i.test(url) ? hostOf(url) : "";
      if (host) sites.add(host);
    }
  }
  return [...sites].sort();
}

const withSide = (s: BrowserState, windowId: string, side: SideRail | undefined): BrowserState => {
  const w = s.windows[windowId];
  return w ? { ...s, windows: { ...s.windows, [windowId]: { ...w, side } } } : s;
};

export function shownInSide(s: BrowserState, tabId: string): BrowserState {
  const t = s.tabs[tabId]!;
  const side = s.windows[t.windowId]!.side!;
  return withSide(s, t.windowId, {
    ...side,
    profileId: t.profileId,
    shown: { ...side.shown, [t.profileId]: tabId },
  });
}

function handOffMain(s: BrowserState, tabId: string): BrowserState {
  const t = s.tabs[tabId]!;
  const w = s.windows[t.windowId]!;
  if (w.activeTabIds[t.profileId] !== tabId) return s;
  let next = activeTabId(removeTabs(s, [tabId], false), w.id, t.profileId);
  let out = s;
  if (!next)
    [out, next] = withNewTab(s, w.id, {
      profileId: t.profileId,
      background: true,
    });
  const win = out.windows[w.id]!;
  out = {
    ...out,
    windows: {
      ...out.windows,
      [w.id]: {
        ...win,
        activeTabIds: { ...win.activeTabIds, [t.profileId]: next },
      },
    },
  };
  return t.profileId === w.profileId ? apply(out, activated(out, next)) : out;
}

export const createSideSlice: StateCreator<BrowserState, [], [], SideSlice> = (set, get) => ({
  dockToSide(tabId) {
    const s = get();
    const t = s.tabs[tabId];
    const w = t && s.windows[t.windowId];
    if (!t || !w || w.kind !== "main" || inPinnedContainer(s, tabId) || w.side?.tabIds.includes(tabId)) return;
    const alone = new Set([tabId]);
    const next = handOffMain(
      {
        ...s,
        splits: removeFromSplits(s.splits, alone),
        groups: leaveGroups(s.groups, alone),
      },
      tabId,
    );
    const win = next.windows[w.id]!;
    set({
      ...next,
      windows: {
        ...next.windows,
        [w.id]: {
          ...win,
          tabIds: [...win.tabIds.filter((id) => id !== tabId), tabId],
          side: {
            tabIds: [...(win.side?.tabIds ?? []), tabId],
            profileId: t.profileId,
            shown: { ...win.side?.shown, [t.profileId]: tabId },
          },
        },
      },
    });
  },

  undockFromSide(tabId) {
    const s = get();
    const t = s.tabs[tabId];
    const side = t && s.windows[t.windowId]?.side;
    if (!t || !side?.tabIds.includes(tabId)) return;
    const tabIds = side.tabIds.filter((id) => id !== tabId);
    const shown = Object.fromEntries(Object.entries(side.shown ?? {}).filter(([, id]) => id !== tabId));
    set(withSide(s, t.windowId, tabIds.length ? { ...side, tabIds, shown } : undefined));
    get().activate(tabId);
  },

  toggleSideTab(windowId, tabId) {
    const s = get();
    const side = s.windows[windowId]?.side;
    const t = s.tabs[tabId];
    if (!side || !t || !side.tabIds.includes(tabId)) return;
    const shown = { ...side.shown };
    if (shown[t.profileId] === tabId) delete shown[t.profileId];
    else shown[t.profileId] = tabId;
    set(withSide(s, windowId, { ...side, profileId: t.profileId, shown }));
  },

  setSideProfile(windowId, profileId) {
    const s = get();
    const w = s.windows[windowId];
    if (!w || !s.profiles[profileId] || isIncognitoProfile(profileId)) return;
    set(
      withSide(s, windowId, {
        tabIds: w.side?.tabIds ?? [],
        ...w.side,
        profileId,
      }),
    );
  },

  openSideTab(windowId, profileId) {
    const s = get();
    const w = s.windows[windowId];
    if (!w || w.kind !== "main" || !s.profiles[profileId]) return;
    const hadActive = !!w.activeTabIds[profileId];
    let [next, tabId] = withNewTab(s, windowId, {
      profileId,
      background: true,
    });
    if (!tabId) return;
    const win = next.windows[windowId]!;
    const activeTabIds = { ...win.activeTabIds };
    if (!hadActive) delete activeTabIds[profileId];
    const side = win.side;
    next = {
      ...next,
      windows: {
        ...next.windows,
        [windowId]: {
          ...win,
          activeTabIds,
          side: {
            tabIds: [...(side?.tabIds ?? []), tabId],
            profileId,
            shown: { ...side?.shown, [profileId]: tabId },
          },
        },
      },
    };
    set(next);
  },
});
