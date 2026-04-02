# Autofill Debug Mode

This document describes how to use the autofill debug mode for troubleshooting field qualification issues.

## Enabling Debug Mode

1. Set the dev flag in your `.env.development` file:

   ```
   DEV_FLAGS={"autofillDebugMode": true}
   ```

2. Rebuild the browser extension:

   ```bash
   npm run build:watch
   ```

3. Load the extension in your browser (or reload if already loaded)

## Using Debug Mode

When debug mode is enabled, the browser console will display:

```
[Bitwarden Debug] Autofill debug mode enabled. Use window.__BITWARDEN_AUTOFILL_DEBUG__
```

### Right-Click Context Menu (Easiest Path)

With debug mode enabled, right-clicking any element on the page reveals a **[Debug] Copy autofill debug info** item in the Bitwarden context menu. Clicking it copies a plain-text summary of all field qualification decisions for the current page to your clipboard.

This summary includes:

- All fields that were evaluated (both qualified and rejected)
- Why each field passed or failed each condition
- Human-readable explanations and fix suggestions for failures

Paste the copied text directly into a support ticket or bug report. Field values are never captured.

### Console API

#### `exportSession(format?: 'json' | 'summary' | 'console')`

Exports the current debug session in the specified format.

```javascript
// Export as JSON (default)
const data = __BITWARDEN_AUTOFILL_DEBUG__.exportSession("json");
console.log(JSON.parse(data));

// Export as human-readable summary
console.log(__BITWARDEN_AUTOFILL_DEBUG__.exportSession("summary"));

// Output to console with pretty formatting
__BITWARDEN_AUTOFILL_DEBUG__.exportSession("console");
```

#### `exportSummary()`

Returns a human-readable summary of the most recent session.

```javascript
console.log(__BITWARDEN_AUTOFILL_DEBUG__.exportSummary());
```

#### `startSession(name?: string)`

Starts a new debug session, optionally with a stable name for diffing.

Named sessions produce deterministic, timestamp-prefixed IDs — useful for comparing the same page across different deploys or configurations:

```javascript
// Named session: session_2026-02-19T12-00-00-000Z_login-form-test
__BITWARDEN_AUTOFILL_DEBUG__.startSession("login-form-test");

// Anonymous session: session_2026-02-19T12-00-00-000Z_ab3f2
__BITWARDEN_AUTOFILL_DEBUG__.startSession();
```

The ISO timestamp prefix means sessions sort naturally by date, enabling meaningful diffs between weekly deploys.

#### `setTracingDepth(depth: number)`

Configures how deep to trace precondition qualifiers.

```javascript
// Don't trace preconditions (faster, less data)
__BITWARDEN_AUTOFILL_DEBUG__.setTracingDepth(0);

// Trace immediate preconditions only (default)
__BITWARDEN_AUTOFILL_DEBUG__.setTracingDepth(1);

// Trace full precondition chain (more detail)
__BITWARDEN_AUTOFILL_DEBUG__.setTracingDepth(2);
```

#### `getTracingDepth()`

Returns the current tracing depth.

```javascript
const depth = __BITWARDEN_AUTOFILL_DEBUG__.getTracingDepth();
console.log(`Current tracing depth: ${depth}`);
```

#### `getSessions()`

Returns an array of all session IDs in memory.

```javascript
const sessions = __BITWARDEN_AUTOFILL_DEBUG__.getSessions();
console.log("Active sessions:", sessions);
```

## Enhanced Console Logging

When debug mode is enabled, the console automatically displays enhanced qualification messages:

### Field Qualified

```
✅ Field Qualified: opid_12345
  Field: <input type="text" ...>
  Passed conditions: ["notCurrentlyInSandboxedIframe", "isVisibleFormField", ...]
  All responses: [...]
```

### Field Rejected

```
❌ Field Rejected: opid_12345
  Field: <input type="text" ...>
  Blocking condition failed: isNotDisabledField
  Message: field is disabled
  All responses: [...]
```

## Understanding Debug Output

### JSON Export Structure

