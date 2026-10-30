/** The segment after `:importType` that holds location selection. */
export const IMPORT_DESTINATION_SEGMENT = "destination";

/** The location selection route, next to the `:importType` route for credential parsing. Shared so
 *  the apps' route tables and the shell's progress bar can't drift apart. */
export const IMPORT_DESTINATION_ROUTE_PATH = `:importType/${IMPORT_DESTINATION_SEGMENT}`;
