/**
 * Schema version stamped onto every `ManagementProfile` this repo constructs.
 *
 * Every client's acquisition code shares this constant so the SDK never sees two versions for one
 * release. Bump it when the dotted-key namespace changes incompatibly.
 */
export const MANAGEMENT_PROFILE_VERSION = 1;
