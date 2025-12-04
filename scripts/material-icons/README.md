# Material Icons Migration - Zero Code Changes

This directory contains scripts and configuration for migrating Bitwarden's BWI icon font to use Material Design icon glyphs while maintaining 100% backward compatibility.

## Overview

**Goal:** Replace all BWI icon glyphs with Material Design equivalents **without changing any code**.

**Result:** All existing code using `bwi-close`, `bwi-lock`, etc. will continue to work exactly the same, but will render Material Design icons instead.

## Quick Start

```bash
# Step 1: Install Material Icons package
npm run icons:install

# Step 2: Extract and prepare SVG files
npm run icons:extract

# Step 3: Generate new font (see instructions below)

# Step 4: Replace font files and test
```

## Detailed Steps

### Step 1: Install Material Icons

```bash
npm run icons:install
```

This installs `@material-design-icons/svg` package which contains all Material Design icons as individual SVG files.

### Step 2: Extract Icon SVGs

```bash
npm run icons:extract
```

This script:

- Reads the icon mapping from [`icon-mapping.ts`](./icon-mapping.ts)
- Finds each Material Icon SVG file (outlined variant)
- Renames them to match BWI names (e.g., `close.svg` → `bwi-close.svg`)
- Copies them to `.material-icons-staging/` directory

**Output:**

- `.material-icons-staging/` - Contains 80+ renamed SVG files
- `.material-icons-staging/extraction-report.json` - Details about what was extracted
- `.material-icons-staging/INSTRUCTIONS.md` - Next steps

### Step 3: Generate Icon Font

Now you need to convert the SVG files into a font. You have three options:

#### Option A: IcoMoon (Recommended - Web-based)

1. Go to https://icomoon.io/app
2. Click "Import Icons" button (top left)
3. Select all SVG files from `.material-icons-staging/`
4. Select all imported icons (click "Select All")
5. Click "Generate Font" button (bottom right)
6. In font preferences:
   - **Font Name:** `bwi-font`
   - **Class Prefix:** `bwi-`
   - Keep other settings as default
7. Click "Download"
8. Extract the downloaded ZIP file
9. Copy these files from `fonts/` folder to `libs/angular/src/scss/bwicons/fonts/`:
   - `bwi-font.svg`
   - `bwi-font.ttf`
   - `bwi-font.woff`
   - `bwi-font.woff2`

#### Option B: Fontello (Web-based)

1. Go to https://fontello.com
2. Drag and drop all SVG files from `.material-icons-staging/`
3. Customize settings:
   - Font Name: `bwi-font`
   - CSS Prefix: `bwi-`
4. Download font package
5. Copy font files to `libs/angular/src/scss/bwicons/fonts/`

#### Option C: Fantasticon (Command-line)

```bash
# Install fantasticon globally
npm install -g fantasticon

# Generate font
fantasticon .material-icons-staging \
  --output-dir libs/angular/src/scss/bwicons/fonts \
  --font-types woff2,woff,ttf,svg \
  --name bwi-font \
  --prefix bwi- \
  --normalize
```

### Step 4: Test the Changes

After replacing the font files:

```bash
# Build the project
npm run build

# Start development server
npm start

# Test in each app:
# - Browser extension
# - Desktop app
# - Web app
```

**What to test:**

- ✅ All icons render correctly
- ✅ Icons maintain proper sizing
- ✅ Icons work in all components (buttons, menus, lists, etc.)
- ✅ No console errors
- ✅ Icons work across all themes (light/dark)

### Step 5: Rollback (if needed)

If anything goes wrong, you can instantly rollback:

```bash
git checkout HEAD -- libs/angular/src/scss/bwicons/fonts/
```

This restores the original BWI font files.

## Icon Mapping

The complete mapping is defined in [`icon-mapping.ts`](./icon-mapping.ts):

```typescript
export const BWI_TO_MATERIAL_MAPPING = {
  "bwi-close": "close",
  "bwi-lock": "lock",
  "bwi-unlock": "lock_open",
  "bwi-check": "check",
  // ... 80+ more mappings
};
```

### Icon Categories

