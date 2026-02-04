# Access Intelligence Prototype - Testing Guide

## Overview

This prototype uses a **frontend-based approach** to avoid the backend timeout issue you experienced with Risk Insights. Instead of calling one massive backend endpoint that times out, it:

1. Makes **4 separate, smaller API calls** in parallel
2. **Maps ciphers to members on the frontend** using collection relationships
3. Avoids the backend cartesian product issue entirely

## How to Test

### 1. Navigate to Access Intelligence Prototype

**URL Pattern:**

```
http://localhost:8080/#/organizations/{organizationId}/reporting/access-intelligence-prototype
```

**Or from the UI:**

1. Go to your organization
2. Navigate to **Reports** section
3. Look for **"Access Intelligence (Prototype)"** card
4. Click on it

### 2. Open Firefox DevTools BEFORE Running

1. Press `F12` to open DevTools
2. Go to **Console** tab
3. In the filter box at top, type: `Performance`
4. **Optional:** Go to **Performance** tab and click record (🔴)
5. **Optional:** Go to **Memory** tab and take a baseline snapshot

### 3. Run the Analysis

1. Click the **"Analyze Access"** or **"Start"** button on the page
2. Watch the Console for performance logs

### 4. Expected Console Output

You should see logs like:

```
🔵 [Performance] access-intelligence-total - START
🔵 [Performance] load-ciphers - START
🟢 [Performance] load-ciphers - COMPLETE
   duration: 520.50ms
📊 [Performance] Data Size - Organization Ciphers
   count: 5000

🔵 [Performance] health-checks-total - START
🔵 [Performance] load-org-data - START

🟢 [Performance] fetch-collections - COMPLETE
📊 [Performance] Data Size - Collections Loaded
   count: 150

🟢 [Performance] fetch-users-and-groups - COMPLETE
📊 [Performance] Data Size - Users Loaded
   count: 1000
📊 [Performance] Data Size - Groups Loaded
   count: 50

🟢 [Performance] load-org-data - COMPLETE
🔵 [Performance] map-members - START
🟢 [Performance] map-members - COMPLETE
📊 [Performance] Data Size - Ciphers with Member Mappings
   count: 5000

═══════════════════════════════════════════════════════════
📈 [Performance] ACCESS INTELLIGENCE SUMMARY
═══════════════════════════════════════════════════════════
  🟢 load-ciphers                             520.50ms (0.52s)
  🟢 fetch-collections                        180.25ms (0.18s)
  🟡 fetch-users-and-groups                  2100.00ms (2.10s)
  🟢 build-org-data-maps                       45.30ms (0.05s)
  🟡 load-org-data                           2200.00ms (2.20s)
  🔴 health-checks-total                    15340.00ms (15.34s)
  🟡 map-members                             3200.00ms (3.20s)
  🔴 access-intelligence-total              21500.00ms (21.50s)
═══════════════════════════════════════════════════════════
```

## Key Differences from Risk Insights

| Aspect                 | Risk Insights (Old)                        | Access Intelligence (New)         |
| ---------------------- | ------------------------------------------ | --------------------------------- |
| **API Calls**          | 1 massive call to `/member-cipher-details` | 4 smaller parallel calls          |
| **Backend Work**       | Creates cartesian product                  | Returns raw data                  |
| **Frontend Work**      | Minimal processing                         | Maps ciphers → members            |
| **Large Org Behavior** | Times out / crashes                        | Should complete                   |
| **Network Time**       | All waiting on 1 slow call                 | Parallel, faster individual calls |
| **Processing Time**    | Backend heavy                              | Frontend heavy (but non-blocking) |

## What to Look For

### ✅ Success Indicators

1. **All API calls complete** (no timeouts)
2. **`fetch-users-and-groups` completes in < 5s** (vs Risk Insights timing out)
3. **`map-members` takes some time** (this is expected - frontend mapping)
4. **Total time < 30s for large org** (vs timing out before)
5. **No red errors in console**

### 🔴 Problem Indicators

1. **`fetch-users-and-groups` times out** - Backend still struggling
2. **`map-members` > 30s** - Frontend cartesian product (shouldn't happen)
3. **Browser becomes unresponsive** - Memory issue or blocking operation
4. **Memory grows > 1GB** - Data structure inefficiency

## Comparing the Two Approaches

### Risk Insights Flow:

```
Frontend Request
      ↓
Backend getMemberCipherDetails
      ↓
   [TIMEOUT] ← Backend creates huge cartesian product
```

### Access Intelligence Flow:

```
Frontend Requests (parallel)
      ↓                ↓                  ↓
  getCiphers    getUsers/Groups    getCollections
      ↓                ↓                  ↓
      └────────────────┴──────────────────┘
                       ↓
            Frontend maps relationships
                       ↓
                   Success!
```

## After Testing

Compare the performance results:

**Expected for large org (1000 users, 500 groups, 10k ciphers):**

- Risk Insights: Times out at `/member-cipher-details` call
- Access Intelligence: Completes in 15-30 seconds

**If Access Intelligence works**, the next step is to port this approach to Risk Insights using the same pattern of separate API calls + frontend mapping.

## Debugging Tips

**If it's still slow:**

1. Check which step takes longest in the summary
2. Look at data sizes - are they reasonable?
3. Check Memory tab for excessive memory usage
4. Look for red (> 5s) operations in the summary

**If API calls fail:**

1. Check Network tab for which request failed
2. Look at the error message in Console
3. Verify you have permissions for the organization

**If browser hangs:**

1. Check if `map-members` is taking too long
2. Take memory snapshot to see what's consuming memory
3. This might indicate a frontend cartesian product issue
