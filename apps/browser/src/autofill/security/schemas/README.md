# Channel schemas

One file per channel group. Each file imports only `v` and `inferType` from
`../validators.ts` — **zero external dependencies** (§2.3, no Zod, no Valibot,
no io-ts in any module reachable from content scripts).

When a new channel ships, define its `Validator<Req>` here and pass it as
`schema` on the handle. The receiver runs `schema.parse(message)` between the
predicate chain and the handler; on parse failure it logs
`schema-parse-failed` and drops the message (or responds `null` for requests).

Naming convention: file name matches the channel group; one exported
`{ChannelName}Schema` per channel, plus an `inferType` alias for the request
type if callers need to spell it.
