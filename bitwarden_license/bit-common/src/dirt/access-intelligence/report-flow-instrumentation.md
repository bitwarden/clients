# Access Intelligence Report Flow Instrumentation

## The problem

The Access Intelligence report is generated entirely in an administrator's browser. The client
fetches every organization cipher, member, collection and group, computes the report from them,
then serializes, encrypts and uploads it. Every one of those steps grows with organization size,
and the largest organizations are where the cost matters.

None of those steps emitted a timing. Any statement about where the time goes came from reading
code rather than from measurement, and the steps are spread across six services, so no single
place could be profiled to find out. This adds one timing at each step boundary of the load,
generate and save stages.

## What is measured

Every step emits one measurement, named `Stage: description`, so the console and the performance
panel both read in flow order.

### Load

| Measurement                                     | What it covers                                                                                           | Properties                                     |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `Load: page initialized`                        | The whole page open path, from subscribe until a report is emitted. Envelope over the rest of this table | `itemCount`, `memberCount`, `applicationCount` |
| `Load: report metadata fetched`                 | The request for the most recent report record                                                            | none                                           |
| `Load: report blob downloaded`                  | Downloading the encrypted report file and buffering it into an `EncArrayBuffer`                          | `byteSize`                                     |
| `Load: report decrypted`                        | Decrypting the report file and building the view models from it                                          | `memberCount`, `applicationCount`              |
| `Load: org ciphers fetched (<trigger>, <impl>)` | The entire `CipherService` call: request, decrypt and locale sort together                               | `itemCount`                                    |
| `Load: org members fetched`                     | The organization users request, groups included                                                          | `memberCount`                                  |
| `Load: org collections fetched`                 | The collections with access details request                                                              | `collectionCount`                              |

