import type { SearchScope } from "@ardia/core";
import { useBrowser } from "../browser/store";
import { activeTabId } from "../browser/model";
import { shownSideTab } from "../side/side";
import { expectFocus, heroBarFocus } from "../focus/focusClaims";
import { webviews } from "../../platform/webviews";

export type BarSnapshot = {
  typed: string;
  edited: boolean;
  selection: { start: number; end: number };
  selected: number;
  scope: SearchScope | null;
  scopeFrom: string;
};

const ntpQueries = new Map<string, BarSnapshot>();

export const savedNtpQuery = (tabId: string) => ntpQueries.get(tabId) ?? null;

export function saveNtpQuery(tabId: string, snapshot: BarSnapshot | null) {
  if (snapshot?.typed || snapshot?.scope) ntpQueries.set(tabId, snapshot);
  else ntpQueries.delete(tabId);
}

const heroBars = new Map<string, { windowId: string; focus: () => void }>();

export function registerHeroBar(windowId: string, tabId: string, focus: () => void): () => void {
  const bar = { windowId, focus };
  heroBars.set(tabId, bar);
  return () => {
    if (heroBars.get(tabId) === bar) heroBars.delete(tabId);
  };
}

export function focusHeroBar(windowId: string, tabId: string | undefined): boolean {
  const bar = tabId ? heroBars.get(tabId) : undefined;
  if (!tabId || !bar || bar.windowId !== windowId) return false;
  expectFocus(windowId, heroBarFocus(tabId));
  bar.focus();
  return true;
}

export type BarDismissal = "escape" | "closeKey";

export function closePanelToHeroBar(windowId: string, tabId: string, reason?: BarDismissal) {
  useBrowser.getState().closePanel(windowId);
  const now = useBrowser.getState();
  if (activeTabId(now, windowId) !== tabId && shownSideTab(now, windowId) !== tabId) return;
  if (!now.tabs[tabId]?.url) focusHeroBar(windowId, tabId);
  else if (reason && now.tabs[tabId]?.windowId === windowId) void webviews.get(tabId)?.focus();
}
