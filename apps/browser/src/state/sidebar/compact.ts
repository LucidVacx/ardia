import { DEFAULT_SIDEBAR_WIDTH } from "../../lib/windowLayout";
import type { Settings } from "../settings/settings";

export const SIDEBAR_COMPACT_WIDTH = 80;
export const SIDEBAR_COMPACT_SNAP = 120;

export const savedSidebarWidth = (st: Pick<Settings, "sidebarWidth" | "sidebarCompact">) =>
  st.sidebarCompact ? SIDEBAR_COMPACT_WIDTH : (st.sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH);
