# Material Icons Migration - Next Steps

## ✅ What's Been Completed

1. ✅ **Installed Material Icons package** - `@material-design-icons/svg` v0.14.15
2. ✅ **Created icon mapping** - 95 BWI icons mapped to Material Icons equivalents
3. ✅ **Extracted SVG files** - All 95 icons successfully extracted and renamed
4. ✅ **NPM scripts added** - Convenient commands for future updates

## 📦 What You Have Now

- **95 SVG files** in `.material-icons-staging/` directory
- Each file is named with BWI convention (e.g., `bwi-close.svg`, `bwi-lock.svg`)
- Files are ready to be converted into a font

## 🎯 Next Steps (Manual - You Need to Do This)

### Step 1: Generate Icon Font

You need to convert the 95 SVG files into a font file. Choose one option:

#### **Option A: IcoMoon (Recommended - Web-based, Free)**

1. Open https://icomoon.io/app in your browser
2. Click **"Import Icons"** button (top left)
3. Select **all 95 SVG files** from:
   ```
   /Users/bryancunningham/Desktop/Code/clients/.material-icons-staging/
   ```
4. After import, click **"Select All"** to select all imported icons
5. Click **"Generate Font"** button (bottom right)
6. Click ⚙️ icon for preferences:
   - **Font Name:** `bwi-font`
   - **Class Prefix:** `bwi-`
   - Leave other settings as default
7. Click **"Download"** button
8. Extract the downloaded ZIP file

#### **Option B: Fantasticon (Command-line, Automated)**

```bash
# Install fantasticon globally
npm install -g fantasticon

# Generate font (run from project root)
fantasticon .material-icons-staging \
  --output-dir libs/angular/src/scss/bwicons/fonts \
  --font-types woff2,woff,ttf,svg \
  --name bwi-font \
  --prefix bwi- \
  --normalize

# Skip to Step 3 (Testing)
```

### Step 2: Replace Font Files

After generating the font (via IcoMoon or Fantasticon):

1. **Backup current font files** (optional but recommended):

   ```bash
   cp -r libs/angular/src/scss/bwicons/fonts libs/angular/src/scss/bwicons/fonts.backup
   ```

2. **Copy new font files** from the downloaded package to:

   ```
   libs/angular/src/scss/bwicons/fonts/
   ```

   You need these 4 files:
   - `bwi-font.svg`
   - `bwi-font.ttf`
   - `bwi-font.woff`
   - `bwi-font.woff2`

3. **Verify files are in place**:
   ```bash
   ls -lh libs/angular/src/scss/bwicons/fonts/
   ```

### Step 3: Test the Changes

1. **Build the project**:

   ```bash
   npm run build
   ```

2. **Start development server**:

   ```bash
   npm start
   ```

3. **Visual inspection**:
   - Open the app in your browser
   - Check various pages with icons
   - Verify icons display correctly
   - Test icon buttons (click, hover states)

4. **Test in Storybook**:

   ```bash
   npm run storybook
   ```

   - Navigate to Component Library → Icon
   - Check that all icons render properly

5. **Test across all apps**:
   - **Web app** - Main application
   - **Browser extension** - All popup pages
   - **Desktop app** - All windows

### Step 4: Commit the Changes

Once everything looks good:

```bash
# Stage the new font files
git add libs/angular/src/scss/bwicons/fonts/

# Stage the mapping and scripts
git add scripts/material-icons/
git add package.json

# Commit
git commit -m "Replace BWI font with Material Design icons

- Add Material Icons package (@material-design-icons/svg)
- Create BWI → Material Icons mapping (95 icons)
- Generate new BWI font using Material Design glyphs
- All existing code continues to work (zero code changes)
- Icons now follow Material Design guidelines

🤖 Generated with Claude Code"
```

## 🔄 Rollback Instructions

If anything goes wrong, you can instantly rollback:

```bash
# Restore original font files
git checkout HEAD -- libs/angular/src/scss/bwicons/fonts/

# Rebuild
npm run build
```

## 📝 Icon Mappings Reference

Here are some notable mappings from your Figma design:

### Status Indicators

- `bwi-check` → `check`
- `bwi-error` → `error`
- `bwi-info-circle` → `info`
- `bwi-spinner` → `sync`
- `bwi-exclamation-triangle` → `warning`

### Common Actions

- `bwi-plus` → `add`
- `bwi-pencil` → `edit`
- `bwi-trash` → `delete`
- `bwi-close` → `close`
- `bwi-search` → `search`

### Bitwarden Objects

- `bwi-vault` → `inventory_2`
- `bwi-lock` → `lock`
- `bwi-key` → `vpn_key`
- `bwi-folder` → `folder`
- `bwi-collection` → `folder_shared`

### Navigation

- `bwi-angle-down` → `keyboard_arrow_down`
- `bwi-angle-up` → `keyboard_arrow_up`
- `bwi-ellipsis-h` → `more_horiz`
- `bwi-ellipsis-v` → `more_vert`

**Full mapping:** See [scripts/material-icons/icon-mapping.ts](./icon-mapping.ts)

## 🎯 What This Achieves

✅ **Zero code changes** - All 1000+ usages of `bwi-*` classes continue to work
✅ **Material Design** - Modern, consistent icon design
✅ **Easy rollback** - Just revert 4 font files if needed
✅ **Future-proof** - Can easily update icons by regenerating font
✅ **No breaking changes** - Fully backward compatible

## 📚 Documentation

- **Mapping configuration:** [scripts/material-icons/icon-mapping.ts](./icon-mapping.ts)
- **Extraction script:** [scripts/material-icons/extract-material-svgs.ts](./extract-material-svgs.ts)
- **Full README:** [scripts/material-icons/README.md](./README.md)
- **Extracted files:** `.material-icons-staging/` (95 SVG files)

## 🐛 Troubleshooting

### Icons not displaying after font replacement

**Issue:** Icons show as squares or don't render

**Solution:**

1. Clear browser cache (Cmd+Shift+R / Ctrl+Shift+R)
2. Verify font files are correct:
   ```bash
   ls -lh libs/angular/src/scss/bwicons/fonts/
   ```
3. Check browser console for font loading errors
4. Rebuild project: `npm run build`

### Font generation warnings in IcoMoon

**Issue:** IcoMoon shows warnings about icon complexity

**Solution:**

- Click "Ignore" or "Simplify" - Material Icons are optimized
- Warnings are usually safe to ignore for outline icons

### Icons have wrong size/alignment

**Issue:** Icons appear too large/small or misaligned

**Solution:**

- Regenerate font with "Normalize" option enabled in IcoMoon
- Or use Fantasticon with `--normalize` flag

## 📞 Need Help?

- **Material Icons Gallery:** https://fonts.google.com/icons
- **IcoMoon Documentation:** https://icomoon.io/docs.html
- **Figma Design File:** https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library

## ⚡ Quick Commands Reference

```bash
# Reinstall Material Icons (if needed)
npm run icons:install

# Re-extract SVG files (if mapping changes)
npm run icons:extract

# Complete setup from scratch
npm run icons:setup

# Build project
npm run build

# Run Storybook
npm run storybook

# Rollback font files
git checkout HEAD -- libs/angular/src/scss/bwicons/fonts/
```

---

**Ready to proceed?** Follow Step 1 above to generate your font! 🚀
