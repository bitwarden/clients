# Access Intelligence — Glossary

**Purpose:** Canonical definitions for terms used across Access Intelligence code, documentation, and architecture decisions

---

| Term                       | Definition                                                                                                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Access Intelligence**    | The feature. Provides health analysis of an organization's member-cipher access patterns.                                                                                                                     |
| **AccessReport**           | The encrypted, persisted snapshot of an organization's access health at a point in time. Contains application health data, application settings, and summary statistics.                                      |
| **ApplicationHealth**      | The health analysis for a single application: password health metrics, at-risk member and cipher counts, and references to the specific members and ciphers involved.                                         |
| **AccessReportSettings**   | Admin-editable metadata per application: whether the application is marked as critical and the date it was last reviewed.                                                                                     |
| **AccessReportSummary**    | Org-wide aggregated counts used for trend tracking: total members, at-risk members, total applications, at-risk applications, and critical application variants of each.                                      |
| **AccessReportMetrics**    | Computed-at-runtime aggregated counts used for internal metrics. Similar in shape to `AccessReportSummary`. Includes additional password-level health counts not present in the summary.                      |
| **Application**            | A logical grouping of credentials (ciphers) sharing the same domain or URI pattern, treated as a single access entity for health assessment. Not necessarily a software application in the traditional sense. |
| **Member Registry**        | A deduplicated map of member IDs to member info (name, email). Stored once per report to avoid repeating member data across every `ApplicationHealth` entry.                                                  |
| **Content Encryption Key** | A per-report symmetric key wrapped with the organization key and stored alongside the encrypted blobs. Required to decrypt any part of an `AccessReport`.                                                     |
| **Risk Insights**          | Deprecated feature name. Replaced by "Access Intelligence". References in V1 code will be removed when V2 ships.                                                                                              |

---

**Document Version:** 1.0
**Last Updated:** 2026-03-04
**Maintainer:** DIRT Team (Access Intelligence)
