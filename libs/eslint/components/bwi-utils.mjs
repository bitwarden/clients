/** Matches any bwi class: the bare "bwi" base class or "bwi-<name>" variants. */
export const BWI_CLASS_RE = /\bbwi(?:-[\w-]+)?\b/g;

/**
 * Helper / utility classes from libs/angular/src/scss/bwicons/styles/style.scss.
 * These don't represent icon names and can be used independently.
 */
export const BWI_HELPER_CLASSES = new Set([
  "bwi-fw", // Fixed width
  "bwi-sm", // Small
  "bwi-lg", // Large
  "bwi-2x", // 2x size
  "bwi-3x", // 3x size
  "bwi-4x", // 4x size
  "bwi-spin", // Spin animation
  "bwi-ul", // List
  "bwi-li", // List item
  "bwi-rotate-270", // Rotation
]);

/**
 * Extract the icon name from a class string.
 * Returns the first bwi-* class that is not a helper class and not the bare "bwi" base class.
 * Returns null if no single icon name can be determined.
 */
export function extractIconNameFromClassValue(classValue) {
  const bwiClasses = classValue.match(BWI_CLASS_RE) || [];
  const iconNames = bwiClasses.filter((cls) => cls !== "bwi" && !BWI_HELPER_CLASSES.has(cls));
  return iconNames.length === 1 ? iconNames[0] : null;
}
