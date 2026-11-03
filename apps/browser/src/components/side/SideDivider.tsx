import { View } from "react-native";
import { updateSettings } from "../../state/settings/actions";
import { useResizeDrag } from "../sidebar/useResizeDrag";
import { SIDE_PANE_GAP, SIDE_PANE_MIN } from "../window/geometry";
import { SIDE_PANE_DEFAULT, SIDE_PANE_MAX } from "./tokens";

export function SideDivider({
  x,
  height,
  width,
  max,
  onLive,
}: {
  x: number;
  height: number;
  width: number;
  max: number;
  onLive: (width: number | null) => void;
}) {
  const handlers = useResizeDrag({
    min: SIDE_PANE_MIN,
    max: Math.min(SIDE_PANE_MAX, max),
    direction: -1,
    saved: () => width,
    onLive,
    onCommit: (w) => updateSettings({ sidePaneWidth: Math.round(w) }),
  });
  return (
    <View
      {...handlers}
      onDoubleClick={() => updateSettings({ sidePaneWidth: SIDE_PANE_DEFAULT })}
      style={{
        position: "absolute",
        left: x - 2,
        top: 0,
        width: SIDE_PANE_GAP + 4,
        height,
        cursor: "col-resize",
      }}
    />
  );
}
