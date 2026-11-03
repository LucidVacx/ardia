import assert from "node:assert/strict";
import { test } from "node:test";
const { useBrowser } = await import("../browser/store.ts");
const { focusedSideTab, forgetSidePaneFocus, notePaneFocus } = await import("./focus.ts");

const S = () => useBrowser.getState();
const PERSONAL = { id: "default", name: "Personal", color: "plum", icon: null, createdAt: 0 };

function dockedWindow() {
  S().hydrate({ profiles: { default: PERSONAL }, profileOrder: ["default"] });
  const w = S().createWindow({ url: "https://a.example/" });
  const [a] = S().windows[w].tabIds;
  const b = S().newTab(w, { url: "https://b.example/", background: true });
  const c = S().newTab(w, { url: "https://c.example/", background: true });
  S().activate(a);
  S().dockToSide(b);
  return { w, a, b, c };
}

test("focus in the side page routes to the side tab until the main page takes it back", () => {
  const { w, a, b } = dockedWindow();
  assert.equal(focusedSideTab(S(), w), undefined);
  notePaneFocus(b);
  assert.equal(focusedSideTab(S(), w), b);
  notePaneFocus(a);
  assert.equal(focusedSideTab(S(), w), undefined);
});

test("side focus lapses when the side tab is hidden, switched or forgotten", () => {
  const { w, b, c } = dockedWindow();
  notePaneFocus(b);
  S().toggleSideTab(w, b);
  assert.equal(focusedSideTab(S(), w), undefined);
  S().toggleSideTab(w, b);
  assert.equal(focusedSideTab(S(), w), b);
  S().dockToSide(c);
  assert.equal(focusedSideTab(S(), w), undefined);
  notePaneFocus(c);
  forgetSidePaneFocus(w);
  assert.equal(focusedSideTab(S(), w), undefined);
});

test("side focus lapses when another main tab becomes active", () => {
  const { w, b, c } = dockedWindow();
  notePaneFocus(b);
  S().activate(c);
  assert.equal(focusedSideTab(S(), w), undefined);
});
