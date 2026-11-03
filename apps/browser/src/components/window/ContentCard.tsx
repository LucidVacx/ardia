import { useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { startChromeTabs } from "../../state/tabs/chromeTabs";
import { useIsSmallWindow, useSplitOf } from "../../state/windows/card";
import { usePeeks } from "../../state/peek/hooks";
import { useActiveTabId, useSettings, useWindowId } from "../../state/browser/hooks";
import { useBookmarksBarHeight } from "../bookmarks/barSize";
import { useBookmarksBarMode } from "../../state/bookmarks/hooks";
import { POPOVER_MARGIN } from "../ui";
import { NO_TOOLBAR, SIDE_PANE_GAP, sidePaneMax, sidePaneWidth, toolbarGeometry, type Rect, type ToolbarGeometry } from "./geometry";
import { useShownSideTab } from "../../state/side/hooks";
import { forgetSidePaneFocus } from "../../state/side/focus";
import { SideDivider } from "../side/SideDivider";
import { startPermissionPrompts } from "../../state/site/permissions";
import { useFullscreenTab } from "../../state/tabs/pageState";
import { DropTargets, SplitDividers, SplitToast } from "../split/SplitChrome";
import { dockMoving, usePeekEdge, whenDockStill } from "../../state/windows/dockMotion";
import { FrozenPage } from "./FrozenPage";
import { setCardAnchor, setUrlAnchor, sideUrlAnchorKey, useAddressBarInSidebar, useTabLayout, watchToolbarExtensionsWidth } from "../../state/windows/layout";
import { startSelectionTools } from "../../state/site/selection";
import { startMedia } from "../../state/media/pip";
import { urlFieldRight } from "../toolbar/Toolbar";
import { WindowToolbar } from "../toolbar/WindowToolbar";
import { useToolbarRow } from "../toolbar/useToolbarRow";
import "../dev/devExpose";
import { PeekOverlay } from "../peek/PeekOverlay";
import { dismissPeek, startPeeks } from "../../state/peek/actions";
import { usePaneLayout } from "./usePaneLayout";
import { cardChrome } from "./paneChrome";
import { TabPane } from "./TabPane";
import { BesidePeekPopovers, PeekPage } from "./PageOverlays";
import { splitTabIdsOf } from "../../state/splits/splits";

export function ContentCard() {
  const windowId = useWindowId();
  const activeId = useActiveTabId();
  const split = useSplitOf(activeId);
  const fullscreenTab = useFullscreenTab(windowId);
  const tabLayout = useTabLayout();
  const addressInSidebar = useAddressBarInSidebar();
  const small = useIsSmallWindow(windowId);
  const hideWhileScrolling = useSettings((st) => st.hideToolbarWhileScrolling);
  const showSidebarButton = useSettings((st) => st.showSidebarButton !== false);
  const barMode = useBookmarksBarMode(windowId);
  const toolbarRow = useToolbarRow();
  const barHeight = useBookmarksBarHeight();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const container = useRef<View>(null);
  useEffect(startPermissionPrompts, []);
  useEffect(startChromeTabs, []);
  useEffect(startMedia, []);
  useEffect(startSelectionTools, []);
  useEffect(startPeeks, []);
  const peekId = usePeeks((p) => p[windowId]?.tabId);
  const peekFullscreen = !!peekId && fullscreenTab === peekId;
  useEffect(() => {
    if (fullscreenTab && peekId && !peekFullscreen) dismissPeek(windowId);
  }, [fullscreenTab, peekId, peekFullscreen, windowId]);

  const shownSide = useShownSideTab(windowId);
  const savedSideWidth = useSettings((st) => st.sidePaneWidth);
  const [liveSideWidth, setLiveSideWidth] = useState<number | null>(null);
  const sideWidth = liveSideWidth ?? sidePaneWidth(savedSideWidth, size.width, split);
  const sideId = shownSide && shownSide !== activeId && !fullscreenTab && !small && sideWidth > 0 ? shownSide : undefined;
  const side = sideId ? { tabId: sideId, width: sideWidth } : undefined;
  const mainWidth = side ? size.width - side.width - SIDE_PANE_GAP : size.width;

  const { mountedIds, panes, dividers, warmPanes, shown, lingerId, lingerRect } = usePaneLayout(windowId, activeId, split, fullscreenTab, size, side);
  const mainPanes = useMemo(() => (sideId ? Object.fromEntries(Object.entries(panes).filter(([id]) => id !== sideId)) : panes), [panes, sideId]);

  useEffect(() => {
    if (!sideId) forgetSidePaneFocus(windowId);
  }, [sideId, shownSide, windowId]);

  const chrome = useMemo(
    () => cardChrome({ addressInSidebar, small, split: !!split || !!sideId, fullscreen: !!fullscreenTab, hideWhileScrolling }),
    [addressInSidebar, small, !!split, !!sideId, !!fullscreenTab, hideWhileScrolling],
  );
  const sideChrome = useMemo(
    () => cardChrome({ addressInSidebar: false, small, split: true, fullscreen: false, hideWhileScrolling: hideWhileScrolling && !addressInSidebar }),
    [small, hideWhileScrolling, addressInSidebar],
  );
  const geometryFor = (rect: Rect | undefined, sidePane = false): ToolbarGeometry => {
    if ((sidePane ? sideChrome : chrome).kind === "none") return NO_TOOLBAR;
    const leading = !!rect && rect.x === 0 && rect.y === 0;
    return toolbarGeometry({ sidebarButton: leading && tabLayout === "sidebar" && showSidebarButton });
  };

  const anchorUrlField = (key: string, rect: Rect, g: ToolbarGeometry, inSplit: boolean) =>
    watchToolbarExtensionsWidth(windowId, (extensionsWidth = 0) =>
      setUrlAnchor(key, {
        left: origin!.x + rect.x + g.urlLeft,
        top: origin!.y + rect.y,
        width: rect.width - g.urlLeft - urlFieldRight(inSplit, extensionsWidth, toolbarRow),
      }),
    );

  const focusedRect = activeId ? panes[activeId] : undefined;
  useEffect(() => {
    if (!origin || !focusedRect || chrome.kind === "none") return;
    return anchorUrlField(windowId, focusedRect, geometryFor(focusedRect), !!split);
  }, [origin, focusedRect?.x, focusedRect?.y, focusedRect?.width, tabLayout, chrome.kind, !!split, showSidebarButton, toolbarRow]);

  const sideRect = sideId ? panes[sideId] : undefined;
  useEffect(() => {
    if (!origin || !sideRect || sideChrome.kind === "none") return;
    return anchorUrlField(sideUrlAnchorKey(windowId), sideRect, geometryFor(sideRect, true), false);
  }, [origin, sideRect?.x, sideRect?.y, sideRect?.width, sideChrome.kind, toolbarRow]);

  useEffect(() => {
    if (origin && size.width > 0) setCardAnchor(windowId, { left: origin.x, top: origin.y, width: size.width, height: size.height });
  }, [origin, size.width, size.height, windowId]);

  const settled = useRef<{ width: number; height: number } | null>(null);
  const measure = (width: number, height: number) => {
    setSize({ width, height });
    container.current?.measureInWindow((x, y) => setOrigin({ x, y }));
  };
  useEffect(
    () =>
      whenDockStill(windowId, () => {
        if (!settled.current) return;
        const { width, height } = settled.current;
        settled.current = null;
        measure(width, height);
      }),
    [windowId],
  );

  const peekEdge = usePeekEdge(windowId);
  const activeRect = activeId ? panes[activeId] : undefined;
  const popoversOverCard = peekEdge !== undefined && addressInSidebar && !small && !fullscreenTab && origin && activeRect ? activeId : undefined;

  return (
    <View
      ref={container}
      style={{ flex: 1 }}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (size.width > 0 && dockMoving(windowId) && !split) settled.current = { width, height };
        else measure(width, height);
      }}
    >
      {size.width > 0 &&
        shown.map((key) => {
          const tabId = key.slice(0, key.indexOf("|"));
          const rect = panes[tabId] ?? (tabId === lingerId ? lingerRect : undefined);
          return (
            <TabPane
              key={key}
              tabId={tabId}
              windowId={windowId}
              rect={rect}
              fills={!!rect && rect.x === 0 && rect.y === 0 && rect.width === size.width && rect.height === size.height}
              fullWidth={size.width}
              fullHeight={size.height}
              focused={tabId === activeId}
              side={tabId === sideId}
              inActiveSplit={!!splitTabIdsOf(split)?.includes(tabId)}
              fullscreen={tabId === fullscreenTab}
              covered={!!fullscreenTab && tabId !== fullscreenTab}
              geometry={geometryFor(rect, tabId === sideId)}
              chrome={tabId === sideId ? sideChrome : chrome}
              small={small}
              mounted={mountedIds.has(tabId)}
              warm={warmPanes[tabId]}
              barMode={barMode}
              popovers={tabId !== popoversOverCard}
              peekShown={!!peekId}
              lingering={tabId === lingerId}
              seeThrough={!!lingerId && tabId === activeId}
            />
          );
        })}
      {size.width > 0 && chrome.kind === "window" && activeId && panes[activeId] && (
        <WindowToolbar windowId={windowId} tabId={activeId} geometry={geometryFor(panes[activeId])} autoHide={chrome.autoHide} />
      )}
      {size.width > 0 && !split && !sideId && !fullscreenTab && (
        <FrozenPage windowId={windowId} tabId={activeId} top={(chrome.kind !== "none" && !chrome.autoHide ? toolbarRow.height : 0) + (barMode === "always" && !small && !hideWhileScrolling ? barHeight : 0)} />
      )}
      {split && !fullscreenTab && <SplitDividers split={split} dividers={dividers} width={mainWidth} height={size.height} />}
      {side && <SideDivider x={mainWidth} height={size.height} width={side.width} max={sidePaneMax(size.width, split)} onLive={setLiveSideWidth} />}
      {size.width > 0 && popoversOverCard && origin && activeRect && peekEdge !== undefined && (
        <BesidePeekPopovers
          tabId={popoversOverCard}
          left={Math.max(activeRect.x, peekEdge - origin.x) + POPOVER_MARGIN}
          top={activeRect.y + POPOVER_MARGIN}
          room={size.width}
        />
      )}
      {!fullscreenTab && <DropTargets panes={mainPanes} origin={origin} />}
      {(!fullscreenTab || peekFullscreen) && !small && (
        <PeekOverlay
          windowId={windowId}
          width={size.width}
          height={size.height}
          origin={origin}
          fullscreen={peekFullscreen}
          page={(tabId, sourceId, width) => <PeekPage tabId={tabId} sourceId={sourceId} windowId={windowId} width={width} fullscreen={peekFullscreen} />}
        />
      )}
      <SplitToast windowId={windowId} />
    </View>
  );
}
