import { mock } from "jest-mock-extended";

import { DialogService } from "@bitwarden/components";

import { confirmDeactivateTargetSystem, confirmDeleteTargetSystem } from "./target-system-dialogs";

describe("target system dialogs", () => {
  const dialogService = mock<DialogService>();

  beforeEach(() => {
    dialogService.openSimpleDialog.mockReset();
    dialogService.openSimpleDialog.mockResolvedValue(true);
  });

  it("asks before deactivating, as a warning", async () => {
    await expect(confirmDeactivateTargetSystem(dialogService)).resolves.toBe(true);

    expect(dialogService.openSimpleDialog).toHaveBeenCalledWith({
      title: { key: "pamTargetSystemDeactivateDialogTitle" },
      content: { key: "pamTargetSystemDeactivateDialogContent" },
      acceptButtonText: { key: "pamTargetSystemDeactivateConfirm" },
      cancelButtonText: { key: "cancel" },
      type: "warning",
    });
  });

  it.each([
    [true, true, "pamTargetSystemDeleteDialogAssignedConnectorsContentDeactivateInstead"],
    [false, true, "pamTargetSystemDeleteDialogAssignedConnectorsContent"],
    [true, false, "pamTargetSystemDeleteDialogContentDeactivateInstead"],
    [false, false, "pamTargetSystemDeleteDialogContent"],
  ])(
    "confirms a delete as danger (active %s, drops assignments %s) with %s",
    async (active, dropsAssignments, contentKey) => {
      await confirmDeleteTargetSystem(dialogService, { active, dropsAssignments });

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith({
        title: { key: "pamTargetSystemDeleteDialogTitle" },
        content: { key: contentKey },
        acceptButtonText: { key: "pamTargetSystemDeleteTarget" },
        cancelButtonText: { key: "cancel" },
        type: "danger",
      });
    },
  );
});
