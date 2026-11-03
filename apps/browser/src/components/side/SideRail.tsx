import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Button, ContextMenuArea, radius, SwipeArea, type SwipeEvent, Symbol, Text, useHover, WindowDragRegion } from "../ui";
import { profileNameColor, useTheme } from "../ui/theme";
import { curve, duration } from "../ui/motion";
import { useProfile } from "../../state/browser/hooks";
import { ARC_LIGHTS_CENTER } from "../../state/windows/dockMotion";
import { useAddressBarInSidebar, useToolbarLightsCenter } from "../../state/windows/layout";
import { useTabValue, shallowEqual } from "../../state/tabs/tabWatch";
import { openSideTab, setSideProfile, toggleSideTab } from "../../state/side/actions";
import { useShownSideTab, useSideProfile, useSideRailProfiles, useSideTabs } from "../../state/side/hooks";
import { openSideProfileMenu, openSideTabMenu } from "../../state/side/menus";
import { focusSidePane } from "../../state/side/focus";
import { TabIcon } from "../sidebar/TabIcon";
import { iconSymbol } from "../../lib/customIcon";
import { useToolbarRow } from "../toolbar/useToolbarRow";
import type { Tab } from "../../state/browser/types";
import { SIDE_RAIL_COMMIT, SIDE_RAIL_FLICK, SIDE_RAIL_RUBBER, SIDE_RAIL_DOT, SIDE_RAIL_DOT_IDLE, SIDE_RAIL_DOT_SELECTED, SIDE_RAIL_DOTS_BOTTOM, SIDE_RAIL_DOTS_GAP, SIDE_RAIL_GAP, SIDE_RAIL_ICON, SIDE_RAIL_TOP, SIDE_RAIL_WIDTH } from "./tokens";

export function SideRail({ windowId, topTabs }: { windowId: string; topTabs: boolean }) {
  const tabIds = useSideTabs(windowId);
  const shown = useShownSideTab(windowId);
  const profileId = useSideProfile(windowId);
  const profiles = useSideRailProfiles();
  const at = profiles.indexOf(profileId);
  const slide = usePageSlide(at);
  const toolbarLights = useToolbarLightsCenter();
  const toolbarRow = useToolbarRow();
  const lightsY = (useAddressBarInSidebar() ? ARC_LIGHTS_CENTER : toolbarLights)[1];
  const dotsRoom = profiles.length > 1 ? SIDE_RAIL_DOTS_BOTTOM + profiles.length * (SIDE_RAIL_DOT * 2 + SIDE_RAIL_DOTS_GAP) : 0;
  const iconTop = topTabs ? (toolbarRow.height - SIDE_RAIL_ICON) / 2 : lightsY - SIDE_RAIL_ICON / 2;
  const onSwipe = (e: SwipeEvent) => {
    const next = profiles[at + (e.direction === "back" ? -1 : 1)];
    const sign = e.direction === "back" ? 1 : -1;
    if (e.phase === "swipe") {
      if (next) setSideProfile(windowId, next);
    } else if (e.phase === "changed") {
      slide.setValue(sign * Math.max(0, Math.min(e.distance, SIDE_RAIL_WIDTH)) * (next ? 1 : SIDE_RAIL_RUBBER));
    } else if (e.phase === "ended" && next && (e.distance > SIDE_RAIL_WIDTH * SIDE_RAIL_COMMIT || e.velocity > SIDE_RAIL_FLICK)) {
      setSideProfile(windowId, next);
    } else if (e.phase === "ended" || e.phase === "cancelled") {
      Animated.timing(slide, { toValue: 0, duration: duration.slide, easing: curve.outCubic, useNativeDriver: true }).start();
    }
  };
  return (
    <View style={{ width: SIDE_RAIL_WIDTH, height: "100%", overflow: "hidden" }}>
      {!topTabs && <WindowDragRegion style={{ position: "absolute", left: 0, right: 0, top: 0, height: SIDE_RAIL_TOP }} />}
      <Animated.View style={{ flex: 1, marginTop: iconTop, marginBottom: dotsRoom, alignItems: "center", gap: 6, transform: [{ translateX: slide }] }}>
        <SideRailProfile windowId={windowId} profileId={profileId} />
        <SideRailList count={tabIds.length + 1}>
          {tabIds.map((id) => (
            <SideRailIcon key={id} windowId={windowId} tabId={id} selected={id === shown} />
          ))}
          <Button variant="icon" icon="plus" tooltip="New Secondary Tab" onPress={() => {
            openSideTab(windowId, profileId);
            focusSidePane(windowId);
          }} />
        </SideRailList>
      </Animated.View>
      {profiles.length > 1 && (
        <View style={{ position: "absolute", left: 0, right: 0, bottom: SIDE_RAIL_DOTS_BOTTOM, alignItems: "center", gap: SIDE_RAIL_DOTS_GAP }}>
          {profiles.map((id) => (
            <SideRailDot key={id} windowId={windowId} profileId={id} selected={id === profileId} />
          ))}
        </View>
      )}
      {profiles.length > 1 && (
        <SwipeArea
          style={StyleSheet.absoluteFill}
          canSwipeBack={at > 0}
          canSwipeForward={at >= 0 && at < profiles.length - 1}
          tracksUnavailableDirections
          isPager
          onSwipe={onSwipe}
        />
      )}
    </View>
  );
}