```json
{
  "sessionId": "session_2026-02-19T12-00-00-000Z_abc12",
  "startTime": 1234567890000,
  "endTime": 1234567891000,
  "url": "https://example.com/login",
  "qualifications": [
    {
      "fieldId": "opid_12345",
      "elementSelector": "#username",
      "attempts": [
        {
          "attemptId": "attempt_2026-02-19T12-00-00-500Z",
          "timestamp": 1234567890500,
          "vector": "inline-menu",
          "result": {
            "result": true,
            "conditions": {
              "pass": [
                {
                  "name": "isUsernameField",
                  "description": "Field is recognized as a username or email input",
                  "functionSource": "function isUsernameField(field) { ... }"
                }
              ],
              "fail": []
            },
            "meta": {
              "timestamp": 1234567890500,
              "vector": "inline-menu",
              "fieldSnapshot": {
                "opid": "opid_12345",
                "type": "text",
                "value": "[REDACTED]"
              },
              "tracingDepth": 0
            }
          },
          "triggeredBy": "setupOverlayListeners"
        }
      ],
      "finalDecision": { ... }
    }
  ]
}
```

### Summary Export Structure

```
================================================================================
Bitwarden Autofill Debug Summary
================================================================================
Session ID: session_2026-02-19T12-00-00-000Z_abc12
URL: https://example.com/login
Start Time: 2026-02-19T12:00:00.000Z
End Time: 2026-02-19T12:00:01.000Z
Duration: 1.00s

Total Fields Qualified: 2

--------------------------------------------------------------------------------
Field ID: opid_12345
Selector: #username
Attempts: 1
Final Decision: ✅ QUALIFIED

Passed Conditions:
  ✓ notCurrentlyInSandboxedIframe — Field is not in a sandboxed iframe
  ✓ isUsernameField — Field is recognized as a username or email input

--------------------------------------------------------------------------------
Field ID: opid_67890
Selector: [name="search"]
Attempts: 1
Final Decision: ❌ REJECTED

Passed Conditions:
  ✓ notCurrentlyInSandboxedIframe
Failed Conditions:
  ✗ fieldIsForLoginForm — Field is part of a login form
    → Fix: Add autocomplete="username" or autocomplete="email" to the field

================================================================================
⚠️  WARNING: This debug data may contain sensitive information.
Do not share this data publicly or with untrusted parties.
================================================================================
```

## Autofill Vectors

Debug data tracks which autofill vector triggered the qualification:

- **inline-menu**: Inline menu (autofill button) shown on field focus
- **popup-autofill**: Autofill triggered from popup UI
- **context-menu**: Autofill triggered from browser context menu
- **keyboard-shortcut**: Autofill triggered by keyboard shortcut (Ctrl+Shift+L)
- **page-load**: Autofill triggered automatically on page load

### Architectural Reality

All 4 entry points (inline menu, popup, keyboard shortcut, context menu) ultimately call the same fill path in the background service worker: `autofillService.doAutoFill()` → `generateFillScript()`. They use the same core logic and do not bypass each other.

However, there are **two distinct qualification systems**:

| System                                | Used by                  | Where it runs             |
| ------------------------------------- | ------------------------ | ------------------------- |
| `InlineMenuFieldQualificationService` | Inline menu overlay only | Content script            |
| `generateFillScript()` field matching | All 4 entry points       | Background service worker |

The `InlineMenuFieldQualificationService` is used exclusively to decide **whether to show the overlay icon on a given field**. The debug session records only this decision. The actual fill logic uses simpler, independent field detection in the background.

This means:

- A field _rejected_ by inline menu qualification (no overlay shown) may still be _filled_ by keyboard shortcut or context menu, because the two qualification systems use different criteria.
- A field _accepted_ by inline menu qualification may fail to fill if `generateFillScript()` doesn't match it.

### Why Other Vectors Are Not Tracked

The debug service lives in the content script inside `AutofillOverlayContentService`. The popup, keyboard shortcut, and context menu flows run entirely in the background service worker and only send the rendered fill script to the content script — they never invoke the content script's qualification service. There is no point in those paths where the current vector can be set.

To track those vectors would require:

1. A new message from the background to the content script announcing "autofill was triggered via [vector]"
2. The content script debug service recording it against the current session

This is tracked as future work.

## Precondition Tracing

Some qualification functions depend on other qualifiers (preconditions). For example:

