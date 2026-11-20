# Getting started

```powershell
docker run --rm -p 8080:8080 `
  -e ConnectionStrings__EmailDb="Host=db;Database=communication;Username=...;Password=..." `
  -e ServiceHost__Jwt__Authority="https://identity.example.com" `
  -e ServiceHost__Jwt__MetadataAddress="http://identity:8080/.well-known/openid-configuration" `
  -e Email__UseSmtp=true -e Email__Host=smtp.example.com -e Email__Port=587 `
  -e Email__From=no-reply@example.com `
  ghcr.io/bieberworks/communication:<version>
```

* Pin a version tag. The image has no `latest` tag on purpose.
* `ServiceHost:Jwt:Authority` must equal `JwtSettings:Issuer` of the identity service. The metadata address may differ
  (internal network name); plain http is only allowed with `ServiceHost:Jwt:AllowInsecureMetadata=true`.
* Supply SMTP credentials as secrets (files under `/run/secrets` are read as configuration, file name = key with `__`).
* Migrations of the `email` schema and the transport tables run at start.
