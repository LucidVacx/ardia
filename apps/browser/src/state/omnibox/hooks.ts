import { useBrowser } from "../browser/store";
import { activeTabId } from "../browser/model";
import { shownSideTab } from "../side/side";
import { useStoreWhile } from "../tabs/tabWatch";
import { commandBarCentred } from "../windows/layout";

export const useActiveTabIdWhile = (windowId: string, live: boolean): string | undefined =>
  useBrowser((s) => (live ? activeTabId(s, windowId) : undefined));

export const usePanelTabIdWhile = (windowId: string, tabId: string | undefined, live: boolean): string | undefined =>
  useBrowser((s) => (!live ? undefined : tabId && tabId === shownSideTab(s, windowId) ? tabId : activeTabId(s, windowId)));

export const useTabHasUrlWhile = (tabId: string | undefined, live: boolean): boolean =>
  useStoreWhile(useBrowser, live, (s) => !!(tabId && s.tabs[tabId]?.url));

export const useCommandBarCentred = (windowId: string, live: boolean): boolean => useBrowser((s) => live && commandBarCentred(s, windowId));
