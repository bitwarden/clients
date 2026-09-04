/**
 * Manager-side (Storybook UI) "Feature Flags" panel.
 *
 * Renders a checkbox per flag from the catalog the preview publishes as a
 * parameter, and writes the enabled set back to the `FEATURE_FLAGS_GLOBAL`
 * global. The preview's mock `ConfigService` reads that global. This file must
 * not import from `@bitwarden/*` — the manager bundle can't resolve those
 * aliases, which is why the catalog arrives over the preview/manager boundary
 * rather than via a direct import. It is imported directly (relatively) by
 * `.storybook/manager.js` as a manager entry, so it is intentionally not
 * re-exported from the addon barrel.
 */
import React, { useMemo, useState } from "react";
import { addons, types, useGlobals, useParameter } from "storybook/manager-api";

import {
  ADDON_ID,
  FEATURE_FLAGS_GLOBAL,
  FEATURE_FLAGS_PARAM,
  FeatureFlagOption,
  FeatureFlagsParameter,
  PANEL_ID,
} from "./constants";

/**
 * Reads an array off cross-boundary state, discarding anything malformed.
 * Storybook can hand back a sparse array when a value it persists drifts from
 * its initial value, and a bad entry here takes down the whole manager UI.
 */
function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value.filter((entry) => entry != null) : [];
}

function FeatureFlagsPanel() {
  const [globals, updateGlobals] = useGlobals();
  const parameter = useParameter<FeatureFlagsParameter | undefined>(FEATURE_FLAGS_PARAM, undefined);
  const [filter, setFilter] = useState("");

  const catalog = useMemo(() => toArray<FeatureFlagOption>(parameter?.catalog), [parameter]);
  const enabled = toArray<string>(globals[FEATURE_FLAGS_GLOBAL]);
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
        {/* The panel is pre-rendered before a story is prepared, so an empty
            catalog is a normal transient state rather than a failure. */}
        {catalog.length === 0
          ? "No feature flags available"
          : `${enabledSet.size} of ${catalog.length} enabled`}
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
