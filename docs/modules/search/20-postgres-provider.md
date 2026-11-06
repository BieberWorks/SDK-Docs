# PostgreSQL Provider

`BieberWorks.SDK.Search.Postgres` is the first concrete `ISearchProvider` implementation, using
PostgreSQL's built-in `tsvector`/`tsquery` full-text search with a GIN index.

## Schema

Own schema `search` (one schema per module, SDK convention), single table
`search.search_documents` — generic across all consumer entity types, **no foreign keys** into
other modules' schemas (module-boundary is respected; cross-module linkage happens only via
`deep_link`/ids, never a database-level FK).

| Column | Type | Notes |
|---|---|---|
| `id` | `text` (PK) | `"{EntityType}:{EntityId}"` |
| `entity_type`, `entity_id` | `text` | |
| `title` | `text` | Weight A |
| `body` | `text`, nullable | Weight B |
| `additional_fields` | `jsonb`, nullable | `[{Name, Value, Weight}]`, weight C in the vector |
| `language` | `text` | ISO 639-1, drives `search.search_config()` |
| `permission_key`, `required_role`, `visibility_scope` | `text`, nullable | Coarse/fine filters |
| `deep_link` | `text` | |
| `metadata` | `jsonb`, nullable | |
| `indexed_at_utc` | `timestamptz` | |
| `search_vector` | `tsvector` | **Trigger-maintained**, see below |

## Trigger-based `search_vector` maintenance (design decision)

`search_vector` is populated by a `BEFORE INSERT OR UPDATE` trigger
(`search.search_documents_vector_update()`), **not** a `GENERATED ALWAYS AS (...) STORED` column.

**Why not a generated column?** PostgreSQL requires generated-column expressions to consist
solely of `IMMUTABLE` functions. `search.search_config(text)` — the helper mapping an ISO 639-1
code to a `regconfig` — is itself declared `IMMUTABLE` (pure `CASE`, no side effects, no table
access), so it is legal to use anywhere an immutability check applies. The actual risk is chaining
`to_tsvector(search.search_config(language), ...)` with a `language` value that varies **per
row** inside a `STORED` generated-column expression: this dynamic-regconfig-per-row pattern is a
well-known fragile edge case across PostgreSQL versions for generated columns, even though each
individual function in the chain is IMMUTABLE. A trigger has no such restriction and is the
documented, portable way to maintain a multi-language `tsvector` column.

**Trade-off accepted:** a trigger requires an explicit `INSERT`/`UPDATE` to run (there is no
compile-time guarantee the vector is always in sync, unlike a generated column which the database
enforces structurally). In exchange, indexing works reliably across all supported languages
without version-specific generated-column caveats. `PostgresSearchProvider` never writes
`search_vector` from .NET (`ValueGeneratedOnAddOrUpdate` + `PropertySaveBehavior.Ignore` in
`SearchDocumentConfiguration`) — the trigger is the single source of truth for that column.

## Language configuration

`search.search_config(text)` maps ISO 639-1 codes to PostgreSQL text-search configurations:

| Code | Configuration |
|---|---|
| `de` | `german` |
| `en` | `english` |
| `fr` | `french` |
| `es` | `spanish` |
| `it` | `italian` |
| `pt` | `portuguese` |
| `nl` | `dutch` |
| *(anything else)* | `simple` (tokenize only, no stemming — safe default for unknown/mixed content) |

Both indexing (the trigger, using `SearchDocument.Language`) and querying
(`PostgresSearchProvider.SearchAsync`, using `SearchQuery.Language`) go through this same
function — **they must agree** for stemmed matches to work (see the warning in
[Getting Started](01-getting-started.md)).

::: warning German Compound Words Are Not Split
PostgreSQL's `german` snowball stemmer does not decompose compound words. A document containing
only `"Datenschutzerklärung"` will **not** match a query for `"Datenschutz"` — both stem to
different tokens (`'datenschutzerklar'` vs `'datenschutz'`). This is a limitation of PostgreSQL's
built-in stemming, not specific to this provider; a dedicated German compound-splitting
dictionary would be required to close this gap, which is out of scope for the current phase.
:::

Extending the mapping (e.g. for additional languages) requires a new migration updating the
`search.search_config` function body.

## Multi-language documents

Phase 1 keeps this simple: **one `SearchDocument` per language version**. A consumer with
translated content indexes one document per translation with a distinct `EntityId` suffix
(e.g. `"page:123:de"`, `"page:123:en"`) rather than combining multiple languages into a single
document/field.

## Query

`websearch_to_tsquery`/`ts_rank`/`ts_headline` have no LINQ translation and run as raw SQL via
`Database.SqlQuery<T>` against an unmapped row type (`SearchHitRow`) — the same pattern already
used elsewhere in the SDK for PostgreSQL-specific features (e.g. `FOR UPDATE SKIP LOCKED` in the
Outbox store). Coarse `entity_type`/`permission_key`/`required_role` filtering happens server-side
in this query, before ranking/paging; `ISearchService` applies the remaining `VisibilityScope`
fine-filter (e.g. `"owner:{userId}"`) afterwards.

Snippets use neutral highlight markers (`{{hl}}...{{/hl}}`) rather than raw HTML — the contract is
deliberately HTML-free/XSS-safe; only the UI layer (`BwSearchBox`/`BwSearchResultsPage`) turns
these into `<mark>` tags when rendering.

## GIN index

```sql
CREATE INDEX ix_search_documents_vector ON search.search_documents USING GIN (search_vector);
```

Plus supporting B-tree indexes on `entity_type`, `permission_key`, and `required_role` for the
coarse pre-filter before the full-text match.
