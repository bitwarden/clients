import "@bitwarden/ui-common/setup-jest";

// jsdom lacks Symbol.dispose/asyncDispose, which `using` declarations need.
if (!Symbol.dispose) {
  Object.defineProperty(Symbol, "dispose", { value: Symbol("Symbol.dispose") });
}
if (!Symbol.asyncDispose) {
  Object.defineProperty(Symbol, "asyncDispose", { value: Symbol("Symbol.asyncDispose") });
}
