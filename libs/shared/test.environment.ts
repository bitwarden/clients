import { TextEncoder, TextDecoder } from "util";

import JSDOMEnvironment from "jest-environment-jsdom";

/**
 * Maps Node's APIs to the jsdom global object to work around
 * missing methods in Jest's 'jsdom' test environment.
 *
 * @remarks To use this test environment, reference this file
 * in the `testEnvironment` property of the Jest configuration
 * or adding a `@jest-environment path/to/test.environment.ts`
 * directive to your test file. Consult the Jest documentation
 * for more information.
 *
 * @see https://github.com/facebook/jest/blob/v29.4.3/website/versioned_docs/version-29.4/Configuration.md#testenvironment-string
 */
export default class FixJSDOMEnvironment extends JSDOMEnvironment {
  constructor(...args: ConstructorParameters<typeof JSDOMEnvironment>) {
    super(...args);

    // FIXME https://github.com/jsdom/jsdom/issues/3363#issuecomment-1467894943
    this.global.structuredClone = structuredClone;

    // FIXME https://github.com/jsdom/jsdom/issues/1724#issuecomment-1446858041
    this.global.fetch = fetch;
    this.global.Headers = Headers;
    this.global.Request = Request;
    this.global.Response = Response;

    // SDK/WASM code relies on TextEncoder/TextDecoder being available globally
    if (!(this.global as any).TextEncoder) {
      (this.global as any).TextEncoder = TextEncoder;
    }
    if (!(this.global as any).TextDecoder) {
      (this.global as any).TextDecoder = TextDecoder as unknown as typeof globalThis.TextDecoder;
    }
  }
}
