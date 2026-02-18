# Service Dependency Graph

**Purpose:** Visual dependency map of Access Intelligence service architecture and data flow patterns

---

**Architecture Note: Storage Backend Flexibility**

The `ReportPersistenceService` is designed to be **backend-agnostic**. The server-side storage is evolving (DB → possibly blob storage or other solutions). The persistence service abstracts this complexity:

- **Current state:** Full report stored in DB via `RiskInsightsApiService`
- **Future state (TBD):** Report payload may move to blob storage, separate DB, or other backend
- **Design principle:** Only `ReportPersistenceService` + its API services change when backend changes. All other code is unaffected.

See [CLAUDE.md § Service Layer Architecture](../../CLAUDE.md#service-layer-architecture-api-vs-persistence-vs-domain) for layer definitions.

---

graph TB
subgraph UI["🖥️ UI Layer — Angular Components"]
direction LR
APPS["ApplicationsTableComponent<br/><small>Subscribes: report$<br/>Derives: report.getCriticalApplications()</small>"]
ACTIVITY["ActivityTabComponent<br/><small>Subscribes: report$<br/>Derives: report.getNewApplications()</small>"]
CARDS["ReportCardsComponent<br/><small>Subscribes: report$<br/>Derives: report.getSummary()</small>"]
DRAWER["DrawerComponents<br/><small>Subscribes: drawerState$ + report$<br/>Computes content from view methods</small>"]
end

    subgraph PRES["🎨 Presentational Services (Angular-only)"]
        DRAWER_SVC["DrawerStateService<br/>━━━━━━━━━━━━━━━━━━<br/><small>State: BehaviorSubject&lt;DrawerState&gt;<br/>DrawerState { open, type, invokerId }<br/>No domain data — content derived in components</small>"]
    end

    subgraph DATA["📡 Data Layer — Single Observable Source"]
        AI_DATA["AccessIntelligenceDataService<br/>━━━━━━━━━━━━━━━━━━━━━━━<br/><small><b>Source of truth:</b><br/>report$: BehaviorSubject&lt;RiskInsightsView │ null&gt;<br/><br/><b>Derived (from report$):</b><br/>reportStatus$: Observable&lt;ReportStatus&gt;<br/>summary$: Observable&lt;RiskInsightsSummaryView&gt;<br/>progress$: Observable&lt;ReportProgress&gt;<br/><br/><b>Actions (delegates to domain services):</b><br/>initializeForOrganization(orgId)<br/>generateReport(): void<br/>saveApplicationMetadata(apps)<br/><small>Note: Mark critical/reviewed via<br/>RiskInsightsApplicationView methods,<br/>then save via persistence service</small></small>"]
    end

    subgraph DOMAIN["⚙️ Domain Services"]
        direction TB
        REPORT_GEN["ReportGenerationService<br/>━━━━━━━━━━━━━━━━━━━━━━━<br/><small><b>in:</b> OrganizationId<br/><b>out:</b> Observable&lt;RiskInsightsView&gt;<br/><b>pipeline:</b><br/>1. Load CipherView[] via CipherService<br/>2. Load org data via OrganizationService<br/>3. Load + decrypt previous Application[]<br/>   (carry over critical flags + reviewDates<br/>    — must be client-side, encrypted data)<br/>4. CipherHealthService.checkHealth(ciphers)<br/>5. MemberCipherMappingService.map(ciphers, ...)<br/>6. Merge carried-over app metadata by hostname<br/>7. Aggregate → RiskInsightsView<br/>8. Generate RiskInsightsSummaryView</small>"]

        CIPHER_HEALTH["CipherHealthService<br/>━━━━━━━━━━━━━━━━━━━━━━━<br/><small><b>in:</b> CipherView[]<br/><b>out:</b> Map&lt;CipherId, CipherHealthResult&gt;<br/><br/>CipherHealthResult {<br/>  cipherId: CipherId<br/>  hasWeakPassword: boolean<br/>  hasReusedPassword: boolean<br/>  hasExposedPassword: boolean<br/>  exposedCount: number<br/>}<br/><br/>Concurrency-limited HIBP calls<br/><b>deps:</b> PasswordHealthService, AuditService</small>"]

        MEMBER_MAP["MemberCipherMappingService<br/>━━━━━━━━━━━━━━━━━━━━━━━<br/><small><b>in:</b> CipherView[], OrganizationUserView[],<br/>     GroupView[], CollectionView[]<br/><b>out:</b> {<br/>  mapping: Map&lt;CipherId, MemberRef[]&gt;,<br/>  registry: MemberRegistry<br/>}<br/><br/>MemberRef { id: OrgUserId, registryKey }<br/>MemberRegistry: Map&lt;OrgUserId, MemberEntry&gt;<br/><br/>Pure transformation — no API calls<br/>Resolves via collections + groups</small>"]

        PERSIST["ReportPersistenceService<br/>━━━━━━━━━━━━━━━━━━━━━━━<br/><small><b>saveReport():</b><br/>  in: RiskInsights (domain)<br/>  splits:<br/>    report payload → compress → blob API<br/>    app metadata + summary → existing API<br/>  out: Observable&lt;void&gt;<br/><br/><b>saveApplicationMetadata():</b><br/>  in: RiskInsightsApplicationView[]<br/>  updates: isCritical + reviewedDate<br/>  PATCH existing API (single endpoint)<br/>  out: Observable&lt;void&gt;<br/><br/><b>loadReport():</b><br/>  in: OrganizationId<br/>  assembles:<br/>    report payload ← blob API → decompress<br/>    app metadata + summary ← existing API<br/>    decrypt → assemble RiskInsightsView<br/>  out: Observable&lt;RiskInsightsView&gt;</small>"]
    end

    subgraph API["🌐 API Services (Thin HTTP Wrappers)"]
        EXISTING_API["RiskInsightsApiService<br/><small>(existing — DB endpoints)<br/>━━━━━━━━━━━━━━━━━━━━━━━<br/>POST/GET full report (current backend)<br/>PATCH RiskInsightsApplication<br/>(critical flags, reviewedDate)<br/><br/>PATCH RiskInsightsSummary<br/>(computed aggregates)<br/><br/>GET org groups<br/><br/><b>Note:</b> 1:1 with API endpoints<br/>No business logic</small>"]
        STORAGE_API["ReportStorageApiService<br/><small>(future — pluggable backend)<br/>━━━━━━━━━━━━━━━━━━━━━━━<br/><b>Backend TBD:</b> Could be blob storage,<br/>updated DB endpoints, or other<br/><br/>POST upload compressed report<br/>GET download compressed report<br/><br/><b>Only created when backend changes</b><br/>For now: use RiskInsightsApiService</small>"]
    end

    subgraph MODELS["📦 Models — Api → Data → Domain → View (follows Cipher pattern)"]
        direction LR
        RI["RiskInsights (parent)<br/><small>Contains: report, apps[], summary<br/><b>Domain:</b> EncString fields, decrypt()<br/><b>View methods:</b><br/>.getAtRiskMembers()<br/>.getCriticalApplications()<br/>.getApplicationByHostname(h)<br/>.getNewApplications()<br/>.getSummary()</small>"]
        RIR["RiskInsightsReport<br/><small>Per-app health data<br/>→ Blob storage<br/><b>View:</b> .getMemberDetails()<br/>.isAtRisk()</small>"]
        RIA["RiskInsightsApplication<br/><small>User-defined per-app settings<br/>isCritical, reviewedDate<br/>→ Existing API (DB)<br/>Carried over between generations<br/><br/><b>View methods:</b><br/>.markAsCritical()<br/>.unmarkAsCritical()<br/>.markAsReviewed()<br/>.isReviewed()</small>"]
        RIS["RiskInsightsSummary<br/><small>Pre-computed aggregates<br/>→ Existing API (DB)<br/>Recomputed each generation</small>"]
        MR["MemberRegistry + MemberRef<br/><small>Dedup'd member lookup<br/>Eliminates 450MB+ bloat</small>"]
    end

    %% UI connections
    UI --> PRES
    UI --> AI_DATA

    %% Data service connections
    AI_DATA --> REPORT_GEN
    AI_DATA --> PERSIST

    %% Domain service internals
    REPORT_GEN --> CIPHER_HEALTH
    REPORT_GEN --> MEMBER_MAP

    %% API connections
    PERSIST --> EXISTING_API
    PERSIST --> BLOB_API

    %% Model production
    REPORT_GEN -.->|"produces"| RI
    CIPHER_HEALTH -.->|"produces"| RIR
    MEMBER_MAP -.->|"produces"| MR

    style UI fill:#e8f4fd,stroke:#2196F3,stroke-width:2px
    style PRES fill:#fff3e0,stroke:#FF9800,stroke-width:2px
    style DATA fill:#e8f5e9,stroke:#4CAF50,stroke-width:2px
    style DOMAIN fill:#fce4ec,stroke:#E91E63,stroke-width:2px
    style API fill:#f3e5f5,stroke:#9C27B0,stroke-width:2px
    style MODELS fill:#fff9c4,stroke:#FFC107,stroke-width:2px

---

**Document Version:** 1.0
**Last Updated:** 2026-02-17
**Maintainer:** DIRT Team