- `isNewPasswordField` depends on `isPasswordField`
- `isCurrentPasswordField` depends on `isPasswordField`

The tracing depth controls how deep to capture these dependencies:

### Depth = 0 (No Tracing)

Only captures the top-level condition result. Fastest, minimal data.

### Depth = 1 (Immediate Preconditions) - Default

Captures the direct preconditions of the qualification.

Example: For `isNewPasswordField`, captures:

- `isNewPasswordField` (top level)
- `isPasswordField` (immediate precondition)

### Depth = 2+ (Full Chain)

Captures the entire chain of preconditions recursively.

## Performance Impact

- **Debug Disabled**: Zero performance overhead
- **Debug Enabled (depth 0)**: ~1-2ms per field qualification
- **Debug Enabled (depth 1)**: ~2-3ms per field qualification
- **Debug Enabled (depth 2+)**: ~3-5ms per field qualification

## Data Retention

- Sessions are stored **in-memory only** (never persisted to disk)
- Sessions automatically expire after **5 minutes**
- Maximum **100 qualifications per session** to prevent memory issues
- Field values are **always redacted** (`[REDACTED]`) to prevent PII leakage

## Security Considerations

⚠️ **Never share debug output publicly or with untrusted parties**

While field values are redacted, debug output still contains:

- Page URLs
- Field IDs, names, and attributes
- Form structure
- Qualification logic (function source code)

This information could be used to identify:

- Internal applications
- Custom form fields
- Business logic patterns

## QA / Regression Workflow

Use named sessions for deterministic, diffable output across deployments:

```javascript
// Before a deploy
__BITWARDEN_AUTOFILL_DEBUG__.startSession("checkout-form-baseline");
// Focus fields on the page to trigger qualification
const before = __BITWARDEN_AUTOFILL_DEBUG__.exportSession("json");

// After a deploy
__BITWARDEN_AUTOFILL_DEBUG__.startSession("checkout-form-after-deploy");
// Focus same fields
const after = __BITWARDEN_AUTOFILL_DEBUG__.exportSession("json");

// Diff — attempt IDs and timestamps in conditions are stable; only real changes show up
```

Session IDs use ISO timestamps (`session_2026-02-19T12-00-00-000Z_name`) so they sort naturally and identify when each capture was taken.

## Troubleshooting Common Issues

### Debug API Not Available

```javascript
typeof window.__BITWARDEN_AUTOFILL_DEBUG__ === "undefined";
```

**Solution**: Verify that:

1. Dev flag is set correctly in `.env.development`
2. Extension was rebuilt after setting the flag
3. You're on a page where autofill is active (not a chrome:// or browser settings page)

### No Sessions Found

```javascript
__BITWARDEN_AUTOFILL_DEBUG__.getSessions(); // returns []
```

**Solution**:

1. Focus a form field to trigger qualification
2. Sessions expire after 5 minutes - check timing
3. Verify debug mode is enabled (check console for initialization message)

### Missing Precondition Data

```javascript
// result.meta.preconditions is undefined
```

**Solution**: Increase tracing depth:

```javascript
__BITWARDEN_AUTOFILL_DEBUG__.setTracingDepth(2);
```

### Empty qualifications Array in Export

If `exportSession('json')` shows `"qualifications": []`, the session captured no field evaluations.

**Solution**: The session may have started after fields were already evaluated. Either:

1. Start a named session before navigating: `startSession('my-test')` — then navigate to the page
2. Or refresh the page after enabling debug mode so all fields are re-evaluated

## Example Workflow

1. Enable debug mode and rebuild extension
2. Navigate to the problematic login page
3. Open browser DevTools console
4. Focus the form field in question
5. Check console for qualification messages
6. Export detailed data:
   ```javascript
   const summary = __BITWARDEN_AUTOFILL_DEBUG__.exportSummary();
   console.log(summary);
   ```
7. If needed, increase tracing depth for more detail:
   ```javascript
   __BITWARDEN_AUTOFILL_DEBUG__.setTracingDepth(2);
   ```
8. Focus the field again to capture with higher depth
9. Export and analyze:
   ```javascript
   const json = __BITWARDEN_AUTOFILL_DEBUG__.exportSession("json");
   // Save to file or analyze
   ```
