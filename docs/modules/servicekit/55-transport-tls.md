# Transport profiles: reverse proxy and TLS

A service host answers requests that arrive over HTTP from a proxy (typically Traefik) or over TLS directly. Two independent
switches describe that, and every ServiceKit host gets them through `AddBieberWorksServiceHost`, no change to `Program.cs`.

| Switch | Section | Meaning |
| --- | --- | --- |
| A | `ServiceHost:ReverseProxy` | TLS ends at a proxy. Scheme, host and client address are taken from `X-Forwarded-*` headers, **only** when the direct caller is a listed proxy or network |
| B | `ServiceHost:Https` | Kestrel itself terminates TLS (certificate from PEM files, reloaded without a restart) |

| Profile | A | B | Use |
| --- | --- | --- | --- |
| Edge-TLS | on | off | Traefik terminates TLS, the internal Docker network is trusted (default for container images) |
| Re-encrypt | on | on | Traefik talks HTTPS to the container; the internal network is not trusted |
| Direct | off | on | No proxy (stand-alone, tests); the scheme comes from Kestrel |
| Plain | off | off | Development only |

## Reverse proxy (A)

```json
"ServiceHost": {
  "ReverseProxy": {
    "Enabled": true,
    "ForwardedHeaders": ["For", "Proto", "Host"],
    "KnownProxies": [],
    "KnownNetworks": ["172.18.0.0/16"],
    "ForwardLimit": 1
  }
}
```

* The forwarded-headers middleware runs first in the pipeline. From any other caller the headers are ignored. Loopback is **not**
  trusted unless it is listed.
* `ForwardedHeaders` replaces the default (all three), it is not merged into it.
* **Trust-all guard:** `Enabled` without `KnownProxies` and `KnownNetworks` stops the start; otherwise any client could claim
  `X-Forwarded-Proto: https` or choose its own address. Malformed addresses or CIDR entries stop the start with the setting name.
* The profile is off by default, so existing hosts behave as before; a host that enables it must list its proxy network (see the compose examples).

## TLS in Kestrel (B)

```json
"ServiceHost": {
  "Https": {
    "Enabled": true,
    "CertificateFile": "/run/secrets/tls.crt",
    "KeyFile": "/run/secrets/tls.key",
    "Port": 8443,
    "DisableHttp": true
  }
}
```

* Explicit listeners replace `ASPNETCORE_URLS`. With `DisableHttp=false` a plain listener on `HttpPort` (default 8080) is added.
* The certificate is read from PEM files (Docker secrets); never inline. The files are checked at most every
  `ReloadCheckInterval` (30 s) during a handshake. A changed certificate is served by new connections without a restart.
  A broken replacement is logged and the previous certificate stays in use.
* Health check `tls-certificate`: `Degraded` when the certificate expires within `ExpiryWarning` (14 days), `Unhealthy` once it has expired.
* Missing files or ports out of range stop the start.

## Production guard

`ServiceHost:RequireTransportSecurity=true` makes the host refuse to start outside `Development` when neither A nor B is on.
Hosts that issue cookies or tokens over OpenID Connect (Identity) set it. It defaults to `false`, so existing hosts start as before.
No option forces `Request.Scheme` or disables a downstream HTTPS requirement.

## Compose examples

Edge-TLS (Traefik terminates TLS):

```yaml
identity:
  environment:
    ServiceHost__ReverseProxy__Enabled: "true"
    ServiceHost__ReverseProxy__KnownNetworks__0: 172.18.0.0/16   # the Traefik network
    ServiceHost__RequireTransportSecurity: "true"
```

Re-encrypt (Traefik speaks HTTPS to the container; the internal CA goes into Traefik's `serversTransport.rootCAs`):

```yaml
identity:
  environment:
    ServiceHost__ReverseProxy__Enabled: "true"
    ServiceHost__ReverseProxy__KnownNetworks__0: 172.18.0.0/16
    ServiceHost__Https__Enabled: "true"
    ServiceHost__Https__CertificateFile: /run/secrets/tls.crt
    ServiceHost__Https__KeyFile: /run/secrets/tls.key
  secrets: [tls.crt, tls.key]
```

Rotation: replace the secret files; connections opened afterwards use the new certificate within `ReloadCheckInterval`.
