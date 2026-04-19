# Security Assessment Report — run-calc

Date: 2026-04-19

## Scope

Assessment of repository security posture with focus on:

- application attack surface
- dependency and supply-chain risks
- build/release hardening opportunities
- practical mitigation plan

No source code changes were made as requested.

## Executive Summary

The project is generally small and locally scoped, but it has a few meaningful risks:

1. **Outdated frontend toolchain with known advisories** (Vite/esbuild chain).
2. **Theme installation flow trusts remote URLs from API results**, allowing broader outbound fetch behavior than needed.
3. **Theme download pipeline is memory-unbounded**, enabling denial-of-service from oversized archives.
4. **Installer template defaults to admin execution level on Windows**, increasing blast radius.
5. **Missing automated security guardrails in CI/repo settings** (dependency update automation, security scans, supply-chain attestations).

## Key Findings

### 1) Frontend dependency vulnerabilities (Moderate)

**Evidence**

- `frontend/package.json` uses `vite: ^3.0.7`, `@vitejs/plugin-react: ^2.0.1`.
- `npm audit --json` reports moderate vulnerabilities in `vite`, `esbuild`, and `@vitejs/plugin-react`.

**Impact**

- Primarily affects dev/build server exposure and filesystem access bypass vectors in vulnerable Vite lines.
- Risk is higher for developers/CI runners and shared development environments.

**Mitigation**

- Upgrade to currently supported `vite` + `@vitejs/plugin-react` major versions.
- Add CI gate: `npm audit --omit=dev --audit-level=moderate` (or policy-equivalent with exceptions file).
- Enforce lockfile updates via PR checks.

---

### 2) Theme installer accepts arbitrary download URL from frontend (High)

**Evidence**

- Frontend passes `ext.downloadUrl` directly into backend: `frontend/src/ThemeStore.tsx`.
- Backend fetches provided URL directly: `InstallTheme(extensionId string, downloadURL string)` in `theme.go`.

**Impact**

- If search response is manipulated or backend API is abused, app may fetch attacker-controlled endpoints.
- Expands SSRF-style/local-network probing risk and untrusted content ingestion.

**Mitigation**

- Do not trust client-provided download URL.
- Build download URL server-side from validated `(namespace, name, version)` and strict allowlist.
- Enforce:
  - `https` only
  - host allowlist (`open-vsx.org` only, optionally pinned subpaths)
  - redirect limits and host re-validation after redirects

---

### 3) Unbounded memory use in VSIX download/processing (High)

**Evidence**

- `theme.go` reads whole response body into memory (`io.ReadAll(resp.Body)`).
- Archive content is processed in-memory with no explicit size caps.

**Impact**

- Malicious or oversized payload can trigger high memory pressure / crash (DoS).

**Mitigation**

- Add strict max response size (e.g., `io.LimitReader` + explicit byte cap).
- Reject archives above size threshold.
- Add unzip safety checks: max entries, max decompressed bytes, max file size per entry.

---

### 4) Remote icon URLs rendered directly in UI (Low/Medium)

**Evidence**

- Theme search results include remote icon URLs.
- UI renders untrusted icon URL in `<img src>`: `frontend/src/ThemeStore.tsx`.

**Impact**

- Privacy/tracking risk (external requests).
- Potential UX/security concerns if non-HTTPS or hostile image endpoints are accepted.

**Mitigation**

- Enforce HTTPS icon URLs from trusted hosts only.
- Consider backend image proxy/cache with validation and content-type checks.
- Optionally disable third-party icon loading by default in “privacy mode”.

---

### 5) Windows installer privilege level defaults to admin (Medium)

**Evidence**

- NSIS template indicates default execution level admin: `build/windows/installer/wails_tools.nsh` and `project.nsi`.

**Impact**

- Elevated install path increases damage potential if installer supply chain is compromised.

**Mitigation**

- Reassess if admin rights are truly required.
- Prefer lowest required privilege (`user`) when possible.
- Sign installer binaries and verify signature in release docs.

---

### 6) Missing repository-level security automation (Medium)

**Evidence**

- No visible `.github/workflows/*` security pipelines in repository snapshot.
- No `SECURITY.md` disclosure policy found.

**Impact**

- Vulnerabilities may remain undetected longer.
- Slower/unclear incident response.

**Mitigation**

- Add:
  - Dependabot/Renovate for Go+npm
  - CodeQL
  - secret scanning + push protection (repo settings)
  - dependency review for PRs
  - `govulncheck` and `npm audit` checks
- Add `SECURITY.md` with reporting channel and SLA.

## Hardening Plan (Prioritized)

## P0 (Immediate, 1–3 days)

- Upgrade vulnerable frontend toolchain (Vite/plugin-react/esbuild chain).
- Lock down theme download source (HTTPS + host allowlist + server-side URL construction).
- Add payload size limits to theme download/extraction.

## P1 (Short term, 1–2 weeks)

- Add CI security pipeline: CodeQL + dependency review + govulncheck + npm audit.
- Add Dependabot/Renovate with auto-PRs and weekly cadence.
- Add `SECURITY.md`.

## P2 (Medium term, 2–4 weeks)

- Generate SBOM for releases (CycloneDX/SPDX).
- Introduce signed release artifacts (Sigstore/Cosign or platform signing).
- Implement provenance attestations (SLSA-aligned build provenance).
- Review installer privilege model and reduce where feasible.

## Supply-Chain Attack Prevention Checklist

- [ ] Pin and continuously update direct dependencies (Go + npm).
- [ ] Enforce lockfile integrity in CI (`npm ci`, no lock drift).
- [ ] Run `go mod verify` in CI.
- [ ] Run vulnerability scanners on every PR and nightly.
- [ ] Require branch protection with mandatory status checks.
- [ ] Require signed tags/releases and publish checksums.
- [ ] Produce and publish SBOM per release.
- [ ] Protect secrets with GitHub secret scanning/push protection.

## Notes on Current Validation

- Frontend tests passed: `npm run test`.
- Frontend build passed: `npm run build`.
- Full Go test run is environment-blocked in this runner due missing X11 dev headers for hotkey dependency (`X11/Xlib.h`) and requires frontend `dist` assets for embed.
