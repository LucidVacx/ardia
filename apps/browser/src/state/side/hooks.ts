import { useShallow } from "zustand/react/shallow";
import { useBrowser } from "../browser/store";
import { shownSideTab, sideProfileOf, sideTabsOf } from "./side";

export const useShownSideTab = (windowId: string) => useBrowser((s) => shownSideTab(s, windowId));
export const useSideTabs = (windowId: string) => useBrowser(useShallow((s) => sideTabsOf(s, windowId)));
export const useSideProfile = (windowId: string) => useBrowser((s) => sideProfileOf(s.windows[windowId]));
export const useSideRailProfiles = () => useBrowser(useShallow((s) => s.profileOrder.filter((id) => s.profiles[id])));
export const useSideRailOn = (windowId: string) => useBrowser((s) => s.settings.sidePane !== false && s.windows[windowId]?.kind === "main");
