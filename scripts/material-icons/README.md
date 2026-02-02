# Icon Font Management

This directory contains scripts and resources for managing the Bitwarden icon font (BWI).

## Overview

The icon system uses Figma-exported SVG files that are converted into a web font using Fantasticon. The workflow temporarily renames icons from their Figma names to BWI names during the build process, then restores the original Figma names afterward.

## Adding a New Icon

Follow these steps to add a new icon to the icon font:

### 1. Export the Icon from Figma

1. Open the Figma icon file
2. Select the icon you want to export
3. Export as SVG with these settings:
   - **Outline stroke**: Enabled
   - **Include "id" attribute**: Disabled
   - **Simplify stroke**: Enabled
4. Name the file using the Figma naming convention (e.g., `help.svg`, `star-filled.svg`)
5. Save the SVG file to `libs/assets/src/material-icons/`

### 2. Add the Icon Mapping

Open `scripts/material-icons/build-with-bwi-names.ts` and add your icon to the `FIGMA_TO_BWI` mapping:

```typescript
const FIGMA_TO_BWI: Record<string, string | string[]> = {
  // ... existing mappings ...

  // Add your new icon here
  "figma-icon-name": "bwi-icon-name",

  // For icons that need multiple BWI names, use an array:
  "figma-icon-name": ["bwi-name-1", "bwi-name-2"],
};
```

**Important naming notes:**

- Figma names should match your SVG filename (without the `.svg` extension)
- BWI names should be **without** the `bwi-` prefix (the script adds it automatically)
- Use kebab-case for all names (e.g., `star-filled`, not `starFilled`)

**Example mappings:**

```typescript
// Single mapping
help: "question-circle",                    // help.svg → bwi-question-circle

// Multiple mappings (one SVG, multiple class names)
collection: ["collection", "collection-shared"],  // collection.svg → bwi-collection + bwi-collection-shared
```

### 3. Generate the Icon Font

Run the build script:

```bash
npm run icons:build
```

This script will:

1. ✅ Rename Figma icons to BWI names temporarily
2. ✅ Generate the icon font files (woff2, woff, ttf, svg)
3. ✅ Update the SCSS with the new icon mappings
4. ✅ Clean up temporary files
5. ✅ Restore original Figma filenames

**Output files:**

- `libs/angular/src/scss/bwicons/fonts/bwi-font.*` - Font files
- `libs/angular/src/scss/bwicons/styles/style.scss` - Updated with new icon

### 4. Add to Icon Component Type

Add your icon to the TypeScript icon enum in `libs/components/src/shared/icon.ts`:

```typescript
export type IconName =
  | "bwi-add"
  | "bwi-archive"
  // ... existing icons ...
  | "bwi-your-new-icon" // Add here, in alphabetical order
  | "bwi-vault";
```

This provides type safety when using icons in components.

### 5. Add to Storybook Documentation

Add your icon to the appropriate category in `libs/components/src/stories/icons/icon-data.ts`:

```typescript
// Choose the appropriate category:
// - statusIndicators
// - bitwardenObjects
// - actions
// - directionalMenuIndicators
// - miscObjects
// - platformsAndLogos

const actions = [
  // ... existing icons ...
  {
    id: "bwi-your-new-icon",
    usage: "Detailed description of when and how to use this icon.",
  },
];
```

**Usage description guidelines:**

- Start with what the icon indicates or does
- Include context-specific guidance (mobile, desktop, toggle states, etc.)
- Mention any variants or related icons
- Note any accessibility considerations

### 6. Test Your Icon

1. **Visual verification**: Run Storybook to see your icon

   ```bash
   npm run storybook
   ```

   Navigate to "Documentation / Icons" to verify your icon appears correctly

2. **Type checking**: Ensure TypeScript compiles without errors

   ```bash
   npm run test:types
   ```

3. **Usage test**: Try using the icon in a component
   ```typescript
   <bit-icon icon="bwi-your-new-icon"></bit-icon>
   ```

## File Structure

