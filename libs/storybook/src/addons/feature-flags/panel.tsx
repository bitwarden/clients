/**
 * Manager-side (Storybook UI) "Feature Flags" panel.
 *
 * Renders a checkbox per flag from the catalog seeded into globals by the
 * preview, and writes the enabled set back to the `FEATURE_FLAGS_GLOBAL` global.
 * The preview's mock `ConfigService` reads that global. This file must not
 * import from `@bitwarden/*` — the manager bundle can't resolve those aliases,
 * which is why the catalog arrives via globals rather than a direct import. It
 * is imported directly (relatively) by `.storybook/manager.js` as a manager
 * entry, so it is intentionally not re-exported from the addon barrel.
 */
import React, { useMemo, useState } from "react";
import { addons, types, useGlobals } from "storybook/manager-api";

import {
  ADDON_ID,
  FEATURE_FLAGS_CATALOG_GLOBAL,
  FEATURE_FLAGS_GLOBAL,
  FeatureFlagOption,
  PANEL_ID,
} from "./constants";

function FeatureFlagsPanel() {
  const [globals, updateGlobals] = useGlobals();
  const [filter, setFilter] = useState("");

  const catalog = (globals[FEATURE_FLAGS_CATALOG_GLOBAL] ?? []) as FeatureFlagOption[];
  const enabled = (globals[FEATURE_FLAGS_GLOBAL] ?? []) as string[];
  const enabledSet = useMemo(() => new Set(enabled), [enabled]);

  const visible = useMemo(() => {
    const needle = filter.toLowerCase();
    return catalog.filter(
      (f) => f.name.toLowerCase().includes(needle) || f.value.toLowerCase().includes(needle),
    );
  }, [catalog, filter]);

  const setEnabled = (next: string[]) => updateGlobals({ [FEATURE_FLAGS_GLOBAL]: next });
  const toggle = (value: string) =>
    setEnabled(enabledSet.has(value) ? enabled.filter((f) => f !== value) : [...enabled, value]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        boxSizing: "border-box",
        padding: 16,
        fontFamily: "sans-serif",
        fontSize: 13,
      }}
    >
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          placeholder="Filter flags…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ flex: 1, padding: "4px 8px" }}
        />
        <button
          onClick={() => setEnabled([...new Set([...enabled, ...visible.map((f) => f.value)])])}
        >
          Enable shown
        </button>
        <button onClick={() => setEnabled([])}>Clear all</button>
      </div>
      <div style={{ marginBottom: 8, opacity: 0.7 }}>
        {enabledSet.size} of {catalog.length} enabled
      </div>
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
        }}
      >
        {visible.map((f) => (
          <li key={f.value} style={{ padding: "2px 0" }}>
            <label style={{ display: "flex", gap: 8, cursor: "pointer", alignItems: "baseline" }}>
              <input
                type="checkbox"
                checked={enabledSet.has(f.value)}
                onChange={() => toggle(f.value)}
              />
              <span>
                <strong>{f.name}</strong> <span style={{ opacity: 0.6 }}>{f.value}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

addons.register(ADDON_ID, () => {
  addons.add(PANEL_ID, {
    type: types.PANEL,
    title: "Feature Flags",
    match: ({ viewMode }) => viewMode === "story",
    render: ({ active }) => (active ? <FeatureFlagsPanel /> : null),
  });
});
