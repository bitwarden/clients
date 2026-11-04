import { SimpleDialogOptions } from "@bitwarden/components";

/** Shared by the access connectors table and the detail page, so both ask the same question. */
export function accessConnectorDeactivateConfirmOptions(): SimpleDialogOptions {
  return {
    title: { key: "pamAccessConnectorDeactivateDialogTitle" },
    content: { key: "pamAccessConnectorDeactivateDialogContent" },
    acceptButtonText: { key: "pamAccessConnectorDeactivate" },
    cancelButtonText: { key: "cancel" },
    type: "warning",
  };
}

export function accessConnectorDeleteConfirmOptions(): SimpleDialogOptions {
  return {
    title: { key: "pamAccessConnectorDeleteDialogTitle" },
    content: { key: "pamAccessConnectorDeleteDialogContent" },
    acceptButtonText: { key: "pamAccessConnectorDeleteAccessConnector" },
    cancelButtonText: { key: "cancel" },
    type: "danger",
  };
}
