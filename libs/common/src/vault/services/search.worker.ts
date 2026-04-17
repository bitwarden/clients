/**
 * Long-lived Web Worker that owns the Lunr full-text search index for the entire session.
 *
 * WHY LONG-LIVED: The previous design built the index in a worker then serialised it and
 * sent it back so the main thread could deserialise it via `lunr.Index.load()`. For large
 * vaults that deserialization takes ~2–3 s on the main thread, producing a visible freeze
 * even though the build itself ran off-thread. By keeping the index alive in the worker
 * and handling search queries here too, the main thread never touches a Lunr data structure.
 *
 * WHY STREAMING: Sending all 80 K LunrDocumentData objects in one postMessage creates a
 * large structured-clone transfer buffer alongside the source array — doubling the memory
 * spike on the main thread and OOM-ing for large vaults. Instead, the main thread streams
 * documents in 2 K chunks (addDocuments), then signals buildIndex when done. Peak main-
 * thread LunrDocumentData memory is therefore ~2 K objects, not 80 K.
 *
 * PROTOCOL (main thread → worker)
 *   { type: 'addDocuments', documents: LunrDocumentData[] }   // sent N times
 *     (no response — fire and forget)
 *
 *   { type: 'buildIndex' }                                     // sent once after all chunks
 *     → { type: 'buildComplete' }
 *     → { type: 'error', error: string }
 *
 *   { type: 'search', requestId: string, query: string, isQueryString: boolean, terms: string[] }
 *     → { type: 'searchResults', requestId: string, results: Array<{ref:string, score:number}> }
 *     → { type: 'error', error: string }
 */

import * as lunr from "lunr";

/** Pre-computed, serialisable data for a single cipher document. */
export type LunrDocumentData = {
  id: string;
  shortid: string;
  name: string | null;
  subtitle: string | null;
  notes: string | null;
  login: { username: string | null; uris: string[] | null } | null;
  fields: string[] | null;
  fields_joined: string | null;
  attachments: string[] | null;
  attachments_joined: string | null;
  organizationid: string | null;
};

// ---------------------------------------------------------------------------
// Normalise-accents pipeline function — registered under the name expected by
// SearchService so a serialised index can still be loaded on the main thread
// if ever needed (e.g. unit tests that bypass the worker).
// ---------------------------------------------------------------------------
const SEARCHABLE_ACCENT_FIELDS = ["name", "login.username", "subtitle", "notes"];

function normalizeAccentsPipelineFunction(token: lunr.Token): lunr.Token | string {
  const fields: string[] = (token as unknown as { metadata: { fields: string[] } }).metadata[
    "fields"
  ];
  if (fields.every((f) => SEARCHABLE_ACCENT_FIELDS.includes(f))) {
    return token
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }
  return token;
}

lunr.Pipeline.registerFunction(
  normalizeAccentsPipelineFunction as unknown as lunr.PipelineFunction,
  "normalizeAccents",
);

// ---------------------------------------------------------------------------
// Worker state — the index lives here for the duration of the session.
// ---------------------------------------------------------------------------
let currentIndex: lunr.Index | null = null;

/** Configured builder reused across `addDocuments` chunks. Created fresh each build cycle. */
let pendingBuilder: lunr.Builder | null = null;

function createBuilder(): lunr.Builder {
  const builder = new lunr.Builder();
  builder.pipeline.add(normalizeAccentsPipelineFunction as unknown as lunr.PipelineFunction);
  builder.ref("id");
  builder.field("shortid", { boost: 100 });
  builder.field("name", { boost: 10 });
  builder.field("subtitle", { boost: 5 });
  builder.field("notes");
  builder.field("login.username");
  builder.field("login.uris", { boost: 2 });
  builder.field("fields");
  builder.field("fields_joined");
  builder.field("attachments");
  builder.field("attachments_joined");
  builder.field("organizationid");
  return builder;
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------
type InMessage =
  | { type: "addDocuments"; documents: LunrDocumentData[] }
  | { type: "buildIndex" }
  | {
      type: "search";
      requestId: string;
      query: string;
      isQueryString: boolean;
      terms: string[];
    };

self.onmessage = (event: MessageEvent<InMessage>) => {
  const msg = event.data;

  // Chunk of pre-computed cipher documents — add directly to the builder and drop the
  // reference so the GC can reclaim the chunk memory before the next arrives.
  if (msg.type === "addDocuments") {
    if (!pendingBuilder) {
      pendingBuilder = createBuilder();
    }
    for (const doc of msg.documents) {
      pendingBuilder.add(doc);
    }
    return;
  }

  // All chunks delivered — build the index and signal completion.
  if (msg.type === "buildIndex") {
    try {
      const builder = pendingBuilder ?? createBuilder();
      pendingBuilder = null; // allow GC before the expensive build()

      currentIndex = builder.build();

      // No serializedIndex sent back — avoids a large toJSON() copy and another
      // structured-clone on the main thread. The index is rebuilt on page reload.
      self.postMessage({ type: "buildComplete" });
    } catch (e: unknown) {
      self.postMessage({ type: "error", error: String(e) });
    }
    return;
  }

  if (msg.type === "search") {
    const { requestId, query, isQueryString, terms } = msg;
    if (!currentIndex) {
      self.postMessage({ type: "searchResults", requestId, results: [] });
      return;
    }
    try {
      let results: lunr.Index.Result[];
      if (isQueryString) {
        results = currentIndex.search(query.substring(1).trim());
      } else {
        const soWild = lunr.Query.wildcard.LEADING | lunr.Query.wildcard.TRAILING;
        results = currentIndex.query((q) => {
          terms.forEach((t) => {
            q.term(t, { fields: ["name"], wildcard: soWild });
            q.term(t, { fields: ["subtitle"], wildcard: soWild });
            q.term(t, { fields: ["login.uris"], wildcard: soWild });
            q.term(t, {});
          });
        });
      }
      self.postMessage({
        type: "searchResults",
        requestId,
        results: results.map((r) => ({ ref: r.ref, score: r.score })),
      });
    } catch (e: unknown) {
      self.postMessage({ type: "error", error: String(e) });
    }
    return;
  }
};
