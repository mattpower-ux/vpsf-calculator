import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { desktopContextForScreen } from "./desktopWorkflow.js";

const app = () => readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const desktop = () => readFileSync(new URL("./DesktopCalculatorChrome.jsx", import.meta.url), "utf8");
const css = () => readFileSync(new URL("./desktopCalculatorChrome.css", import.meta.url), "utf8");

test("all production screens retain a desktop workflow context", () => {
  for (let screen = 0; screen <= 31; screen += 1) assert.ok(desktopContextForScreen(screen).title);
});

test("view changes persist presentation without resetting calculator state", () => {
  const source = app();
  const setter = source.match(/const setViewMode = useCallback\(\(mode\) => \{([\s\S]*?)\n  \}, \[\]\);/)?.[1] || "";
  assert.match(setter, /writeCalculatorViewMode/);
  assert.match(setter, /setViewModeState/);
  assert.doesNotMatch(setter, /setScreen|setHome|setApiResult|setSelected/);
});

test("both shells restore focus to the active screen after presentation changes", () => {
  assert.match(desktop(), /\.focus\(\{ preventScroll: true \}\)/);
  const source = app();
  const mobileShell = source.slice(source.indexOf("function MobileCalculatorChrome"), source.indexOf("function CalculatorChrome"));
  assert.match(mobileShell, /\.focus\(\{ preventScroll: true \}\)/);
});

test("desktop shell collapses rails and honors reduced motion", () => {
  const styles = css();
  assert.match(styles, /@media\(max-width:820px\)/);
  assert.match(styles, /prefers-reduced-motion:reduce/);
});

test("score review and improvement path remain connected to existing screens", () => {
  const source = app();
  assert.match(source, /How Can I Improve this Score\?/);
  assert.match(source, /setScreen\(6\)/);
  assert.match(source, /setScreen\(13\)/);
  assert.match(source, /Return to Products/);
});

