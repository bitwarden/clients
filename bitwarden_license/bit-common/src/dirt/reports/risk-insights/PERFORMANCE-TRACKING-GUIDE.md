# Risk Insights Report Generation - Performance Tracking Guide

This guide explains how to track performance and memory usage when generating Risk Insights reports with large datasets.

## Overview

Performance tracking has been integrated into:

- **RiskInsightsOrchestratorService**: Core report generation pipeline
- **RiskInsightsDataService**: User-triggered actions
- **PerformanceTracker**: Utility for consistent timing measurements

## Using Firefox DevTools

### 1. Open DevTools Before Testing

**Steps:**

1. Open your application in Firefox
2. Press `F12` or right-click → "Inspect"
3. Navigate to the Risk Insights report page (but don't click "Run Report" yet)

### 2. Filter Console Output (Important!)

Your app likely logs many unrelated messages (VaultTimeoutSettingsService, etc.). Here's how to filter:

**Console Tab - Filter Box:**

1. Look for the **"Filter output"** text box at the top of the Console tab
2. To see ONLY performance logs, type: `Performance`
3. Alternative patterns:
   - `Performance|RiskInsights` - Show performance OR risk insights logs
   - `-VaultTimeout` - Hide all VaultTimeout logs (the minus excludes them)
   - `🔵|🟢|🟡|🔴|📊|📈` - Show only emoji-tagged performance logs

**Recommended filter for your testing:**

```
Performance
```

This will filter out all the VaultTimeoutSettingsService spam and show only the performance tracking logs.

**Before filtering:**

```
[VaultTimeoutSettingsService] Current vault timeout is never...
🔵 [Performance] report-generation-total - START
[VaultTimeoutSettingsService] Current vault timeout is never...
[SomeOtherService] Debug info...
🟢 [Performance] fetch-member-ciphers - COMPLETE
[VaultTimeoutSettingsService] Current vault timeout is never...
```

**After filtering with "Performance":**

```
🔵 [Performance] report-generation-total - START
🟢 [Performance] fetch-member-ciphers - COMPLETE
📊 [Performance] Data Size - Raw Member Ciphers
🔵 [Performance] flatten-member-details - START
...
```

Much cleaner!

### 3. Enable Memory Profiling

**Console Tab:**

- With filter applied, you'll see clean real-time performance logs

### 5. Optional: Performance Tab (for detailed profiling)

**Performance Tab:**

1. Go to the "Performance" tab
2. Click the record button (🔴) to start profiling
3. Click "Run Report" in your UI
4. Wait for the report to complete
5. Stop recording
6. Analyze the flame graph and timeline

### 6. Optional: Memory Tab (for memory leaks/usage)

**Memory Tab:**

1. Go to the "Memory" tab
2. Take a snapshot BEFORE clicking "Run Report" (baseline)
3. Click "Run Report"
4. Wait for completion
5. Take another snapshot AFTER report completes
6. Compare the two snapshots to see memory growth

### 4. Reading the Console Output

After applying the `Performance` filter and clicking "Run Report", you'll see clean logs like this:

```
🚀 [RiskInsights] Report generation triggered by user
🔵 [Performance] report-generation-total - START
🔵 [Performance] fetch-member-ciphers - START
🟢 [Performance] fetch-member-ciphers - COMPLETE
   duration: 1234.56ms
   durationSeconds: 1.23s
📊 [Performance] Data Size - Raw Member Ciphers
   count: 5000
🔵 [Performance] flatten-member-details - START
🟢 [Performance] flatten-member-details - COMPLETE
   duration: 234.56ms
...
═══════════════════════════════════════════════════════════
📈 [Performance] REPORT GENERATION SUMMARY
═══════════════════════════════════════════════════════════
  🔴 audit-password-leaks                    45234.50ms (45.23s)
  🟡 calculate-risk-scores                    3456.78ms (3.46s)
  🟡 fetch-member-ciphers                     2345.67ms (2.35s)
  🟢 build-cipher-health-reports               987.65ms (0.99s)
  🟢 flatten-member-details                    456.78ms (0.46s)
  ...
────────────────────────────────────────────────────────────
  💯 TOTAL                                   58234.50ms (58.23s)
═══════════════════════════════════════════════════════════
```

**Color coding:**

- 🔴 Red: Operations taking > 5 seconds (potential bottlenecks)
- 🟡 Yellow: Operations taking 2-5 seconds (moderate time)
- 🟢 Green: Operations taking < 2 seconds (acceptable)

**Data size logs:**

- 📊 Shows how many items are being processed at each stage
- Helps identify cartesian product issues (e.g., if "Member Cipher Relationships" is unexpectedly large)

## Key Metrics to Watch

### Performance Bottlenecks

Look for these operations in the summary:

1. **`audit-password-leaks`** - API calls to check password exposures
   - Expected: Linear with number of unique passwords
   - Issue: If this is very slow, may need batching improvements

2. **`flatten-member-details`** - Flattening member-cipher relationships
   - Expected: Linear with total member-cipher pairs
   - Issue: If much longer than fetch, potential cartesian product

3. **`calculate-risk-scores`** - Computing application risk scores
   - Expected: Linear with number of applications
   - Issue: If slow, may be complex aggregation logic

4. **`build-cipher-health-reports`** - Associating members with ciphers
   - Expected: Linear with ciphers × average members per cipher
   - Issue: If much slower than expected, potential N² algorithm

### Memory Usage (Firefox Memory Tab)

**Before/After Comparison:**

1. Check "Heap snapshot" size difference
2. Look for:
   - **Arrays**: Large arrays might indicate cartesian products
   - **Objects**: Unexpected object counts
   - **Strings**: Duplicated string data

**Common Issues:**

- Memory grows by > 500MB: Likely cartesian product or data duplication
- Memory doesn't release after report: Potential memory leak
- Large array allocations: Check Member Cipher relationships count

## Analyzing Results with Large Datasets

### Example Scenario: 1000 users, 500 groups, 10k ciphers

**Expected counts:**

- Organization Ciphers: ~10,000
- Member Cipher Relationships: ~50,000 to 100,000 (depends on group structure)
- Valid Ciphers: ~8,000 to 10,000 (after filtering non-login items)
- Unique Members: ~1,000
- Application Reports: ~500 to 2,000 (depends on unique applications)

**Red Flags:**

- Member Cipher Relationships > 500,000: **Cartesian product issue**
- audit-password-leaks > 60s: Network/API bottleneck
- flatten-member-details > 5s: Inefficient flattening algorithm
- Memory growth > 1GB: Data structure inefficiency

## Using the Performance API (Advanced)

The tracker also integrates with the native Performance API. After running a report:

1. Open the Console
2. Type: `performance.getEntriesByType('measure')`
3. Press Enter

You'll see an array of performance measurements with detailed timing data:

```javascript
[
  {
    name: "risk-insights:fetch-member-ciphers",
    entryType: "measure",
    startTime: 123.45,
    duration: 1234.56
  },
  ...
]
```

## Exporting Data for Analysis

To save the performance measurements for external analysis:

```javascript
// In Firefox Console after report completes:
const measurements = performance
  .getEntriesByType("measure")
  .filter((m) => m.name.startsWith("risk-insights:"))
  .map((m) => ({ name: m.name, duration: m.duration }));

console.table(measurements);
copy(measurements); // Copies JSON to clipboard
```

Then paste into a spreadsheet or analysis tool.

## Memory Profiling Tips

### Taking Effective Snapshots

1. **Baseline**: Take snapshot on page load
2. **After Load**: After navigating to Risk Insights (before running report)
3. **During Generation**: Mid-report (if possible)
4. **After Completion**: Immediately after report finishes
5. **After GC**: Click "Collect garbage" button, then take another snapshot

### Comparing Snapshots

In the Memory tab:

1. Select snapshot 2 (After Completion)
2. Change view to "Comparison"
3. Select baseline snapshot
4. Sort by "Size Delta" to find largest memory increases
5. Look for:
   - Unexpected object retention
   - Large array allocations
   - Duplicated data structures

## Troubleshooting Common Issues

### Issue: Browser becomes unresponsive during report generation

**Symptoms:** UI freezes, tab shows "not responding"
**Likely cause:** Synchronous operations blocking the main thread
**Check:** Look for operations taking > 10s in the summary

### Issue: Memory keeps growing even after report completes

**Symptoms:** Firefox Memory shows increasing heap size
**Likely cause:** Memory leak (subscriptions, closures holding references)
**Check:** Compare snapshots 5 minutes apart after report completion

### Issue: Report generation takes exponentially longer with more users

**Symptoms:** 100 users = 5s, 1000 users = 500s (should be ~50s)
**Likely cause:** O(n²) algorithm or cartesian product
**Check:** "Member Cipher Relationships" count vs expected

## Next Steps for Optimization

Based on your profiling results:

1. **If `audit-password-leaks` is slow**: Consider batching or caching
2. **If `flatten-member-details` is slow**: Review the flattening algorithm
3. **If memory grows excessively**: Check for data duplication, use Set/Map for deduplication
4. **If `calculate-risk-scores` is slow**: Consider web workers for parallel processing
5. **If overall time scales poorly**: Profile individual helper functions (buildPasswordUseMap, getUniqueMembers, etc.)

## Cleaning Up

After you're done profiling, you can:

- Remove the performance tracking code
- Or keep it behind a feature flag for production debugging

The performance tracking code is isolated in:

- `performance-tracker.ts` - Can be deleted
- `risk-insights-orchestrator.service.ts` - Remove `_performanceTracker` usage
- `risk-insights-data.service.ts` - Remove console.log
