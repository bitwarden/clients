# Material Icons Extraction Complete

## What Was Done

- Extracted 95 Material Icons (outlined variant)
- Renamed to match BWI icon names
- Saved to: /Users/bryancunningham/Desktop/Code/clients/.material-icons-staging

## Next Steps: Generate Icon Font

### Option 1: Using IcoMoon (Recommended)

1. Go to https://icomoon.io/app
2. Click "Import Icons" button
3. Select all SVG files from: /Users/bryancunningham/Desktop/Code/clients/.material-icons-staging
4. Select all imported icons
5. Click "Generate Font" at bottom
6. In font preferences:
   - Font Name: bwi-font
   - Class Prefix: bwi-
   - Keep existing icon names (they already have bwi- prefix)
7. Download the font package
8. Extract and copy these files to libs/angular/src/scss/bwicons/fonts/:
   - bwi-font.svg
   - bwi-font.ttf
   - bwi-font.woff
   - bwi-font.woff2

### Option 2: Using Fontello

1. Go to https://fontello.com
2. Drag and drop all SVG files from /Users/bryancunningham/Desktop/Code/clients/.material-icons-staging
3. Assign each icon to its glyph code
4. Download font package
5. Copy font files to libs/angular/src/scss/bwicons/fonts/

### Option 3: Automated (Advanced)

Use a tool like 'fantasticon' or 'icon-font-generator':

```bash
npm install -g fantasticon

fantasticon /Users/bryancunningham/Desktop/Code/clients/.material-icons-staging \
  --output-dir libs/angular/src/scss/bwicons/fonts \
  --font-types woff2,woff,ttf,svg \
  --name bwi-font \
  --prefix bwi- \
  --normalize
```

## Testing

After replacing font files:

1. Run: npm run build
2. Start dev server: npm start
3. Check that all icons display correctly
4. Test across: browser extension, desktop app, web app

## Rollback

If anything goes wrong:

```bash
git checkout HEAD -- libs/angular/src/scss/bwicons/fonts/
```

## Current Font Files Location

/Users/bryancunningham/Desktop/Code/clients/libs/angular/src/scss/bwicons/fonts
