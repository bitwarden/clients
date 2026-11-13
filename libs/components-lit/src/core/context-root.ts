import { ContextRoot } from "@lit/context";

// Elements can upgrade in any order, so a consumer may request a context before its provider
// exists. The root holds unanswered subscribing requests and replays them when a provider appears.
if (!(globalThis as { __bitContextRoot?: boolean }).__bitContextRoot) {
  (globalThis as { __bitContextRoot?: boolean }).__bitContextRoot = true;
  new ContextRoot().attach(document.documentElement);
}
