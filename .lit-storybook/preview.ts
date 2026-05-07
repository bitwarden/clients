// Load the SD-emitted token CSS and the compositional overlay CSS so that
// :root and .theme_dark have the design-token CSS variables defined when
// stories render. Components in libs/ui/byte consume these via var(--*).
import "../libs/ui/design-tokens/build/tokens.css";
import "../libs/components/src/tw-theme-overlays.css";

export const parameters = {
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/i,
    },
  },
};
