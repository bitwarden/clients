/**
 * @klappstuhl/ui-kit — FORK design system.
 *
 * Visual layer only. NEVER import @bitwarden/common, @bitwarden/key-management,
 * or any crypto/sync/api module from here. UI components live here; data access
 * goes through @klappstuhl/ui-bridge.
 *
 * The theme (CSS custom properties) is shipped as a stylesheet, imported by the
 * desktop renderer after the upstream base theme — see
 * apps/desktop/src/scss/tailwind.css. Token reference: ./theme/tokens.md
 */

export const UI_KIT_FORK_VERSION = "0.1.0-ui";

// Re-export design-token constants (TS mirror of the CSS custom properties) so
// component code can reference the scale without magic numbers.
export * from "./theme/tokens";

// Angular primitives are added here as they are implemented (Phase 3, step B):
// export * from "./components/button";
// export * from "./components/copy-field";
// export * from "./components/strength-meter";
// export * from "./components/totp-ring";
