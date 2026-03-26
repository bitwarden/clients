import { AutofillTriagePageResult } from "../../types/autofill-triage";

/**
 * Formats an AutofillTriagePageResult into a human-readable plain text report
 * suitable for copying to clipboard and pasting into support tickets or QA reports.
 *
 * @param result - The triage result to format
 * @returns A formatted plain text string
 */
export function formatAutofillTriageReport(result: AutofillTriagePageResult): string {
  const lines: string[] = [];

  // Header
  lines.push("AutoFill Triage Report");
  lines.push("=".repeat(50));
  lines.push(`URL: ${result.pageUrl}`);
  lines.push(`Analyzed: ${result.analyzedAt}`);

  // Calculate eligible count
  const eligibleCount = result.fields.filter((f: { eligible: boolean }) => f.eligible).length;
  lines.push(`Eligible: ${eligibleCount} of ${result.fields.length} fields`);

  // Target element info if present
  if (result.targetElementRef) {
    lines.push(`Target Element: ${result.targetElementRef}`);
  }

  lines.push(""); // Empty line before fields

  // Format each field
  for (const field of result.fields) {
    const fieldLabel = getFieldLabel(field);
    lines.push(`Field: ${fieldLabel}`);
    lines.push(`  Status: ${field.eligible ? "✅ ELIGIBLE" : "❌ INELIGIBLE"}`);
    lines.push(`  Qualified as: ${field.qualifiedAs}`);

    // Field attributes (only show if present)
    if (field.htmlId) {
      lines.push(`  HTML ID: ${field.htmlId}`);
    }
    if (field.htmlName) {
      lines.push(`  HTML Name: ${field.htmlName}`);
    }
    if (field.htmlType) {
      lines.push(`  HTML Type: ${field.htmlType}`);
    }
    if (field.placeholder) {
      lines.push(`  Placeholder: ${field.placeholder}`);
    }
    if (field.autocomplete) {
      lines.push(`  Autocomplete: ${field.autocomplete}`);
    }
    if (field.ariaLabel) {
      lines.push(`  ARIA Label: ${field.ariaLabel}`);
    }
    if (field.formIndex !== undefined) {
      lines.push(`  Form Index: ${field.formIndex}`);
    }

    // Conditions
    lines.push(`  Conditions:`);
    for (const condition of field.conditions) {
      const conditionIcon = condition.passed ? "✅" : "❌";
      lines.push(`    ${conditionIcon} ${condition.description}`);
    }

    lines.push(""); // Empty line between fields
  }

  return lines.join("\n");
}

/**
 * Gets a human-readable label for a field, falling back through available identifiers.
 */
function getFieldLabel(field: { htmlId?: string; htmlName?: string; htmlType?: string }): string {
  if (field.htmlId) {
    return `${field.htmlId} (${field.htmlType || "unknown type"})`;
  }
  if (field.htmlName) {
    return `${field.htmlName} (${field.htmlType || "unknown type"})`;
  }
  if (field.htmlType) {
    return `(${field.htmlType})`;
  }
  return "(unnamed field)";
}
