// webmapper context-menu items, nested under the Bitwarden root menu and gated
// by the same dev flag as autofill triage. IDs encode the action so a click
// routes without extra lookup. Plain-English titles match the triage menu's
// convention — both are developer-facing tools behind the fillAssistDevTools
// dev flag (dev builds only).

import { ROOT_ID } from "@bitwarden/common/autofill/constants";

import { DevFlags } from "../../platform/flags";
import { InitContextMenuItems } from "../browser/abstractions/main-context-menu-handler";

import { ACTION_KEYS, FIELD_KEYS } from "./keys";

export const WEBMAPPER_ROOT_ID = "webmapper";
export const WEBMAPPER_CONTAINER_ID = "webmapper:container";
export const WEBMAPPER_IRRELEVANT_ID = "webmapper:irrelevant";

const FIELD_GROUP_PREFIX = "webmapper:fieldgroup:";
const FIELD_PREFIX = "webmapper:field:";
const ACTION_GROUP_ID = "webmapper:actiongroup";
const ACTION_PREFIX = "webmapper:action:";

export type WebmapperMenuAction =
  | { kind: "field"; key: string }
  | { kind: "action"; key: string }
  | { kind: "set-container" }
  | { kind: "toggle-irrelevant" };

/** True for any menu item id owned by webmapper (leaves and parents alike). */
export function isWebmapperMenuId(id: string): boolean {
  return id === WEBMAPPER_ROOT_ID || id.startsWith("webmapper:");
}

/** Resolve a clicked leaf item to its action; null for non-actionable parents. */
export function parseWebmapperMenuId(id: string): WebmapperMenuAction | null {
  if (id === WEBMAPPER_IRRELEVANT_ID) {
    return { kind: "toggle-irrelevant" };
  }
  if (id === WEBMAPPER_CONTAINER_ID) {
    return { kind: "set-container" };
  }
  if (id.startsWith(FIELD_PREFIX)) {
    return { kind: "field", key: id.slice(FIELD_PREFIX.length) };
  }
  if (id.startsWith(ACTION_PREFIX)) {
    return { kind: "action", key: id.slice(ACTION_PREFIX.length) };
  }
  return null;
}

/** The full webmapper menu tree, ready to append to the main context menu. */
export function webmapperContextMenuItems(): InitContextMenuItems[] {
  const requiresDevFlag: keyof DevFlags = "fillAssistDevTools";
  const items: InitContextMenuItems[] = [
    { id: WEBMAPPER_ROOT_ID, parentId: ROOT_ID, title: "Webmapper", requiresDevFlag },
  ];

  for (const [group, keys] of Object.entries(FIELD_KEYS)) {
    const groupId = `${FIELD_GROUP_PREFIX}${group}`;
    items.push({
      id: groupId,
      parentId: WEBMAPPER_ROOT_ID,
      title: `Field › ${group}`,
      requiresDevFlag,
    });
    for (const key of keys) {
      items.push({
        id: `${FIELD_PREFIX}${key}`,
        parentId: groupId,
        title: key,
        requiresDevFlag,
      });
    }
  }

  items.push({
    id: ACTION_GROUP_ID,
    parentId: WEBMAPPER_ROOT_ID,
    title: "Action",
    requiresDevFlag,
  });
  for (const key of ACTION_KEYS) {
    items.push({
      id: `${ACTION_PREFIX}${key}`,
      parentId: ACTION_GROUP_ID,
      title: key,
      requiresDevFlag,
    });
  }

  items.push({
    id: WEBMAPPER_CONTAINER_ID,
    parentId: WEBMAPPER_ROOT_ID,
    title: "Pick form container…",
    requiresDevFlag,
  });
  items.push({
    id: WEBMAPPER_IRRELEVANT_ID,
    parentId: WEBMAPPER_ROOT_ID,
    title: "Toggle page irrelevant (null)",
    requiresDevFlag,
  });

  return items;
}
