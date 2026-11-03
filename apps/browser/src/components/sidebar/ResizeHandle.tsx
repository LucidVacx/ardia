import { View } from "react-native";
import { currentSettings } from "../../state/browser/current";
import { updateSettings } from "../../state/settings/actions";
import { useResizeDrag } from "./useResizeDrag";
import { setSidebarUi, sidebarUi } from "../../state/sidebar/sidebarUi";
import { SIDEBAR_MAX_WIDTH, SIDEBAR_MIN_WIDTH } from "./tokens";
import { SIDEBAR_COMPACT_SNAP, SIDEBAR_COMPACT_WIDTH, savedSidebarWidth } from "../../state/sidebar/compact";

export function ResizeHandle({ windowId }: { windowId: string }) {
  const handlers = useResizeDrag({
    min: SIDEBAR_COMPACT_WIDTH,
    max: SIDEBAR_MAX_WIDTH,
    direction: 1,
    saved: () => savedSidebarWidth(currentSettings()),
    onLive: (w) => {
      const { [windowId]: _, ...rest } = sidebarUi().dragWidth;
      setSidebarUi({ dragWidth: w === null ? rest : { ...rest, [windowId]: Math.round(w * 2) / 2 } });
    },
    onCommit: (w) => updateSettings(w < SIDEBAR_COMPACT_SNAP ? { sidebarCompact: true } : { sidebarWidth: Math.max(w, SIDEBAR_MIN_WIDTH), sidebarCompact: false }),
  });
  return (
    <View
      {...handlers}
      onDoubleClick={() => updateSettings({ sidebarWidth: 190, sidebarCompact: false })}
      style={{ position: "absolute", top: 46, bottom: 0, right: 0, width: 4, cursor: "col-resize" }}
    />
  );
}
