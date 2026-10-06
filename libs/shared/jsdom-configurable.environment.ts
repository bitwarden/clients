import BaseJSDOMEnvironment from "@jest/environment-jsdom-abstract";
import * as jsdom from "jsdom";

const { JSDOM } = jsdom;

// The [LegacyUnforgeable] globals that jsdom defines as non-configurable when
// it builds a window. Tests frequently replace these with `Object.defineProperty`
// or `jest.spyOn` to stand in a navigation target, a frame relationship, a
// different window, or a mocked document.
const CONFIGURABLE_GLOBALS = ["window", "document", "location", "top"] as const;

/**
 * A `JSDOM` that leaves the [LegacyUnforgeable] globals (`window`, `document`,
 * `location`, `top`) configurable.
 *
 * jsdom defines these as non-configurable to match the HTML spec, which makes
 * `Object.defineProperty(window, "location", ...)` and `jest.spyOn` on them
 * throw. They are locked in a single `Object.defineProperties` call while the
 * window is constructed, so we intercept that call for the duration of
 * construction and relax only those descriptors. Every other jsdom behavior is
 * untouched.
 */
class ConfigurableGlobalsJSDOM extends JSDOM {
  constructor(html?: ConstructorParameters<typeof JSDOM>[0], options?: jsdom.ConstructorOptions) {
    const originalDefineProperties = Object.defineProperties;
    Object.defineProperties = function (target: object, descriptors: PropertyDescriptorMap) {
      for (const key of CONFIGURABLE_GLOBALS) {
        const descriptor = descriptors[key];
        if (descriptor && descriptor.configurable === false) {
          descriptors[key] = { ...descriptor, configurable: true };
        }
      }
      return originalDefineProperties.call(Object, target, descriptors);
    } as typeof Object.defineProperties;

    try {
      super(html, options);
    } finally {
      Object.defineProperties = originalDefineProperties;
    }
  }
}

/**
 * The default jsdom test environment, composed so that the [LegacyUnforgeable]
 * globals (`window`, `document`, `location`, `top`) remain configurable and can
 * be re-mocked in tests.
 *
 * @remarks Reference this file in the `testEnvironment` property of a Jest
 * configuration, or with a `@jest-environment` directive in a test file.
 */
export default class ConfigurableJSDOMEnvironment extends BaseJSDOMEnvironment {
  constructor(
    config: ConstructorParameters<typeof BaseJSDOMEnvironment>[0],
    context: ConstructorParameters<typeof BaseJSDOMEnvironment>[1],
  ) {
    super(config, context, { ...jsdom, JSDOM: ConfigurableGlobalsJSDOM });
  }
}
