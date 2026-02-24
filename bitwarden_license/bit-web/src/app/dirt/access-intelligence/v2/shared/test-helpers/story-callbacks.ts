import { signal } from "@angular/core";
import { action } from "storybook/actions";

/**
 * Creates selection state handlers for Storybook stories
 */
export function createSelectionHandlers(initialSelection: Set<string> = new Set()) {
  const selectedApplications = signal(new Set(initialSelection));
  const logToggleSelection = action("onToggleSelection");
  const logToggleAll = action("onToggleAll");

  return {
    selectedApplications: selectedApplications(),
    onToggleSelection: (appName: string) => {
      const current = selectedApplications();
      const next = new Set(current);
      if (next.has(appName)) {
        next.delete(appName);
      } else {
        next.add(appName);
      }
      selectedApplications.set(next);
      logToggleSelection(appName);
    },
    onToggleAll: (allApps: string[]) => {
      const current = selectedApplications();
      if (current.size === allApps.length) {
        selectedApplications.set(new Set());
      } else {
        selectedApplications.set(new Set(allApps));
      }
      logToggleAll(allApps.length);
    },
  };
}

/**
 * Creates application event handlers for table stories
 */
export function createApplicationHandlers() {
  return {
    showAppAtRiskMembers: action("showAppAtRiskMembers"),
    checkboxChange: action("checkboxChange"),
  };
}
