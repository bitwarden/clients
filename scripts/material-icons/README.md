# Icon Font Management

This directory contains scripts and resources for managing the Bitwarden icon font (BWI).

## Overview

The icon system uses Figma-exported SVG files that are converted into a web font using Fantasticon. SVG filenames directly become CSS class names (with the `bwi-` prefix added automatically), making the workflow simple and straightforward.

## Adding a New Icon

Follow these steps to add a new icon to the icon font:

### 1. Export the Icon from Figma

1. Open the Figma icon file
2. Select the icon you want to export
3. Export as SVG with these settings:
   - **Outline stroke**: Enabled
   - **Include "id" attribute**: Disabled
   - **Simplify stroke**: Enabled
4. Name the file using kebab-case (e.g., `help.svg`, `star-filled.svg`, `add-circle.svg`)
5. Save the SVG file to `libs/assets/src/material-icons/`

**Important:** The SVG filename directly becomes the CSS class name. For example, `help.svg` will generate the class `bwi-help`, and `star-filled.svg` will generate `bwi-star-filled`. Choose your filename carefully as it determines how developers will use the icon.

### 2. Generate the Icon Font

Run the build script:

```bash
npm run icons:build
```

This script will:

1. ✅ Generate the icon font files from all SVGs (woff2, woff, ttf, svg)
2. ✅ Update the SCSS with the new icon mappings
3. ✅ **Automatically update** `libs/components/src/shared/icon.ts` with the new icon
4. ✅ Clean up temporary build artifacts

**Output files:**

- `libs/angular/src/scss/bwicons/fonts/bwi-font.*` - Font files
- `libs/angular/src/scss/bwicons/styles/style.scss` - Updated with new icon
- `libs/components/src/shared/icon.ts` - Auto-generated TypeScript icon list (do not edit manually)

**Note:** The TypeScript icon array is now auto-generated during the build process. You no longer need to manually add icons to `icon.ts`.

### 3. Add to Storybook Documentation

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

### 4. Test Your Icon

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

## Migrating Icon Names

Use the migration script when you need to **rename icon references across the entire codebase**. This is different from adding a new icon—it's for bulk-renaming existing icon class names.

### When to Use Migration

- You're standardizing icon names to match new Figma conventions
- You're replacing a legacy icon name with a new one
- You need to update icon references in dozens or hundreds of files

**Important:** This is NOT for adding new icons. Use the "Adding a New Icon" workflow above for that.

### How to Migrate Icon Names

**1. Add the mapping to `migration-map.ts`**

Open `scripts/material-icons/migration-map.ts` and add your mapping to the `BWI_TO_FIGMA` object:

```typescript
export const BWI_TO_FIGMA: Record<string, string> = {
  // ... existing mappings ...

  // Add your migration here
  "old-icon-name": "new-icon-name",
};
```

**Example:**

```typescript
// Rename bwi-question-circle to bwi-help
"question-circle": "help",

// Rename bwi-spinner to bwi-loading
"spinner": "loading",
```

**Note:** Do not include the `bwi-` prefix—the script adds it automatically.

**2. Preview the changes (recommended)**

Run the migration script in dry-run mode to see what will be changed:

```bash
npm run icons:migrate -- --dry-run
```

This shows you all files and occurrences that will be updated without actually modifying anything.

**3. Run the migration**

Once you've verified the preview, run the actual migration:

```bash
npm run icons:migrate
```

**4. Review the migration report**

After migration completes, check `scripts/material-icons/migration-report.json` for a detailed report of all changes:

```json
[
  {
    "file": "apps/web/src/app/components/icon.component.html",
    "oldName": "bwi-question-circle",
    "newName": "bwi-help",
    "occurrences": 3
  }
  // ... more entries
]
```

### What Gets Updated

The migration script searches and replaces icon names in:

- TypeScript files (`.ts`)
- HTML templates (`.html`)
- SCSS/CSS files (`.scss`, `.css`)
- Markdown documentation (`.md`, `.mdx`)

In the following directories:

- `apps/`
- `libs/`
- `bitwarden_license/`

Excluding build/cache directories like `node_modules`, `dist`, `.git`, etc.

### Migration Workflow Example

Complete workflow for renaming an icon:

```bash
# 1. Add mapping to migration-map.ts
# "spinner": "loading"

# 2. Preview changes
npm run icons:migrate -- --dry-run

# 3. Run migration
npm run icons:migrate

# 4. Review migration-report.json

# 5. Commit the changes
git add .
git commit -m "Migrate bwi-spinner to bwi-loading"
```

## File Structure

```
scripts/material-icons/
├── build-with-bwi-names.ts          # Main build script
├── migrate-icon-names.ts            # Migration script for bulk renames
├── migration-map.ts                 # Configuration for migration
├── migration-report.json            # Generated migration report
└── README.md                        # This file

libs/assets/src/material-icons/
├── help.svg                         # Figma-exported SVG files
├── star-filled.svg
└── ... (all source SVG files)

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

The icon system uses a **direct naming approach**: the SVG filename becomes the CSS class name (with `bwi-` prefix added automatically).

### Naming Guidelines

- **Use kebab-case**: `star-filled.svg`, not `starFilled.svg` or `star_filled.svg`
- **Be descriptive**: Choose names that clearly indicate the icon's purpose
- **Follow Figma**: Use names from the Figma design system when possible
- **Consider usage**: The filename determines how developers reference the icon

### Examples

| SVG Filename            | Generated CSS Class      | Usage Example                     |
| ----------------------- | ------------------------ | --------------------------------- |
| `help.svg`              | `.bwi-help`              | Help/question icons               |
| `star-filled.svg`       | `.bwi-star-filled`       | Filled star for favorites         |
| `add-circle.svg`        | `.bwi-add-circle`        | Add button with circle background |
| `arrow-filled-down.svg` | `.bwi-arrow-filled-down` | Dropdown indicators               |
| `visibility-off.svg`    | `.bwi-visibility-off`    | Hide password toggle              |

### Legacy Mappings

Some icons have legacy mappings documented in `migration-map.ts` for historical reference. For example:

- `bwi-question-circle` was migrated to `bwi-help`
- `bwi-spinner` was migrated to `bwi-loading`
- `bwi-plus` was migrated to `bwi-add`

These mappings are only relevant if you're running migrations. New icons don't need any mappings.

## Troubleshooting

### Icon not appearing after build

- Verify the SVG file is in `libs/assets/src/material-icons/`
- Check that your SVG filename uses kebab-case and has the `.svg` extension
- Run `npm run icons:build` again
- Clear browser cache

### Wrong icon displaying

- Verify the SVG filename matches what you expect (it becomes the CSS class)
- Ensure you're using the correct `bwi-` class name in your component
- Check for duplicate SVG files with similar names

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
<i class="bwi bwi-help"></i>

<!-- Large icon -->
<i class="bwi bwi-help bwi-lg"></i>

<!-- Fixed width icon (useful in lists) -->
<i class="bwi bwi-help bwi-fw"></i>

<!-- Spinning icon -->
<i class="bwi bwi-loading bwi-spin"></i>
```

## Best Practices

1. **Icon Consistency**: Follow the existing Figma design system naming
2. **Semantic Naming**: Use descriptive filenames that clearly indicate the icon's purpose
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
- Review existing icons in `libs/assets/src/material-icons/`
- Consult the design team for icon naming conventions
