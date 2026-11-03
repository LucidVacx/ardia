import assert from "node:assert/strict";
import { test } from "node:test";
const { useBrowser } = await import("../browser/store.ts");
const { activeTabId, viewTabIds } = await import("../browser/model.ts");
const { shownSideTab, sideProfileOf, sideTabsOf } = await import("./side.ts");

const S = () => useBrowser.getState();
const PERSONAL = { id: "default", name: "Personal", color: "plum", icon: null, createdAt: 0 };
const reset = () => S().hydrate({ profiles: { default: PERSONAL }, profileOrder: ["default"] });
const side = (w) => S().windows[w].side;
const docked = (w) => side(w)?.tabIds ?? [];
const view = (w, p) => viewTabIds(S(), w, p);
const active = (w) => activeTabId(S(), w);
const sidePane = (on) => S().updateSettings({ sidePane: on });

function threeTabs() {
  reset();
  const w = S().createWindow({ url: "https://a.example/" });
  const [a] = S().windows[w].tabIds;
  const b = S().newTab(w, { url: "https://b.example/", background: true });
  const c = S().newTab(w, { url: "https://c.example/", background: true });
  S().activate(a);
  return { w, a, b, c };
}

function saved() {
  const { profiles, profileOrder, windows, tabs, groups, splits, settings } = S();
  return structuredClone({ profiles, profileOrder, windows, tabs, groups, splits, settings });
}

test("docking a background tab moves it to the rail and shows it there", () => {
  const { w, a, b } = threeTabs();
  S().dockToSide(b);
  assert.deepEqual(docked(w), [b]);
  assert.equal(view(w).includes(b), false);
  assert.equal(shownSideTab(S(), w), b);
  assert.equal(active(w), a);
});

test("undocking puts the tab back in the list and makes it active", () => {
  const { w, b } = threeTabs();
  S().dockToSide(b);
  S().undockFromSide(b);
  assert.equal(side(w), undefined);
  assert.ok(view(w).includes(b));
  assert.equal(active(w), b);
});

test("docking the active tab hands the main area to another tab", () => {
  const { w, a } = threeTabs();
  S().dockToSide(a);
  assert.deepEqual(docked(w), [a]);
  assert.notEqual(active(w), a);
  assert.ok(view(w).includes(active(w)));
});

test("docking the only tab opens a new main tab", () => {
  reset();
  const w = S().createWindow({ url: "https://a.example/" });
  const [a] = S().windows[w].tabIds;
  S().dockToSide(a);
  assert.deepEqual(docked(w), [a]);
  assert.equal(view(w).length, 1);
  assert.notEqual(active(w), a);
});

test("closing a docked tab removes it from the rail and keeps the main tab", () => {
  const { w, a, b } = threeTabs();
  S().dockToSide(b);
  S().closeTab(b);
  assert.equal(S().tabs[b], undefined);
  assert.equal(side(w), undefined);
  assert.equal(active(w), a);
});

test("closing the active tab never hands the main area to a docked tab", () => {
  const { w, a, b, c } = threeTabs();
  S().dockToSide(b);
  S().closeTab(a);
  assert.equal(active(w), c);
  assert.deepEqual(docked(w), [b]);
});

test("activating a docked tab shows it in the rail instead of the main area", () => {
  const { w, a, b, c } = threeTabs();
  S().dockToSide(b);
  S().dockToSide(c);
  S().activate(b);
  assert.equal(active(w), a);
  assert.equal(shownSideTab(S(), w), b);
  assert.deepEqual(docked(w), [b, c]);
});

test("docking a grouped tab takes it out of the group; pinned tabs stay put", () => {
  const { w, a, b, c } = threeTabs();
  const g = S().createGroup([b, c]);
  S().dockToSide(b);
  assert.deepEqual(docked(w), [b]);
  assert.equal(Object.values(S().groups).some((x) => x.tabIds.includes(b)), false);
  assert.equal(S().windows[w].tabIds.at(-1), b);
  assert.ok(g);
  S().togglePin(a);
  S().dockToSide(a);
  assert.equal(docked(w).includes(a), false);
});

