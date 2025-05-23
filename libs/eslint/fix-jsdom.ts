import JSDOMEnvironment from "jest-environment-jsdom";

export default class FixJSDOMEnvironment extends JSDOMEnvironment {
  constructor(...args: ConstructorParameters<typeof JSDOMEnvironment>) {
    super(...args);

    // FIXME https://github.com/jsdom/jsdom/issues/3363
    this.global.structuredClone = structuredClone;
  }
}
