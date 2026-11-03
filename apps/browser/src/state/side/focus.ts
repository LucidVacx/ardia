import { useBrowser, type BrowserState } from "../browser/store";
import { activeTabId } from "../browser/model";
import { focusHeroBar } from "../omnibox/barState";
import { webviews } from "../../platform/webviews";
import { shownSideTab } from "./side";

const FOCUS_AFTER_SHOW_MS = 50;

const focusedSide = new Map<string, { side: string; main: string | undefined }>();

export function notePaneFocus(tabId: string) {
  const s = useBrowser.getState();
  const windowId = s.tabs[tabId]?.windowId;
  if (!windowId) return;
  if (shownSideTab(s, windowId) === tabId) focusedSide.set(windowId, { side: tabId, main: activeTabId(s, windowId) });
  else focusedSide.delete(windowId);
}

function focusSidePage(windowId: string, tabId: string) {
  const s = useBrowser.getState();
  if (shownSideTab(s, windowId) !== tabId) return;
  if (s.tabs[tabId]?.url) void webviews.get(tabId)?.focus();
  else focusHeroBar(windowId, tabId);
}

export function focusSidePane(windowId: string) {
  const s = useBrowser.getState();
  const id = shownSideTab(s, windowId);
  if (!id) return;
  focusedSide.set(windowId, { side: id, main: activeTabId(s, windowId) });
  setTimeout(() => focusSidePage(windowId, id), FOCUS_AFTER_SHOW_MS);
}

export const forgetSidePaneFocus = (windowId: string) => void focusedSide.delete(windowId);

export function focusedSideTab(s: BrowserState, windowId: string): string | undefined {
  const focus = focusedSide.get(windowId);
  return focus && focus.side === shownSideTab(s, windowId) && focus.main === activeTabId(s, windowId) ? focus.side : undefined;
}
