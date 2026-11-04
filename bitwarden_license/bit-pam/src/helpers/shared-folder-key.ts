/**
 * Legacy "collection" i18n key → its VFO1 "shared folder" variant, for the strings resolved in
 * TypeScript. Templates use the `vfo1I18n` pipe with both keys inline instead.
 */
const SHARED_FOLDER_KEYS: Readonly<Record<string, string>> = Object.freeze({
  pamAccessRuleCollectionsLoadError: "pamAccessRuleSharedFoldersLoadError",
  pamAccessRuleCopyCreated: "pamAccessRuleCopyCreatedSharedFolder",
  pamAccessRuleDeleteConfirmDescription: "pamAccessRuleDeleteConfirmDescriptionSharedFolder",
  pamAccessRuleErrorCollectionsGoverned: "pamAccessRuleErrorSharedFoldersGoverned",
  pamAccessRuleErrorCollectionsGovernedNamed: "pamAccessRuleErrorSharedFoldersGovernedNamed",
  pamAccessRuleErrorCollectionsMissing: "pamAccessRuleErrorSharedFoldersMissing",
  pamAccessRuleErrorCollectionsForeign: "pamAccessRuleErrorSharedFoldersForeign",
  pamAccessRuleCollectionCountSingular: "pamAccessRuleSharedFolderCountSingular",
  pamAccessRuleCollectionCount: "pamAccessRuleSharedFolderCount",
});

/**
 * Returns the shared-folder variant of `legacyKey` when VFO1 terminology is on. Keys without a
 * variant pass through unchanged.
 */
export function sharedFolderKey(legacyKey: string, sharedFolderTerminology: boolean): string {
  return sharedFolderTerminology ? (SHARED_FOLDER_KEYS[legacyKey] ?? legacyKey) : legacyKey;
}

export const SHARED_FOLDER_KEY_PAIRS: ReadonlyArray<readonly [string, string]> =
  Object.entries(SHARED_FOLDER_KEYS);
