/**
 * Shared status types for integration dialog results
 * Used across all SIEM integration dialogs (HEC, Datadog, Huntress, etc.)
 */
export const IntegrationDialogResultStatus = {
  Edited: "edit",
  Delete: "delete",
  SavedViaCallback: "saved",
} as const;

export type IntegrationDialogResultStatusType =
  (typeof IntegrationDialogResultStatus)[keyof typeof IntegrationDialogResultStatus];
