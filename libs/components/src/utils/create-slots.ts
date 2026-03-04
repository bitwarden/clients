// NOTE: Illustrative only — @vanilla-extract/css and @vanilla-extract/recipes are not installed.

import { style } from "@vanilla-extract/css";
import type { ComplexStyleRule } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import type { RecipeConfig } from "@vanilla-extract/recipes";

/**
 * A slot definition is one of:
 *
 *   1. A RecipeConfig (has `variants`, `base`, `compoundVariants`, or `defaultVariants`)
 *      → `recipe()` is called internally at build time. The resulting recipe
 *        function is called with the full TVariants at render time.
 *
 *   2. A ComplexStyleRule (CSS property map with no recipe keys)
 *      → `style()` is called internally at build time. The class name is
 *        static — variants have no effect on it.
 *
 *   3. A function (variants: TVariants) => string
 *      → Called with the full TVariants at render time. Use this when you
 *        need to transform or pick variant props before passing to a recipe
 *        (e.g. mapping a boolean to 'shown' | 'hidden').
 */
type SlotDef<TVariants> =
  | RecipeConfig
  | ComplexStyleRule
  | ((variants: TVariants) => string);

/**
 * Heuristic: a plain object is a RecipeConfig if it carries any of the
 * four vanilla-extract recipe keys. CSS property names never collide with
 * these.
 */
function isRecipeConfig(def: object): def is RecipeConfig {
  return (
    "variants" in def ||
    "base" in def ||
    "compoundVariants" in def ||
    "defaultVariants" in def
  );
}

/**
 * Defines a multi-slot component style, similar to tailwind-variants' `tv()`
 * slots, but built on vanilla-extract primitives.
 *
 * Each slot definition is compiled eagerly at build time (style() / recipe()
 * are called once). The returned function is called at render time with the
 * component's current variant props, and returns a typed object of class
 * name strings — one per slot.
 *
 * @example
 * export const buttonSlots = createSlots<ButtonVariantProps>({
 *   root: {
 *     base: { fontWeight: 500, borderRadius: '9999px' },
 *     variants: { buttonType: { primary: { background: 'var(--color-primary-600)' } } },
 *   },
 *   content: {
 *     variants: { loading: { shown: { visibility: 'hidden' }, hidden: {} } },
 *   },
 *   wrapper: { position: 'relative', display: 'flex' },
 * });
 *
 * // In component:
 * protected readonly styles = computed(() => buttonSlots({ buttonType: ..., loading: ... }));
 *
 * // In template:
 * // [class]="styles().root"   [class]="styles().content"
 */
export function createSlots<
  TVariants,
  TDefs extends Record<string, SlotDef<TVariants>>,
>(defs: TDefs): (variants: TVariants) => { [K in keyof TDefs]: string } {
  // Compile each definition once at build time.
  const compiled = Object.fromEntries(
    Object.entries(defs).map(([key, def]) => {
      if (typeof def === "function") {
        // Already a (variants) => string — use as-is.
        return [key, def];
      }
      if (isRecipeConfig(def)) {
        const r = recipe(def);
        // Recipe may declare a narrower variant type than TVariants; the cast
        // is contained here and does not affect the external API.
        return [key, (variants: TVariants) => r(variants as never)];
      }
      // Plain style rule — static, variants have no effect.
      const cls = style(def as ComplexStyleRule);
      return [key, () => cls];
    }),
  );

  return (variants: TVariants) =>
    Object.fromEntries(
      Object.entries(compiled).map(([key, fn]) => [
        key,
        (fn as (v: TVariants) => string)(variants),
      ]),
    ) as { [K in keyof TDefs]: string };
}
