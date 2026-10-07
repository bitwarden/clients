import { SimpleDialogOptions } from "@bitwarden/components";

export function accessConnectorDeactivateConfirmOptions(name: string): SimpleDialogOptions {
  return {
    title: { key: "pamAccessConnectorDeactivateConfirmTitle" },
    content: { key: "pamAccessConnectorDeactivateConfirmContent", placeholders: [name] },
    acceptButtonText: { key: "pamAccessConnectorDeactivate" },
    cancelButtonText: { key: "cancel" },
    type: "warning",
  };
}

export function accessConnectorDeleteConfirmOptions(name: string): SimpleDialogOptions {
  return {
    title: { key: "pamAccessConnectorDeleteConfirmTitle" },
    content: { key: "pamAccessConnectorDeleteConfirmContent", placeholders: [name] },
    acceptButtonText: { key: "delete" },
    cancelButtonText: { key: "cancel" },
    type: "danger",
  };
}
