import { showMenu } from "../../platform/menus";
import { closeTab } from "../browser/actions";
import { useBrowser } from "../browser/store";
import { sideProfileOf } from "./side";

const store = () => useBrowser.getState();

export async function openSideTabMenu(tabId: string) {
  const choice = await showMenu([
    { id: "sidebar", title: "Move to Sidebar", symbol: "sidebar.left" },
    { id: "close", title: "Close Tab", symbol: "xmark" },
  ]);
  if (choice === "sidebar") store().undockFromSide(tabId);
  else if (choice === "close") void closeTab(tabId);
}

export async function openSideProfileMenu(windowId: string) {
  const s = store();
  const current = sideProfileOf(s.windows[windowId]);
  const choice = await showMenu(
    s.profileOrder.filter((id) => s.profiles[id]).map((id) => ({ id, title: s.profiles[id]!.name, symbol: "person.crop.circle", checked: id === current })),
  );
  if (choice) store().setSideProfile(windowId, choice);
}