`<trigger>` is `page open` or `generate`; `<impl>` is `sdk` or `legacy`. See
[Why the cipher fetch name carries two variables](#why-the-cipher-fetch-name-carries-two-variables).

### Generate

| Measurement                           | What it covers                                                                                               | Properties                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `Generate: password reuse detected`   | One pass over every cipher building a password to ciphers map, then reducing it to the reused entries        | `itemCount`                                                                      |
| `Generate: exposure lookups complete` | The whole breach lookup fan out, one lookup per cipher, bounded by the concurrency limit                     | `itemCount`, `concurrencyLimit`                                                  |
| `Generate: health and reuse combined` | Merging per cipher health results with the reuse map                                                         | `itemCount`                                                                      |
| `Generate: ciphers mapped to members` | Resolving which members can see each cipher through collections and groups, and building the member registry | `itemCount`, `memberCount`, `collectionCount`, `groupCount`, `mappedMemberCount` |
| `Generate: applications grouped`      | Grouping ciphers by URI into per application records, with their member and cipher references                | `itemCount`, `memberCount`, `applicationCount`                                   |
| `Generate: summary recomputed`        | Recomputing every summary aggregate from the finished report                                                 | `itemCount`, `memberCount`, `applicationCount`                                   |

Reuse detection is measured despite producing no network traffic because it is a full pass over
every cipher that allocates a map keyed by password, and because the combine step downstream
cannot start until it finishes.

### Save

| Measurement                      | What it covers                                                             | Properties                                                  |
| -------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `Save: encryption payload built` | Converting the report view into the encryption payload, cloning references | `memberCount`, `applicationCount`                           |
| `Save: report serialized`        | Serializing the report payload to JSON with its version envelope           | `charCount`                                                 |
| `Save: report encoded`           | Encoding the serialized report to bytes                                    | `byteSize`                                                  |
| `Save: summary serialized`       | Serializing the summary with its version envelope                          | `byteSize`                                                  |
| `Save: applications serialized`  | Serializing the application settings with their version envelope           | `byteSize`                                                  |
| `Save: artifacts encrypted`      | All five concurrent encryption operations                                  | `reportByteSize`, `summaryByteSize`, `applicationsByteSize` |
| `Save: report row created`       | The request that creates the report record and returns an upload URL       | `itemCount`, `memberCount`, `applicationCount`, `byteSize`  |
| `Save: report file uploaded`     | Uploading the encrypted report file                                        | `byteSize`                                                  |

Every save measurement also carries `memberCount` and `applicationCount`.

Two marks anchor the flow: `[AccessReportFlow]: page open` and `[AccessReportFlow]: report saved`.
They carry the same bracketed prefix as the measurements, so one console filter of
`[AccessReportFlow]` captures the whole flow.

## Conventions

Measurements go through `LogService.measure`, which wraps `performance.measure`. Two helpers in
[utils/measure-flow-step.operator.ts](utils/measure-flow-step.operator.ts) wrap that in turn, so
the track strings live in one place:

- `measureFlowStep` is an RxJS operator for a self contained async step. Its timer starts at
  subscribe and stops on the first emission.
- `flowTimer` is a stopwatch for consecutive steps, each measured from the end of the previous one.

The distinction matters. `measureFlowStep` starts its timer at subscribe, so two of them chained in
one pipe would each report the running total rather than their own step. Consecutive steps use
`flowTimer`.

Every measurement uses the track group `DIRT` and the track `AccessReportFlow`. One track for the
whole flow means load, generate and save render as a single timeline rather than one lane per
service.

### Browser support

Two independent outputs, with different support:

| Output               | Chrome                           | Other browsers                                 |
| -------------------- | -------------------------------- | ---------------------------------------------- |
| Console line         | yes                              | yes                                            |
| Performance timeline | grouped `AccessReportFlow` track | entry name and duration only, no grouped track |

Whether the console line appears at all depends on the log level, independently of the browser.

The measurement entries themselves are standard user timing and are recorded everywhere. The
`detail.devtools` payload that groups them into a named track with rendered properties is a Chrome
extensibility API, so **the track view requires Chrome**. Other browsers still show the entry name
and duration in their profiler, without the grouping or the properties.

### Design decisions

#### The timeline entry does not depend on the log level

`LogService.measure` creates the `performance.measure` entry before it writes any log line, and
that call is not gated on anything. The timeline entry is therefore present in every build,
whatever level the log line uses and whether or not the line is written at all.

The console line is not equally durable. Whether it appears depends on the level `measure` writes
at, and a debug level line is dropped outside a development build. Where a hosted run has to be
captured, record a performance trace rather than relying on console output.

#### The report is sized at encode, not at serialize

`Save: report serialized` carries `charCount` rather than a byte size. Running a `TextEncoder` over
the serialized report purely to measure it would allocate a second copy of the largest artifact in
the flow, which is the memory behavior under investigation. The real byte size arrives one step
later at `Save: report encoded`, which encodes that same string as part of the existing work.

The summary and application artifacts are sized directly, because they are small. The report is
not, and is never encoded twice.

This applies to the file storage path only. With that flag off the report is encrypted inline as a
single string instead, and that path carries no instrumentation at all, so nothing measures or
re-encodes the large report there either.

#### The exposure lookups are measured as a batch

The lookup fan out runs one request per cipher. Measuring each would emit thousands of entries and
swamp the panel, so the batch gets one measurement.

#### Encryption is one measurement, not five

The five encryption operations run concurrently, so per branch timings would overlap and mislead.
One boundary spans the whole set and carries all three artifact sizes.

#### Why the cipher fetch name carries two variables

`CipherService.getAllFromApiForOrganization` chooses between an SDK and a legacy implementation
internally. That file is owned by another team, so the fetch is measured from the outside and the
name records which implementation ran. This costs the split between request, decrypt and locale
sort, which is only available from inside that method.

The trigger is recorded because the flow fetches the full cipher set twice in a session: once at
page open, and again when an administrator generates. Distinct names keep the two attributable.

## Privacy

All measurement data lives in the browser's performance timeline and the browser console. Nothing
is persisted and nothing is transmitted. Web constructs its `ConsoleLogService` with no log
recorder attached, and this repository has no analytics or telemetry sink.

Collection, aggregation and reporting are explicitly out of scope. This instrumentation provides
the raw measurement capability; consuming it is a developer workflow concern.

Properties are limited to three kinds of value:

- **Cardinality.** How many ciphers, members, applications, collections or groups took part in a
  step.
- **Artifact size.** Byte and character lengths of the serialized and encrypted report artifacts.
- **Code constants.** `concurrencyLimit` is a literal read from the source.

Nothing derived from vault content is recorded. Specifically absent, and deliberately so:
application names and hostnames, cipher identifiers, member identifiers, email addresses,
usernames, password values or hashes, exposure results, encryption keys, and organization
identifiers.

## Known gaps

**There is no measurement for server side file validation.** Nothing on the client observes it. The
save returns as soon as the upload resolves, and no read path checks the validated flag.

**The cipher fetch is not broken into phases.** See
[Why the cipher fetch name carries two variables](#why-the-cipher-fetch-name-carries-two-variables).

**The inline persistence path is not instrumented.** Only the file storage path carries
measurements. This gap closes when the inline path is removed.

---

**Document Version:** 1.0
**Last Updated:** 2026-09-10
**Maintainer:** DIRT Team
