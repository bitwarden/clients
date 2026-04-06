declare module "@bitwarden/sdk-internal" {
  // In `bit-*` clients the commercial sdk replaces the regular internal sdk,
  // this file creates an alias so that typescript understands that.
  // The actual replacement is done in the build system via webpack's resolve.alias.
  // eslint-disable-next-line no-restricted-imports
  export * from "@bitwarden/commercial-sdk-internal";
}
