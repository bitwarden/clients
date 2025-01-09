import type { CustomMatchers } from "./spec";

// This declares the types for our custom matchers so that they're recognised by Typescript
// This file must also be included in the TS compilation (via the tsconfig.json "include" property) to be recognised by
// vscode

/* eslint-disable */
declare global {
  namespace jest {
    interface Expect extends CustomMatchers {}
    interface Matchers<R> extends CustomMatchers<R> {}
    interface InverseAsymmetricMatchers extends CustomMatchers {}
  }
}
/* eslint-enable */