test("a docked tab can't join a split", () => {
  const { w, a, b, c } = threeTabs();
  S().dockToSide(b);
  assert.equal(S().createSplit([a, b]), "");
  assert.deepEqual(S().openSplitPane(w, { tabId: b, anchorTabId: a }), { ok: false, reason: "invalid" });
  assert.deepEqual(S().openSplitPane(w, { url: "https://d.example/", anchorTabId: b }), { ok: false, reason: "invalid" });
  assert.deepEqual(Object.keys(S().splits), []);
  assert.ok(S().createSplit([a, c]));
  S().replaceSplitPane(c, b);
  assert.equal(Object.values(S().splits)[0].tabIds.includes(b), false);
});

test("a link opened from a docked tab never groups it with the new tab", () => {
  const { w, b } = threeTabs();
  S().updateSettings({ cmdClickCreatesTabGroup: true });
  S().dockToSide(b);
  S().newTab(w, { url: "https://d.example/", openerId: b, background: true });
  assert.equal(Object.values(S().groups).some((g) => g.tabIds.includes(b)), false);
  assert.deepEqual(docked(w), [b]);
});

test("a docked tab can't open a peek", () => {
  const { a, b } = threeTabs();
  S().dockToSide(b);
  assert.equal(S().openPeek(b, "https://d.example/"), "");
  assert.notEqual(S().openPeek(a, "https://d.example/"), "");
});

test("with the setting off, docked tabs are ordinary tabs", () => {
  const { w, a, b } = threeTabs();
  S().dockToSide(b);
  sidePane(false);
  assert.ok(view(w).includes(b));
  assert.equal(shownSideTab(S(), w), undefined);
  S().activate(b);
  assert.equal(active(w), b);
  assert.ok(S().createSplit([a, b]));
});

test("turning the setting back on drops tabs that became active, split or grouped from the rail", () => {
  const { w, a, b, c } = threeTabs();
  S().dockToSide(b);
  S().dockToSide(c);
  sidePane(false);
  S().activate(b);
  S().createGroup([c]);
  sidePane(true);
  assert.equal(active(w), b);
  assert.ok(view(w).includes(b));
  assert.ok(view(w).includes(c));
  assert.equal(side(w), undefined);
  assert.ok(a);
});

test("switching to a profile whose only tabs are docked opens a main tab for it", () => {
  const { w } = threeTabs();
  const work = S().createProfile({ name: "Work" });
  S().openSideTab(w, work);
  const [railTab] = sideTabsOf(S(), w);
  assert.ok(railTab);
  assert.equal(S().windows[w].activeTabIds[work], undefined);
  S().switchProfile(w, work);
  assert.notEqual(active(w), railTab);
  assert.equal(S().tabs[active(w)].profileId, work);
  assert.deepEqual(docked(w), [railTab]);
});

test("deleting the rail's profile hands the rail back to the window's profile", () => {
  const { w, b } = threeTabs();
  const work = S().createProfile({ name: "Work" });
  S().dockToSide(b);
  S().openSideTab(w, work);
  assert.equal(sideProfileOf(S().windows[w]), work);
  S().deleteProfile(work);
  assert.equal(side(w).profileId, undefined);
  assert.equal(sideProfileOf(S().windows[w]), "default");
  assert.deepEqual(sideTabsOf(S(), w), [b]);
});

test("deleting the shown profile never activates another profile's docked tab", () => {
  reset();
  const w = S().createWindow({ url: "https://a.example/" });
  const work = S().createProfile({ name: "Work" });
  S().openSideTab(w, work);
  const [railTab] = sideTabsOf(S(), w);
  assert.equal(S().windows[w].activeTabIds[work], undefined);
  S().deleteProfile("default");
  assert.notEqual(active(w), railTab);
  assert.equal(S().tabs[active(w)].profileId, work);
  assert.deepEqual(docked(w), [railTab]);
});

test("moving the last main tab out leaves the window a new main tab, not a docked one", () => {
  const { w, a, b, c } = threeTabs();
  S().dockToSide(b);
  S().dockToSide(c);
  const other = S().createWindow({ url: "https://z.example/" });
  S().moveTabsToWindow([a], other);
  const now = active(w);
  assert.ok(now && ![b, c].includes(now));
  assert.deepEqual(docked(w), [b, c]);
});

