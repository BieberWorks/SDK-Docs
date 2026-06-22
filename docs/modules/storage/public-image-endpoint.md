# Public Image Streaming Endpoint

`BieberWorks.SDK.Storage` ships a helper for registering unauthenticated GET endpoints that
stream stored files to the browser — suitable for public-by-design assets such as event
imagery, landing-page content, and user avatars.

## Registration

```csharp
// Program.cs — after app.MapBieberWorksModules()
app.MapPublicFileImage(
    "/images/events/{eventId}",
    async (ctx, ct) =>
    {
        // Resolve the file id from your domain — return null for 404.
        var eventId = Guid.Parse((string)ctx.Request.RouteValues["eventId"]!);
        return await eventService.GetCoverImageFileIdAsync(eventId, ct);
    });
```

The helper returns an `IEndpointConventionBuilder`, so you can chain additional metadata:

```csharp
app.MapPublicFileImage("/images/events/{eventId}", resolver)
   .WithName("EventCoverImage")
   .WithSummary("Returns the public cover image for an event.");
```

### Custom max-age

By default `Cache-Control: public, max-age=3600` (1 hour) is written.
Pass an explicit `TimeSpan` to change the duration:

```csharp
app.MapPublicFileImage("/images/events/{eventId}", resolver, TimeSpan.FromDays(7));
```

## Parsing a stored file URL

If you store the URL form (`/storage/files/{id}`) and need to recover the id later:

```csharp
if (StorageFileUrl.TryParseStorageFileUrl(storedUrl, out var fileId))
{
    // fileId is the Guid
}
```

Returns `false` when the string does not start with `/storage/files/` or the trailing
segment is not a valid GUID.

## Response headers

Every successful (200) response includes:

| Header | Value |
|---|---|
| `Content-Type` | From stored file metadata; falls back to `application/octet-stream` |
| `ETag` | Strong tag derived from file id + creation timestamp |
| `Last-Modified` | File creation timestamp formatted as HTTP date |
| `Cache-Control` | `public, max-age=<seconds>` |

### Conditional requests

The handler fully honours conditional-request headers:

- `If-None-Match`: if the value matches the computed ETag (or is `*`), the handler
  returns `304 Not Modified` without streaming the body.
- `If-Modified-Since`: if the file has not changed since the supplied date, the handler
  returns `304 Not Modified`.

`If-None-Match` takes precedence over `If-Modified-Since` per RFC 7232.

## Security note

**GUID-based unauthenticated URLs are appropriate only for public-by-design content.**

File ids are v4 GUIDs — unguessable in practice. There is no enumeration surface; each
URL is a capability URL that grants access by knowing the id. This pattern ("security
through unguessable URL") is acceptable for assets that are deliberately public, such as
event cover images or profile avatars.

**Do NOT use `MapPublicFileImage` for access-controlled or private content.** For files
that require authentication or a permission check, use the authenticated
`/storage/files/{id}/download` endpoint instead.
