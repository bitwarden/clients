# Responsive Design Standards

**Purpose:** Standards and patterns for building responsive, mobile-first layouts using Tailwind CSS in Access Intelligence components

**Related:** [testing-standards-components.md](./testing-standards-components.md) for testing responsive layouts

---

## Table of Contents

1. [Mobile-First Philosophy](#mobile-first-philosophy)
2. [Tailwind Breakpoints Reference](#tailwind-breakpoints-reference)
3. [Common Responsive Patterns](#common-responsive-patterns)
4. [Component-Specific Guidance](#component-specific-guidance)
5. [Accessibility Requirements](#accessibility-requirements)
6. [Testing Responsive Layouts](#testing-responsive-layouts)
7. [Examples from Codebase](#examples-from-codebase)

---

## Mobile-First Philosophy

**Write CSS for mobile screens first, then enhance for larger screens using breakpoint modifiers.**

### Why Mobile-First?

- **Better performance:** Smaller devices load only necessary styles
- **Progressive enhancement:** Features add complexity as screen size increases
- **Simpler CSS:** Base styles apply to all screens, modifiers only override when needed
- **Accessibility:** Ensures touch-friendly interfaces on mobile

### Mobile-First Pattern

```html
<!-- ✅ CORRECT: Mobile-first (base styles, then modifiers) -->
<div class="tw-flex tw-flex-col md:tw-flex-row">
  <!-- Stacks vertically on mobile, horizontal on tablet+ -->
</div>

<!-- ❌ WRONG: Desktop-first (requires more overrides) -->
<div class="tw-flex tw-flex-row md:tw-flex-col">
  <!-- Horizontal on mobile, vertical on tablet - backwards! -->
</div>
```

---

## Tailwind Breakpoints Reference

Bitwarden uses Tailwind's default breakpoints (from `tailwind.config.base.js`):

| Breakpoint | Min Width | Typical Devices             | Usage                                                  |
| ---------- | --------- | --------------------------- | ------------------------------------------------------ |
| (default)  | 0px       | Mobile phones (320px-639px) | Base styles, mobile-first                              |
| `sm:`      | 640px     | Large phones, small tablets | Text size, minor spacing adjustments                   |
| `md:`      | 768px     | Tablets, small desktops     | **Primary for layout changes** (vertical → horizontal) |
| `lg:`      | 1024px    | Desktops, laptops           | Additional layout refinements, show/hide content       |
| `xl:`      | 1280px    | Large desktops              | Increased spacing, larger elements                     |
| `2xl:`     | 1536px    | Extra large displays        | Maximum width constraints                              |

### Breakpoint Guidelines

**Primary Layout Breakpoint:** Use `md:` (768px) for major layout changes:

- Stacked → horizontal layouts
- Single column → multi-column grids
- Full-width → constrained width

**Minor Adjustments:** Use `sm:` (640px) for:

- Text size increases (`tw-text-sm sm:tw-text-base`)
- Button groups (vertical → horizontal)
- Padding/gap adjustments

**Desktop Enhancements:** Use `lg:` (1024px) and above for:

- Show/hide supplementary content (`tw-hidden lg:tw-block`)
- Grid column increases (2 cols → 3 cols)
- Additional spacing/sizing

---

## Common Responsive Patterns

### Pattern 1: Flex Direction Changes

**Use Case:** Layouts that stack vertically on mobile, display horizontally on larger screens

```html
<!-- Toolbar/Header Layout -->
<div class="tw-flex tw-flex-col tw-gap-4 md:tw-flex-row md:tw-items-center">
  <input class="tw-w-full md:tw-w-auto" />
  <button class="tw-w-full md:tw-w-auto">Action</button>
</div>
```

**Behavior:**

- Mobile: Vertical stack with 16px gap
- Tablet+: Horizontal row with centered items

**Example:** [`applications-v2.component.html:6`](../../../../../../../bitwarden_license/bit-web/src/app/dirt/access-intelligence/v2/applications-v2.component.html#L6)

---

### Pattern 2: Grid Responsive Columns

**Use Case:** Card grids, dashboard layouts that adjust column count by screen size

```html
<!-- Card Grid -->
<ul class="tw-inline-grid tw-grid-cols-1 md:tw-grid-cols-2 lg:tw-grid-cols-3 tw-gap-6">
  <li>Card 1</li>
  <li>Card 2</li>
  <li>Card 3</li>
</ul>
```

**Behavior:**

- Mobile: 1 column
- Tablet: 2 columns
- Desktop: 3 columns

**Dynamic Column Spanning:**

```html
<li class="tw-col-span-1" [ngClass]="{ 'md:tw-col-span-2 lg:tw-col-span-2': shouldExtend }">
  <!-- Spans 2 columns when condition is true -->
</li>
```

**Example:** [`all-activity-v2.component.html:4`](../../../../../../../bitwarden_license/bit-web/src/app/dirt/access-intelligence/v2/all-activity-v2.component.html#L4)

---

### Pattern 3: Responsive Widths

**Use Case:** Elements that should be full-width on mobile, constrained on desktop

```html
<!-- Search Input -->
<input class="tw-w-full md:tw-min-w-64 lg:tw-min-w-96 lg:tw-w-1/2" />

<!-- Button -->
<button class="tw-w-full sm:tw-w-auto">Submit</button>

<!-- Container -->
<div class="tw-w-full lg:tw-w-auto">Content</div>
```

**Behavior:**

- Mobile: Full width (100%)
- Tablet: Minimum width constraint
- Desktop: Percentage-based or auto width

---

### Pattern 4: Hide/Show at Breakpoints

**Use Case:** Content that should only appear at specific screen sizes (e.g., decorative images, supplementary content)

```html
<!-- Desktop Only Content -->
<div class="tw-hidden lg:tw-block">
  <img src="decorative-image.png" alt="" />
</div>

<!-- Mobile/Tablet Only Content -->
<div class="tw-flex lg:tw-hidden">
  <p>Simplified mobile content</p>
</div>
```

**Common Pattern: Different Image Sizes**

```html
<!-- Desktop: Large video/image -->
<div class="tw-hidden lg:tw-block">
  <div class="tw-size-64 xl:tw-size-80">
    <video class="tw-size-full" src="large.mp4"></video>
  </div>
</div>

<!-- Mobile: Smaller video/image -->
<div class="tw-flex lg:tw-hidden tw-justify-center">
  <div class="tw-size-48 sm:tw-size-64">
    <video class="tw-size-full" src="small.mp4"></video>
  </div>
</div>
```

**Example:** [`empty-state-card.component.html:59-84`](../../../../../../../bitwarden_license/bit-web/src/app/dirt/access-intelligence/empty-state-card.component.html#L59)

**⚠️ Accessibility Warning:** Never hide **interactive content** (buttons, links) at smaller sizes. Only use for decorative or supplementary content.

---

### Pattern 5: Responsive Button Groups

**Use Case:** Button toolbars that stack on mobile, display horizontally on larger screens

```html
<!-- Button Group Container -->
<div
  class="tw-flex tw-flex-col tw-gap-3 tw-w-full sm:tw-flex-row sm:tw-gap-4 md:tw-ml-auto md:tw-w-auto"
>
  <button class="tw-w-full sm:tw-w-auto">Action 1</button>
  <button class="tw-w-full sm:tw-w-auto">Action 2</button>
  <button class="tw-w-full sm:tw-w-auto">Action 3</button>
</div>
```

**Behavior:**

- Mobile (< 640px): Vertical stack, full-width buttons, 12px gap
- Small (640px+): Horizontal row, auto-width buttons, 16px gap
- Tablet (768px+): Pushed to right with `tw-ml-auto`

**Example:** [`applications-v2.component.html:24`](../../../../../../../bitwarden_license/bit-web/src/app/dirt/access-intelligence/v2/applications-v2.component.html#L24)

---

### Pattern 6: Responsive Text Sizes

**Use Case:** Typography that scales appropriately for different screen sizes

```html
<!-- Heading -->
<h2 class="tw-text-lg sm:tw-text-xl">Title</h2>

<!-- Body Text -->
<p class="tw-text-sm sm:tw-text-base">Description</p>

<!-- Icon/Element Sizing -->
<div class="tw-size-8 sm:tw-size-9">Icon</div>
```

**Common Size Progressions:**

- Small text: `tw-text-xs sm:tw-text-sm`
- Body text: `tw-text-sm sm:tw-text-base`
- Headings: `tw-text-lg sm:tw-text-xl lg:tw-text-2xl`

**Example:** [`empty-state-card.component.html:5`](../../../../../../../bitwarden_license/bit-web/src/app/dirt/access-intelligence/empty-state-card.component.html#L5)

---

### Pattern 7: Responsive Gaps and Spacing

**Use Case:** Adjusting spacing between elements for different screen sizes

```html
<!-- Container Padding -->
<div class="tw-p-6 sm:tw-p-8">Content</div>

<!-- Gap Between Items -->
<div class="tw-flex tw-flex-col tw-gap-4 sm:tw-gap-5 lg:tw-gap-6">
  <div>Item 1</div>
  <div>Item 2</div>
</div>

<!-- Grid Gap -->
<div class="tw-grid tw-gap-4 lg:tw-gap-10">
  <div>Cell 1</div>
</div>
```

**Typical Progressions:**

- Tight spacing: `tw-gap-3 sm:tw-gap-4`
- Standard spacing: `tw-gap-4 sm:tw-gap-5 lg:tw-gap-6`
- Loose spacing: `tw-gap-6 lg:tw-gap-10`

---

## Component-Specific Guidance

### Toolbars with Search + Filters + Actions

**Pattern:** Search and filters take full width on mobile, buttons stack below. On larger screens, everything displays in a single horizontal row.

**Structure:**

```html
<div class="tw-flex tw-flex-col tw-gap-4 tw-mb-4 md:tw-flex-row md:tw-items-center">
  <!-- Search -->
  <bit-search class="tw-w-full md:tw-min-w-64 lg:tw-min-w-96 lg:tw-w-1/2" />

  <!-- Filter -->
  <bit-chip-select class="tw-w-full md:tw-min-w-48 md:tw-w-auto" />

  <!-- Button Group -->
  <div
    class="tw-flex tw-flex-col tw-gap-3 tw-w-full sm:tw-flex-row sm:tw-gap-4 md:tw-ml-auto md:tw-w-auto"
  >
    <button class="tw-w-full sm:tw-w-auto">Action</button>
  </div>
</div>
```

**Reference:** [`applications-v2.component.html`](../../../../../../../bitwarden_license/bit-web/src/app/dirt/access-intelligence/v2/applications-v2.component.html)

---

### Card Grids

**Pattern:** Responsive column count that adjusts based on screen size.

**Structure:**

```html
<ul class="tw-inline-grid tw-grid-cols-1 md:tw-grid-cols-2 lg:tw-grid-cols-3 tw-gap-6">
  @for (item of items; track item.id) {
  <li class="tw-col-span-1">
    <app-card [data]="item"></app-card>
  </li>
  }
</ul>
```

**Dynamic Spanning:**

```html
<li class="tw-col-span-1" [ngClass]="{ 'md:tw-col-span-2': item.featured }"></li>
```

**Reference:** [`all-activity-v2.component.html`](../../../../../../../bitwarden_license/bit-web/src/app/dirt/access-intelligence/v2/all-activity-v2.component.html)

---

### Two-Column Layouts

**Pattern:** Side-by-side columns on desktop, stacked on mobile.

**Structure:**

```html
<div class="tw-flex tw-flex-col md:tw-flex-row tw-gap-6">
  <!-- Left Column -->
  <div class="tw-flex tw-flex-col tw-gap-4 tw-flex-1">
    <p>Left content</p>
  </div>

  <!-- Right Column -->
  <div class="tw-flex tw-flex-col tw-gap-4 tw-flex-1">
    <p>Right content</p>
  </div>
</div>
```

**Key Classes:**

- `tw-flex-1` on both columns ensures equal distribution
- `md:tw-flex-row` changes from vertical to horizontal at tablet size

---

### Tables

**Pattern:** Allow horizontal scrolling on small screens to preserve readability.

**Structure:**

```html
<div class="tw-overflow-x-auto">
  <table class="tw-w-full tw-border-collapse">
    <thead>
      <tr>
        <th class="tw-text-left tw-py-3 tw-px-2">Column 1</th>
        <th class="tw-text-right tw-py-3 tw-px-2">Column 2</th>
      </tr>
    </thead>
    <tbody>
      <!-- Table rows -->
    </tbody>
  </table>
</div>
```

**Why not hide columns?** Hiding table columns on mobile can remove important data. Horizontal scroll preserves all information while maintaining readability.

---

## Accessibility Requirements

### Maintain Logical Focus Order

**Focus order must remain logical at all breakpoints:**

- Tab order should follow visual order
- Hidden content (`tw-hidden`) is automatically removed from focus order
- Use `aria-hidden="true"` for decorative images/videos

```html
<!-- Good: Focus order stays Search → Filter → Buttons -->
<div class="tw-flex tw-flex-col md:tw-flex-row">
  <input />
  <!-- Tab order: 1 -->
  <select />
  <!-- Tab order: 2 -->
  <button />
  <!-- Tab order: 3 -->
</div>
```

---

### Touch Target Sizing

**All interactive elements must meet WCAG 2.1 Level AA touch target requirements:**

- **Minimum size:** 44x44px (CSS pixels)
- **Spacing:** 8px between adjacent touch targets

**Full-width mobile buttons naturally meet this requirement:**

```html
<button class="tw-w-full sm:tw-w-auto tw-py-3">
  <!-- Full width on mobile, auto width on small screens -->
  <!-- Vertical padding ensures 44px minimum height -->
</button>
```

---

### Screen Reader Context

**Provide full context when using abbreviated text or icons:**

```html
<!-- Icon-only button with accessible label -->
<button type="button" bitIconButton="bwi-download" [label]="'downloadCSV' | i18n">
  <!-- Label provides screen reader context -->
</button>

<!-- Abbreviated text with full aria-label -->
<button [attr.aria-label]="'Mark ' + count + ' applications as critical'">
  <span class="tw-hidden sm:tw-inline">Mark Critical ({{ count }})</span>
  <span class="tw-inline sm:tw-hidden">Mark</span>
</button>
```

---

### Avoid Hiding Interactive Content

**Never use `tw-hidden lg:tw-block` on buttons, links, or form inputs.**

```html
<!-- ❌ BAD: Hides functionality on mobile -->
<button class="tw-hidden lg:tw-block">Important Action</button>

<!-- ✅ GOOD: Shows on all screens, responsive sizing -->
<button class="tw-w-full lg:tw-w-auto">Important Action</button>

<!-- ✅ GOOD: Only hide decorative/supplementary content -->
<img class="tw-hidden lg:tw-block" src="decorative.png" aria-hidden="true" />
```

---

## Testing Responsive Layouts

### Chrome DevTools Device Toolbar

**Keyboard Shortcut:** `Ctrl+Shift+M` (Windows/Linux) or `Cmd+Shift+M` (Mac)

**Steps:**

1. Open DevTools (`F12` or `Cmd+Option+I`)
2. Toggle device toolbar (`Ctrl+Shift+M`)
3. Select device or enter custom dimensions
4. Test at key breakpoints

---

### Key Breakpoints to Test

Test layouts at these specific widths:

| Width  | Device            | Breakpoint       | What to Check                                                |
| ------ | ----------------- | ---------------- | ------------------------------------------------------------ |
| 375px  | iPhone 12/13      | Mobile (default) | Vertical stacking, full-width elements, no horizontal scroll |
| 640px  | Large phones      | `sm:` boundary   | Button groups horizontal, text size increases                |
| 768px  | iPad              | `md:` boundary   | Major layout change (vertical → horizontal)                  |
| 1024px | iPad Pro / Laptop | `lg:` boundary   | Desktop layout, show/hide content transitions                |
| 1440px | Desktop           | Large screen     | Ensure max-width constraints, appropriate spacing            |

---

### Visual Verification Checklist

For each breakpoint:

- [ ] **No horizontal scroll** - Page content fits within viewport
- [ ] **No overlapping elements** - All content is readable and clickable
- [ ] **Adequate spacing** - Elements have breathing room (not cramped)
- [ ] **Text remains readable** - Font sizes are appropriate for screen size
- [ ] **Touch targets are 44x44px minimum** - Buttons are easily clickable on mobile
- [ ] **Smooth transitions** - Layout adapts gracefully between breakpoints

---

### Functional Testing

- [ ] All interactive elements remain clickable
- [ ] Forms are usable on mobile (inputs don't zoom, keyboard doesn't cover content)
- [ ] Modals/dialogs work correctly on small screens
- [ ] Dropdown menus don't overflow viewport
- [ ] Tab/keyboard navigation works at all breakpoints

---

### Automated Testing with Storybook

**Create stories for each breakpoint:**

```typescript
export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};

export const Desktop: Story = {
  parameters: {
    viewport: { defaultViewport: "desktop" },
  },
};
```

**Chromatic captures screenshots at all viewports for visual regression testing.**

---

### Cross-Browser Testing

Responsive layouts should be tested in:

- [ ] **Chrome** (primary development browser)
- [ ] **Firefox** (verify Flexbox/Grid behavior)
- [ ] **Safari** (iOS-specific rendering)
- [ ] **Edge** (Windows-specific rendering)

**Test on actual mobile devices when possible** (iOS Safari, Android Chrome).

---

## Examples from Codebase

### Example 1: Empty State Card (Comprehensive Responsive Component)

**File:** [`empty-state-card.component.html`](../../../../../../../bitwarden_license/bit-web/src/app/dirt/access-intelligence/empty-state-card.component.html)

**Patterns Used:**

- Flex direction change: `tw-flex-col lg:tw-flex-row`
- Responsive padding: `tw-p-6 sm:tw-p-8`
- Responsive text sizes: `tw-text-lg sm:tw-text-xl`
- Responsive gaps: `tw-gap-4 sm:tw-gap-5`
- Hide/show content: `tw-hidden lg:tw-block` and `tw-flex lg:tw-hidden`
- Responsive element sizing: `tw-size-48 sm:tw-size-64`

**Key Snippet:**

```html
<div class="tw-flex tw-flex-col lg:tw-flex-row tw-gap-6">
  <!-- Left Content: Always visible -->
  <div class="tw-flex-1 tw-flex tw-flex-col tw-gap-4 sm:tw-gap-5">
    <div class="tw-text-lg sm:tw-text-xl">{{ title() }}</div>
  </div>

  <!-- Desktop Video/Image (large size) -->
  <div class="tw-hidden lg:tw-block">
    <div class="tw-size-64 xl:tw-size-80">
      <video class="tw-size-full"></video>
    </div>
  </div>

  <!-- Mobile/Tablet Video/Image (smaller size) -->
  <div class="tw-flex lg:tw-hidden tw-justify-center">
    <div class="tw-size-48 sm:tw-size-64">
      <video class="tw-size-full"></video>
    </div>
  </div>
</div>
```

---

### Example 2: All Activity Grid (Responsive Grid Layout)

**File:** [`all-activity-v2.component.html`](../../../../../../../bitwarden_license/bit-web/src/app/dirt/access-intelligence/v2/all-activity-v2.component.html)

**Patterns Used:**

- Grid responsive columns: `tw-grid-cols-1 md:tw-grid-cols-2 lg:tw-grid-cols-3`
- Dynamic column spanning: `[ngClass]="{ 'md:tw-col-span-2': condition }"`

**Key Snippet:**

```html
<ul class="tw-inline-grid tw-grid-cols-1 md:tw-grid-cols-2 lg:tw-grid-cols-3 tw-gap-6">
  <!-- Featured card spans 2 columns on tablet+ -->
  <li class="tw-col-span-1" [ngClass]="{ 'md:tw-col-span-2 lg:tw-col-span-2': isFeatured }">
    <app-featured-card></app-featured-card>
  </li>

  <!-- Regular cards -->
  <li class="tw-col-span-1">
    <app-card></app-card>
  </li>
</ul>
```

**Behavior:**

- Mobile: 1 column grid
- Tablet: 2 columns (featured card spans both)
- Desktop: 3 columns (featured card spans 2 of 3)

---

### Example 3: Applications Toolbar (Complete Responsive Toolbar)

**File:** [`applications-v2.component.html`](../../../../../../../bitwarden_license/bit-web/src/app/dirt/access-intelligence/v2/applications-v2.component.html)

**Patterns Used:**

- Flex direction change: `tw-flex-col md:tw-flex-row`
- Responsive widths: `tw-w-full md:tw-min-w-64 lg:tw-min-w-96`
- Responsive button groups: `tw-flex-col sm:tw-flex-row`
- Responsive buttons: `tw-w-full sm:tw-w-auto`
- Responsive gaps: `tw-gap-3 sm:tw-gap-4`

**Key Snippet:**

```html
<div class="tw-flex tw-flex-col tw-gap-4 tw-mb-4 md:tw-flex-row md:tw-items-center">
  <!-- Search: Full width mobile, constrained desktop -->
  <bit-search class="tw-w-full md:tw-min-w-64 lg:tw-min-w-96 lg:tw-w-1/2" />

  <!-- Filter: Full width mobile, auto width desktop -->
  <bit-chip-select class="tw-w-full md:tw-min-w-48 md:tw-w-auto" />

  <!-- Button Group: Vertical mobile, horizontal small+, right-aligned tablet+ -->
  <div
    class="tw-flex tw-flex-col tw-gap-3 tw-w-full sm:tw-flex-row sm:tw-gap-4 md:tw-ml-auto md:tw-w-auto"
  >
    <button class="tw-w-full sm:tw-w-auto">Action 1</button>
    <button class="tw-w-full sm:tw-w-auto">Action 2</button>
  </div>
</div>
```

**Behavior:**

- **Mobile (< 640px):** Vertical stack, all elements full width
- **Small (640px - 767px):** Search/filter still full width, buttons horizontal
- **Tablet (768px+):** All elements horizontal, buttons pushed right
- **Desktop (1024px+):** Search gets larger minimum width (384px)

---

## Summary

**Core Principles:**

1. ✅ **Mobile-first:** Write base styles for mobile, enhance for larger screens
2. ✅ **Use `md:` for major layout changes** (vertical → horizontal)
3. ✅ **Maintain logical focus order** at all breakpoints
4. ✅ **Ensure 44x44px touch targets** on mobile (WCAG 2.1 AA)
5. ✅ **Test at key breakpoints:** 375px, 640px, 768px, 1024px, 1440px
6. ✅ **Never hide interactive content** on smaller screens
7. ✅ **Provide full screen reader context** for abbreviated text/icons

**Common Class Patterns:**

- Direction: `tw-flex-col md:tw-flex-row`
- Widths: `tw-w-full md:tw-w-auto`
- Grids: `tw-grid-cols-1 md:tw-grid-cols-2 lg:tw-grid-cols-3`
- Hide/Show: `tw-hidden lg:tw-block` (decorative only)
- Buttons: `tw-w-full sm:tw-w-auto`
- Gaps: `tw-gap-4 sm:tw-gap-5 lg:tw-gap-6`

**When in doubt:** Test at 375px and 768px first - these cover most mobile and tablet devices.
