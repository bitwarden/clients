import { DialogService } from "@bitwarden/components";

/** The confirmations the table's row menu and the target system page share, so their copy can't drift. */

export function confirmDeactivateTargetSystem(dialogService: DialogService): Promise<boolean> {
  return dialogService.openSimpleDialog({
    title: { key: "pamTargetSystemDeactivateDialogTitle" },
    content: { key: "pamTargetSystemDeactivateDialogContent" },
    acceptButtonText: { key: "pamTargetSystemDeactivateConfirm" },
    cancelButtonText: { key: "cancel" },
    type: "warning",
  });
}

/**
 * Names the access connector assignments the delete drops, and suggests deactivating an active
 * target instead.
 */
export function confirmDeleteTargetSystem(
  dialogService: DialogService,
  target: { active: boolean; dropsAssignments: boolean },
): Promise<boolean> {
  return dialogService.openSimpleDialog({
    title: { key: "pamTargetSystemDeleteDialogTitle" },
    content: { key: deleteContentKey(target) },
    acceptButtonText: { key: "pamTargetSystemDeleteTarget" },
    cancelButtonText: { key: "cancel" },
    type: "danger",
  });
}

function deleteContentKey({
  active,
  dropsAssignments,
}: {
  active: boolean;
  dropsAssignments: boolean;
}): string {
  if (dropsAssignments) {
    return active
      ? "pamTargetSystemDeleteDialogAssignedConnectorsContentDeactivateInstead"
      : "pamTargetSystemDeleteDialogAssignedConnectorsContent";
  }
  return active
    ? "pamTargetSystemDeleteDialogContentDeactivateInstead"
    : "pamTargetSystemDeleteDialogContent";
}
