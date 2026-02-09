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

### Available Methods

#### `exportSession(format?: 'json' | 'summary' | 'console')`
Exports the current debug session in the specified format.

```javascript
// Export as JSON (default)
const data = __BITWARDEN_AUTOFILL_DEBUG__.exportSession('json');
console.log(JSON.parse(data));

// Export as human-readable summary
console.log(__BITWARDEN_AUTOFILL_DEBUG__.exportSession('summary'));

// Output to console with pretty formatting
__BITWARDEN_AUTOFILL_DEBUG__.exportSession('console');
```

#### `exportSummary()`
Returns a human-readable summary of the most recent session.

```javascript
console.log(__BITWARDEN_AUTOFILL_DEBUG__.exportSummary());
```

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
console.log('Active sessions:', sessions);
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
  "sessionId": "session_1234567890_abc123",
  "startTime": 1234567890000,
  "endTime": 1234567891000,
  "url": "https://example.com/login",
  "qualifications": [
    {
      "fieldId": "opid_12345",
      "elementSelector": "input[type='text']#username",
      "attempts": [
        {
          "attemptId": "attempt_1234567890_xyz789",
          "timestamp": 1234567890500,
          "vector": "inline-menu",
          "result": {
            "result": true,
            "conditions": {
              "pass": [
                {
                  "name": "isUsernameField",
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
          "triggeredBy": "page-load"
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
Session ID: session_1234567890_abc123
URL: https://example.com/login
Start Time: 2026-02-06T12:00:00.000Z
End Time: 2026-02-06T12:00:01.000Z
Duration: 1.00s

Total Fields Qualified: 2

--------------------------------------------------------------------------------
Field ID: opid_12345
Selector: input[type='text']#username
Attempts: 1
Final Decision: ✅ QUALIFIED

Passed Conditions:
  ✓ isUsernameField
  ✓ notCurrentlyInSandboxedIframe

Vector: inline-menu
Timestamp: 2026-02-06T12:00:00.500Z

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

Example: For a complex qualification, captures:
- `isFieldForLoginForm` (top level)
- `isUsernameFieldForLoginForm` (precondition)
- `isUsernameField` (precondition of precondition)
- ... (and so on)

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

## Troubleshooting Common Issues

### Debug API Not Available
```javascript
typeof window.__BITWARDEN_AUTOFILL_DEBUG__ === 'undefined'
```

**Solution**: Verify that:
1. Dev flag is set correctly in `.env.development`
2. Extension was rebuilt after setting the flag
3. You're on a page where autofill is active (not a chrome:// or browser settings page)

### No Sessions Found
```javascript
__BITWARDEN_AUTOFILL_DEBUG__.getSessions() // returns []
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
   const json = __BITWARDEN_AUTOFILL_DEBUG__.exportSession('json');
   // Save to file or analyze
   ```

## Future Enhancements

Planned features (not yet implemented):
- Visual debug panel UI in popup/options
- Download JSON button
- Copy to clipboard functionality
- JSON-DSL representation of conditions
- Filter by field type or qualification result
- Session replay/comparison
