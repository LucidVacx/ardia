import assert from "node:assert/strict";
import { test } from "node:test";
const { SIDE_PANE_MIN, sidePaneMax, sidePaneWidth } = await import("./geometry.ts");

const split = (n, orientation = "horizontal") => ({ id: "s", windowId: "w", orientation, slots: Array.from({ length: n }, (_, i) => ({ size: 1 / n, tabId: `t${i}` })) });
const stacked = { id: "s", windowId: "w", orientation: "vertical", slots: [{ size: 0.5, tabId: "t0" }, { size: 0.5, stack: ["t1", "t2"], stackSizes: [0.5, 0.5] }] };

test("the side pane leaves a minimum pane for every split column", () => {
  assert.equal(sidePaneWidth(420, 1400, undefined), 420);
  assert.equal(sidePaneWidth(2000, 1400, undefined), sidePaneMax(1400, undefined));
  assert.ok(sidePaneMax(1400, split(2)) < sidePaneMax(1400, undefined));
  assert.equal(sidePaneMax(1400, split(2, "vertical")), sidePaneMax(1400, undefined));
  assert.equal(sidePaneMax(1400, stacked), sidePaneMax(1400, split(2)));
  assert.ok(1400 - sidePaneWidth(2000, 1400, split(3)) >= 3 * 220);
});

test("the side pane hides rather than shrinking below its minimum", () => {
  assert.equal(sidePaneWidth(420, 400, undefined), 0);
  assert.equal(sidePaneWidth(100, 1000, undefined), SIDE_PANE_MIN);
  assert.equal(sidePaneWidth(420, 700, split(2)), 0);
});
