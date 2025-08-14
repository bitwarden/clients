# Assets

Owned by: ui-foundation

This lib contains assets used by the Bitwarden clients. Unused assets are tree-shaken from client bundles. This means that all exports from this library must not have any [side effects](https://webpack.js.org/guides/tree-shaking/#mark-the-file-as-side-effect-free).

## Usage

### SVGs

SVGs intended to be used with the `bit-icon` component live in `src/svgs`. These SVGs are built with the `icon-service` for security reasons. These SVGs can be viewed in our Component Library [Icon Story](https://components.bitwarden.com/?path=/story/component-library-icon--default).

When adding a new SVG, follow the instructions in our Component Library: [SVG Icon Docs](https://components.bitwarden.com/?path=/docs/component-library-icon--docs)

When importing an SVG in one of the clients:
`import { ExampleSvg } from "@bitwarden/assets/svg";`
