# Getting started

```powershell
docker run --rm -p 8080:8080 `
  -e ConnectionStrings__AuthDb="Host=db;Database=identity;Username=...;Password=..." `
  -e JwtSettings__Issuer="https://identity.example.com" `
  -e ServiceEndpoints__Services__communication="http://communication:8080" `
  -v ./signing-key.pem:/run/secrets/identity_signing_key:ro `
  -e BieberWorks__Auth__JwtSigning__ActiveKid=key-1 `
  -e BieberWorks__Auth__JwtSigning__Keys__0__Kid=key-1 `
  -e BieberWorks__Auth__JwtSigning__Keys__0__PrivateKeyFile=/run/secrets/identity_signing_key `
  ghcr.io/bieberworks/identity:<version>
```

* Pin a version tag. The image has no `latest` tag on purpose.
* The signing key is an ES256 (P-256) private key in PEM form, handed over as a **file** (Docker/Kubernetes secret) and referenced by `...Keys__0__PrivateKeyFile`.
  Outside `Development` an inline `PrivateKeyPem` in configuration or environment variables stops the start. The key store is replaceable (`IJwtSigningKeyStore`) for a later vault/KMS integration. Rotation: add the new key, switch `ActiveKid`, keep the old public key until its tokens expired.
* Migrations of the Auth schema and the transport tables run at start. Use a database user that may create schemas.
* Other services validate tokens with `ServiceHost:Jwt:Authority` (equal to `JwtSettings:Issuer`) and their own name as
  `Audience`; they need no secret. See the `SDK-ServiceKit` docs.
