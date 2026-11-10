# Getting Started

## Frontend or admin website (consumer of services)

```csharp
builder.Services.AddServiceKitClient(builder.Configuration);   // endpoints, status poller, token holder
builder.Services.AddServiceHttpClient("communication");        // named client: base address, token, resilience
```

```json
{
  "ServiceEndpoints": { "Services": { "communication": "http://communication:8080" } }
}
```

Moving a service to another host or network only changes `ServiceEndpoints`; no code or build change.

`IServiceStatusProvider` reports `Healthy / Degraded / Unavailable / Unknown` per service. Bind a status banner to it.
The poller calls `GET {service}/health` every 10 s with a 2 s timeout (HTTP 200 = healthy; a JSON body with
`"status": "Degraded"` = degraded; anything else = unavailable).

## Service host

```csharp
builder.Services.AddBieberWorksServiceHost(builder.Configuration);
builder.Services.AddServiceKitHttpTransport();         // or AddServiceKitInMemoryTransport()
builder.Services.AddServiceKitOutboxRelay();           // only if this service publishes events
builder.Services.AddServiceEventHandler<MyHandler>();  // only if this service receives events

app.UseAuthentication();
app.UseAuthorization();
app.MapBieberWorksServiceHost();                       // /info and /internal/events
```

`/health` and `/alive` come from the Observability module (`MapBieberWorksHealthEndpoints`), not from ServiceKit.