```
scripts/material-icons/
├── build-with-bwi-names.ts          # Main build script with icon mappings
└── README.md                        # This file

libs/assets/src/material-icons/
├── help.svg                         # Figma-exported SVG files
├── star-filled.svg
└── ... (110+ icons)

libs/angular/src/scss/bwicons/
├── fonts/
│   ├── bwi-font.woff2              # Generated font files
│   ├── bwi-font.woff
│   ├── bwi-font.ttf
│   └── bwi-font.svg
└── styles/
    └── style.scss                   # Generated SCSS with icon mappings

libs/components/src/
├── shared/
│   └── icon.ts                      # TypeScript icon types
└── stories/icons/
    └── icon-data.ts                 # Storybook documentation
```

## Icon Naming Conventions

### Figma Names (SVG files)

- Use descriptive names from Figma design system
- Examples: `help`, `star-filled`, `add-circle`, `arrow-filled-down`

### BWI Names (CSS classes)

- Use semantic names that describe function/purpose
- Examples: `question-circle`, `star-f`, `plus-circle`, `down-solid`

### Common Naming Patterns

| Pattern         | Figma Name          | BWI Name     | Usage                     |
| --------------- | ------------------- | ------------ | ------------------------- |
| Actions         | `add`               | `plus`       | Generic add/create action |
| Filled variants | `star-filled`       | `star-f`     | Filled state for toggles  |
| Directional     | `arrow-filled-down` | `down-solid` | Dropdown indicators       |
| Settings        | `settings-1`        | `cog-f`      | Filled settings icon      |

## Troubleshooting

### Icon not appearing after build

- Verify the SVG file is in `libs/assets/src/material-icons/`
- Check that the mapping in `FIGMA_TO_BWI` matches your filename exactly
- Run `npm run icons:build` again
- Clear browser cache

### Wrong icon displaying

- Check for naming conflicts in the `FIGMA_TO_BWI` mapping
- Ensure you're using the correct `bwi-` class name in your component

### Font not updating

- Delete the generated font files and rebuild:
  ```bash
  rm libs/angular/src/scss/bwicons/fonts/bwi-font.*
  npm run icons:build
  ```

### TypeScript errors

- Ensure you added the icon to `libs/components/src/shared/icon.ts`
- Check that the icon name format matches: `bwi-icon-name`

## Advanced Usage

### Creating Icon Variants

If you need multiple CSS classes for the same icon (like `collection` and `collection-shared`):

```typescript
const FIGMA_TO_BWI: Record<string, string | string[]> = {
  // Single SVG generates two CSS classes
  collection: ["collection", "collection-shared"],
};
```

This generates both:

- `.bwi-collection:before`
- `.bwi-collection-shared:before`

Both use the same glyph from `collection.svg`.

### Icon Sizing Classes

Available utility classes (defined in `style.scss`):

- `.bwi` - Base class (required)
- `.bwi-sm` - Small (0.875em)
- `.bwi-lg` - Large (~1.33em)
- `.bwi-2x` - 2x size
- `.bwi-3x` - 3x size
- `.bwi-4x` - 4x size
- `.bwi-fw` - Fixed width (~1.3em)

### Rotation & Animation

- `.bwi-rotate-270` - Rotate 270 degrees
- `.bwi-spin` - Animated spinning (for loading spinners)

### Example Usage

```html
<!-- Basic icon -->
<i class="bwi bwi-question-circle"></i>

<!-- Large icon -->
<i class="bwi bwi-question-circle bwi-lg"></i>

<!-- Fixed width icon (useful in lists) -->
<i class="bwi bwi-question-circle bwi-fw"></i>

<!-- Spinning icon -->
<i class="bwi bwi-spinner bwi-spin"></i>
```

## Best Practices

1. **Icon Consistency**: Follow the existing Figma design system naming
2. **Semantic Naming**: Use BWI names that describe the icon's purpose, not appearance
3. **Documentation**: Always add usage guidelines to Storybook
4. **Accessibility**: Include proper ARIA labels when using icons without text
5. **SVG Optimization**: Export from Figma with strokes outlined
6. **Testing**: Verify icons in Storybook before committing

## Resources

- [Fantasticon Documentation](https://github.com/tancredi/fantasticon)
- [Icon Font Best Practices](https://css-tricks.com/examples/IconFont/)
- Internal Figma Icon Library: [Link to your Figma file]

## Support

For questions or issues:

- Check the troubleshooting section above
- Review existing icon mappings in `build-with-bwi-names.ts`
- Consult the design team for icon naming conventions
