# @bitwarden/components — Critical Rules

## Styling with tailwind-variants

All new component and directive styles must use [tailwind-variants](https://www.tailwind-variants.org/) (`tv()`). Ask before refactoring existing styles.

**Rules:**

- Define styles in a co-located `<component-name>.styles.ts` file with a `default` export
- Use **slots** to name every styled element — no raw `class=` strings in templates
- Import the default export in the component and call it inside a `computed()` signal
- Do **not** use `defaultVariants` — signal inputs already carry default values

**Example:**

```ts
// button.component.styles.ts
import { tv } from "tailwind-variants";

export default tv({
  slots: {
    root: "tw-inline-flex tw-items-center tw-rounded",
    icon: "tw-mr-2",
  },
  variants: {
    size: {
      sm: { root: "tw-px-2 tw-py-1 tw-text-sm" },
      md: { root: "tw-px-4 tw-py-2" },
    },
  },
});
```

```ts
// button.component.ts
import buttonStyles from "./button.component.styles";

export class ButtonComponent {
  readonly size = input<"sm" | "md">("md");
  protected readonly styles = computed(() => buttonStyles({ size: this.size() }));
}
```

```html
<!-- button.component.html -->
<button [class]="styles().root()">
  <span [class]="styles().icon()"></span>
</button>
```
