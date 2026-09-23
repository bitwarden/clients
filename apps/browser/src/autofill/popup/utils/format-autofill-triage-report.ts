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
  lines.push(`Analyzed: ${result.analyzedAt.toISOString()}`);

  // Version Information
  lines.push("");
  lines.push("Version Information:");
  lines.push(`  Extension Version: ${result.extensionVersion}`);
  lines.push(`  Browser: ${result.browserInfo.name} ${result.browserInfo.version}`);

  // Page Context
  if (result.pageContext) {
    lines.push("");
    lines.push("Page Information:");
    lines.push(`  Title: ${result.pageContext.title}`);
    lines.push(`  Document URL: ${result.pageContext.documentUrl}`);
    lines.push(`  Total Forms: ${result.pageContext.totalForms}`);
    lines.push(`  Total Fields: ${result.pageContext.totalFields}`);
    const collectionDate = new Date(result.pageContext.collectedTimestamp);
    lines.push(`  Collected At: ${collectionDate.toISOString()}`);
  }

  // Calculate eligible count
  const eligibleCount = result.fields.filter((f: { eligible: boolean }) => f.eligible).length;
  lines.push("");
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

    // Field State
    lines.push(`  Field State:`);
    lines.push(`    Viewable: ${field.viewable !== false ? "Yes" : "No"}`);
    lines.push(`    Readonly: ${field.readonly ? "Yes" : "No"}`);
    lines.push(`    Disabled: ${field.disabled ? "Yes" : "No"}`);
    if (field.ariaHidden !== undefined) {
      lines.push(`    ARIA Hidden: ${field.ariaHidden ? "Yes" : "No"}`);
    }
    if (field.ariaDisabled !== undefined) {
      lines.push(`    ARIA Disabled: ${field.ariaDisabled ? "Yes" : "No"}`);
    }

    // Element Metadata
    if (field.tagName || field.elementNumber !== undefined || field.htmlClass) {
      lines.push(`  Element Metadata:`);
      if (field.tagName) {
        lines.push(`    Tag Name: ${field.tagName}`);
      }
      if (field.elementNumber !== undefined) {
        lines.push(`    Element Position: #${field.elementNumber}`);
      }
      if (field.htmlClass) {
        lines.push(`    CSS Classes: ${field.htmlClass}`);
      }
      if (field.title) {
        lines.push(`    Title: ${field.title}`);
      }
      if (field.tabindex) {
        lines.push(`    Tabindex: ${field.tabindex}`);
      }
      if (field.maxLength !== undefined) {
        lines.push(`    Max Length: ${field.maxLength}`);
      }
    }

    // Label Context
    if (field.labelLeft || field.labelRight || field.labelTag || field.labelTop) {
      lines.push(`  Label Context:`);
      if (field.labelLeft) {
        lines.push(`    Label Left: "${field.labelLeft}"`);
      }
      if (field.labelRight) {
        lines.push(`    Label Right: "${field.labelRight}"`);
      }
      if (field.labelTag) {
        lines.push(`    Label Tag: "${field.labelTag}"`);
      }
      if (field.labelTop) {
        lines.push(`    Label Top: "${field.labelTop}"`);
      }
    }

    // Form Context
    if (field.formContext) {
      lines.push(`  Form Information:`);
      if (field.formContext.htmlId) {
        lines.push(`    Form ID: ${field.formContext.htmlId}`);
      }
      if (field.formContext.htmlName) {
        lines.push(`    Form Name: ${field.formContext.htmlName}`);
      }
      if (field.formContext.htmlAction) {
        lines.push(`    Form Action: ${field.formContext.htmlAction}`);
      }
      if (field.formContext.htmlMethod) {
        lines.push(`    Form Method: ${field.formContext.htmlMethod}`);
      }
      lines.push(`    Fields in Form: ${field.formContext.fieldCount}`);
    }

    // Value and Interaction State
    if (field.valuePreview || field.checked !== undefined || field.selectOptions) {
      lines.push(`  Value & State:`);
      if (field.valuePreview) {
        lines.push(`    Value: ${field.valuePreview}`);
      }
      if (field.checked !== undefined) {
        lines.push(`    Checked: ${field.checked ? "Yes" : "No"}`);
      }
      if (field.selectOptions && field.selectOptions.length > 0) {
        lines.push(`    Select Options: ${field.selectOptions.length} options`);
        lines.push(
          `      Options: ${field.selectOptions.slice(0, 5).join(", ")}${field.selectOptions.length > 5 ? "..." : ""}`,
        );
      }
    }

    // Special Attributes
    if (
      field.dataStripe ||
      field.inlineMenuFillType ||
      field.fieldQualifier ||
      field.accountCreationFieldType ||
      field.rel ||
      field.showPasskeys ||
      field.ariaHasPopup
    ) {
      lines.push(`  Special Attributes:`);
      if (field.dataStripe) {
        lines.push(`    Data-Stripe: ${field.dataStripe}`);
      }
      if (field.inlineMenuFillType) {
        lines.push(`    Inline Menu Fill Type: ${field.inlineMenuFillType}`);
      }
      if (field.fieldQualifier) {
        lines.push(`    Field Qualifier: ${field.fieldQualifier}`);
      }
      if (field.accountCreationFieldType) {
        lines.push(`    Account Creation Field Type: ${field.accountCreationFieldType}`);
      }
      if (field.rel) {
        lines.push(`    Rel: ${field.rel}`);
      }
      if (field.showPasskeys) {
        lines.push(`    Show Passkeys: ${field.showPasskeys}`);
      }
      if (field.ariaHasPopup) {
        lines.push(`    ARIA Has-Popup: ${field.ariaHasPopup}`);
      }
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
export function getFieldLabel(field: {
  htmlId?: string;
  htmlName?: string;
  htmlType?: string;
}): string {
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
