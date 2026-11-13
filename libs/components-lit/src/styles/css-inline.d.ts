// Vite inlines `?inline` CSS imports as strings. Declared here as well as via `vite/client` so
// workspace-wide type checks that don't load Vite types still resolve it.
declare module "*.css?inline" {
  const css: string;
  export default css;
}