1. **Status Indicators** - check, error, info, warning, etc.
2. **Bitwarden Objects** - vault, collection, folder, credit-card, etc.
3. **Actions** - add, edit, delete, download, share, etc.
4. **Arrows & Menus** - angle-down, angle-up, ellipsis-h, etc.
5. **Miscellaneous** - browser, desktop, mobile, key, etc.
6. **3rd Party** - bitcoin, paypal, etc.

### New Icons

The mapping also identifies **new Material Icons** that don't have BWI equivalents:

- `autofill` - New icon for autofill feature
- `clear` - Differentiated from error icon
- `redo` - Paired with undo
- `arrow-down`, `arrow-up`, `arrow-left`, `arrow-right` - Directional arrows
- `diamond` - Premium plans indicator
- `sso` - Single sign-on
- And more...

These can be added to the component library separately.

## What Gets Changed?

### ✅ What Changes

- **Font files** in `libs/angular/src/scss/bwicons/fonts/`
- **Visual appearance** of icons (now Material Design)

### ❌ What Stays The Same

- **All HTML/template files** - No changes needed
- **All TypeScript files** - No changes needed
- **All class names** - Still use `bwi-close`, `bwi-lock`, etc.
- **All component code** - Works exactly as before
- **Icon button usage** - Still `bitIconButton="bwi-close"`

## File Structure

```
scripts/material-icons/
├── README.md                    # This file
├── icon-mapping.ts              # BWI → Material mappings (80+ icons)
├── extract-material-svgs.ts     # Extraction script
└── .material-icons-staging/     # Generated during extraction
    ├── bwi-close.svg
    ├── bwi-lock.svg
    ├── ... (80+ SVG files)
    ├── extraction-report.json
    └── INSTRUCTIONS.md
```

## Troubleshooting

### Problem: Material Icons package not found

**Solution:**

```bash
npm run icons:install
```

### Problem: Some icons missing after extraction

**Check:**

1. Look at `.material-icons-staging/extraction-report.json`
2. Failed icons will be listed with reasons
3. Most common issue: Material Icon name doesn't exist
4. Fix the mapping in `icon-mapping.ts` and re-run extraction

### Problem: Icons not displaying after font replacement

**Check:**

1. Font files are in correct location: `libs/angular/src/scss/bwicons/fonts/`
2. Font file names are correct: `bwi-font.svg`, `bwi-font.ttf`, etc.
3. Clear browser cache and rebuild
4. Check browser console for font loading errors

### Problem: Icons have wrong size/alignment

**Solution:**

- This usually happens if font generation settings were incorrect
- Regenerate font with proper settings (see Step 3)
- Ensure "Normalize" option is enabled in font generator

## Notes from Figma Design

The following icons have special notes from the design team:

- **bwi-collection-shared** - Should be removed, use `bwi-collection` instead
- **bwi-down-solid / bwi-up-solid** - Replace with new arrow icons in tables
- **bwi-provider** - Replace SSO usage with new `sso` icon
- **bwi-filter** - Consider using more standard filter icon in browser extension
- **bwi-brush** - Needs artwork update to palette icon

See `ICON_NOTES` in [`icon-mapping.ts`](./icon-mapping.ts) for complete list.

## Benefits

✅ **Zero code changes** - All 1000+ icon usages continue to work
✅ **Instant rollback** - Just revert 4 font files
✅ **Material Design consistency** - Modern, recognizable icons
✅ **No breaking changes** - Fully backward compatible
✅ **Easy testing** - Deploy and test without code migration
✅ **Future-proof** - Can gradually add new Material Icons

## Next Steps

After successfully replacing the font:

1. **Test thoroughly** across all apps and components
2. **Get design team approval** on icon appearance
3. **Consider new icons** - Add new Material Icons identified in mapping
4. **Clean up** - Remove deprecated icons like `bwi-collection-shared`
5. **Update documentation** - Note that BWI now uses Material Design glyphs

## Support

Questions? Check:

- [Material Icons Gallery](https://fonts.google.com/icons)
- [Figma Design File](https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library)
- [IcoMoon Documentation](https://icomoon.io/docs.html)