function SideRailList({ count, children }: { count: number; children: ReactNode }) {
  const [room, setRoom] = useState(Infinity);
  const overflows = count * (SIDE_RAIL_ICON + SIDE_RAIL_GAP) > room;
  return (
    <View style={{ flex: 1, alignSelf: "stretch" }} onLayout={(e) => setRoom(e.nativeEvent.layout.height)}>
      {overflows ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ alignItems: "center", gap: SIDE_RAIL_GAP, paddingBottom: SIDE_RAIL_GAP }} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, alignItems: "center", gap: SIDE_RAIL_GAP }}>{children}</View>
      )}
    </View>
  );
}

function usePageSlide(at: number) {
  const slide = useRef(new Animated.Value(0)).current;
  const was = useRef(at);
  useEffect(() => {
    if (was.current === at) return;
    slide.setValue((at > was.current ? 1 : -1) * SIDE_RAIL_WIDTH);
    was.current = at;
    Animated.timing(slide, { toValue: 0, duration: duration.slide, easing: curve.outCubic, useNativeDriver: true }).start();
  }, [at]);
  return slide;
}

function SideRailProfile({ windowId, profileId }: { windowId: string; profileId: string }) {
  const theme = useTheme();
  const profile = useProfile(profileId, (p) => p);
  const { hovered, hoverProps } = useHover();
  if (!profile) return null;
  return (
    <View {...hoverProps} tooltip={`Secondary tab rail profile: ${profile.name}. Click to switch`}>
      <Pressable
        onPress={() => void openSideProfileMenu(windowId)}
        accessibilityLabel={`Secondary tab rail profile ${profile.name}, switch profile`}
        style={{ width: SIDE_RAIL_ICON, height: SIDE_RAIL_ICON, borderRadius: radius.l, alignItems: "center", justifyContent: "center", backgroundColor: hovered ? theme.rowHover : undefined }}
      >
        {iconSymbol(profile.icon) ? (
          <Symbol name={iconSymbol(profile.icon)!} size={14} weight="semibold" color={profileNameColor(profile, theme.dark)} style={{ width: 16, height: 16 }} />
        ) : (
          <Text size="heading" weight="semibold" style={{ color: profileNameColor(profile, theme.dark) }}>
            {profile.icon ?? (profile.name.trim()[0] ?? "?").toUpperCase()}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

function SideRailDot({ windowId, profileId, selected }: { windowId: string; profileId: string; selected: boolean }) {
  const theme = useTheme();
  const name = useProfile(profileId, (p) => p?.name ?? "");
  const { hovered, hoverProps } = useHover();
  return (
    <View {...hoverProps} tooltip={name}>
      <Pressable
        onPress={() => setSideProfile(windowId, profileId)}
        accessibilityRole="button"
        accessibilityLabel={`Secondary tab rail profile ${name}`}
        accessibilityState={{ selected }}
        style={{ width: SIDE_RAIL_WIDTH, height: SIDE_RAIL_DOT * 2, alignItems: "center", justifyContent: "center" }}
      >
        <View
          style={{
            width: SIDE_RAIL_DOT,
            height: SIDE_RAIL_DOT,
            borderRadius: SIDE_RAIL_DOT / 2,
            backgroundColor: theme.mark,
            opacity: selected || hovered ? SIDE_RAIL_DOT_SELECTED : SIDE_RAIL_DOT_IDLE,
          }}
        />
      </Pressable>
    </View>
  );
}

function SideRailIcon({ windowId, tabId, selected }: { windowId: string; tabId: string; selected: boolean }) {
  const theme = useTheme();
  const tab = useTabValue(tabId, railTab, shallowEqual);
  const { hovered, hoverProps } = useHover();
  return (
    <View {...hoverProps} tooltip={tab.title || tab.url}>
      <ContextMenuArea onContextMenu={() => void openSideTabMenu(tabId)}>
        <Pressable
          onPress={() => {
            toggleSideTab(windowId, tabId);
            focusSidePane(windowId);
          }}
          accessibilityLabel={tab.title || tab.url || "New Tab"}
          accessibilityState={{ selected }}
          style={{
            width: SIDE_RAIL_ICON,
            height: SIDE_RAIL_ICON,
            borderRadius: radius.l,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: selected ? theme.tabSelected : hovered ? theme.rowHover : undefined,
          }}
        >
          <TabIcon tabId={tabId} url={tab.url} favicon={tab.favicon} icon={tab.customIcon} profileId={tab.profileId} size={18} />
        </Pressable>
      </ContextMenuArea>
    </View>
  );
}

const railTab = (t: Tab | undefined) => ({ url: t?.url ?? "", title: t?.customTitle || t?.title || "", favicon: t?.favicon ?? null, customIcon: t?.customIcon ?? null, profileId: t?.profileId ?? "" });
