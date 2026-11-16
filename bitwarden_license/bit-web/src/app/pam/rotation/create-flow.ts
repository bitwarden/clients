/** The query parameters that join the two rotation create flows. */
export const TARGET_SYSTEM_QUERY_PARAM = "targetSystemId";

/** @see TARGET_SYSTEM_QUERY_PARAM */
export const THEN_QUERY_PARAM = "then";

/**
 * The {@link THEN_QUERY_PARAM} value that returns target-system creation to the add-credential
 * form. Any value other than this and {@link THEN_CREDENTIAL} falls back to the default landing.
 */
export const THEN_MANAGED_CREDENTIAL = "managed-credential";

/**
 * The {@link THEN_QUERY_PARAM} value that returns a target system's page to the managed credential
 * named by {@link CONFIG_QUERY_PARAM}, whose callout sent the admin there to fix it.
 */
export const THEN_CREDENTIAL = "credential";

/** @see THEN_CREDENTIAL */
export const CONFIG_QUERY_PARAM = "configId";

/**
 * The {@link THEN_QUERY_PARAM} value that returns a managed credential's page to the Managed
 * credentials tab of the target system named by {@link TARGET_SYSTEM_QUERY_PARAM}.
 */
export const THEN_TARGET_SYSTEM = "target-system";