test("hydrate drops rail tabs that are active, split, grouped, pinned or of a deleted profile", () => {
  const { w, a, b, c } = threeTabs();
  const d = S().newTab(w, { url: "https://d.example/", background: true });
  const e = S().newTab(w, { url: "https://e.example/", background: true });
  const f = S().newTab(w, { url: "https://f.example/", background: true });
  const work = S().createProfile({ name: "Work" });
  S().openSideTab(w, work);
  const [workTab] = sideTabsOf(S(), w);
  const data = saved();
  const split = { id: "s1", windowId: w, tabIds: [c, d], orientation: "horizontal", sizes: [0.5, 0.5] };
  data.splits = { s1: split };
  data.groups = { g1: { id: "g1", windowId: w, profileId: "default", name: "", icon: null, color: null, collapsed: false, pinned: false, tabIds: [e], createdAt: 0 } };
  data.tabs[f].pinned = true;
  delete data.profiles[work];
  data.profileOrder = ["default"];
  data.windows[w].side = { tabIds: [a, b, c, e, f, workTab], profileId: work, shown: { default: c, [work]: workTab } };
  S().hydrate(data);
  assert.deepEqual(docked(w), [b]);
  assert.equal(side(w).profileId, undefined);
  assert.deepEqual(side(w).shown, {});
  assert.equal(active(w), a);
});

test("hydrate never makes a docked tab the active one", () => {
  reset();
  const w = S().createWindow({ url: "https://a.example/" });
  const [a] = S().windows[w].tabIds;
  const data = saved();
  data.windows[w].side = { tabIds: [a], profileId: "default", shown: { default: a } };
  data.windows[w].activeTabIds = {};
  S().hydrate(data);
  assert.equal(active(w), a);
  assert.equal(side(w), undefined);
});

test("with tabs shared across windows, a docked tab isn't mirrored into the other window's list", () => {
  reset();
  const a = S().createWindow({ url: "https://a1.example/" });
  const a2 = S().newTab(a, { url: "https://a2.example/", background: true });
  const b = S().createWindow({ url: "https://b1.example/" });
  S().updateSettings({ shareTabsAcrossWindows: true });
  S().dockToSide(a2);
  const urls = (w) => view(w).map((id) => S().tabs[id].url);
  assert.deepEqual(docked(a), [a2]);
  assert.equal(S().tabs[a2].windowId, a);
  assert.equal(urls(b).includes("https://a2.example/"), false);
  assert.equal(urls(a).includes("https://a2.example/"), false);
  S().updateSettings({ shareTabsAcrossWindows: false });
});

test("with tabs shared across windows, turning the rail off keeps the docked tab and shares it again", () => {
  reset();
  const a = S().createWindow({ url: "https://a1.example/" });
  const a2 = S().newTab(a, { url: "https://a2.example/", background: true });
  const b = S().createWindow({ url: "https://b1.example/" });
  S().updateSettings({ shareTabsAcrossWindows: true });
  S().dockToSide(a2);
  S().updateSettings({ sidePane: false });
  S().newTab(b, { url: "https://b2.example/", background: true });
  assert.ok(S().tabs[a2]);
  assert.equal(view(b).map((id) => S().tabs[id].url).includes("https://a2.example/"), true);
  S().updateSettings({ shareTabsAcrossWindows: false, sidePane: true });
});

test("the side tab in view counts as shown, and every docked tab is kept awake while the rail is on", async () => {
  const { shownTabIds, keepAliveReason } = await import("../tabs/tabKeepAlive.ts");
  const { w, b, c } = threeTabs();
  S().dockToSide(b);
  S().dockToSide(c);
  assert.equal(shownSideTab(S(), w), c);
  assert.equal(shownTabIds(S()).has(c), true);
  assert.equal(shownTabIds(S()).has(b), false);
  assert.equal(keepAliveReason(S(), b), "on the secondary tab rail");
  sidePane(false);
  assert.equal(shownTabIds(S()).has(c), false);
  assert.equal(keepAliveReason(S(), b), null);
  sidePane(true);
});
