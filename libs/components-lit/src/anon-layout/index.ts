/**
 * Anonymous (unauthenticated) page layout.
 *
 * - `bit-anon-layout` (Angular `auth-anon-layout`).
 * - `bit-anon-layout-wrapper` takes the page data as `routeData` from the app instead of reading
 *   the Angular router; its content overrides it via `anonLayoutWrapperDataContext`.
 */
export * from "./anon-layout";
export * from "./anon-layout-defaults";
export * from "./anon-layout-wrapper";
export * from "./anon-layout-wrapper-data";
