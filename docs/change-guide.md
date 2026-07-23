# Change guide

## Choose the narrowest change boundary

| Change | Start here | Usually also update |
| --- | --- | --- |
| New API operation | `http/http.go` and a focused `http/` handler | auth/permission checks, frontend API caller/types, handler tests. |
| File operation | `http/resource.go`, `files/`, or `fileutils/` | scoped-path/rule checks, cache invalidation, share consistency, symlink tests. |
| User or global setting | `settings/` and `storage/bolt/` | CLI config commands, settings API DTO, frontend settings UI, defaults and migration behavior. |
| Authentication method | `auth/` plus `storage/bolt/auth.go` | configuration parsing, login/static behavior, tests. |
| Share behavior | `share/` and `http/share.go` / `http/public.go` | public-share rebasing, password/expiry enforcement, rules and symlink tests. |
| UI-only behavior | `frontend/src/` | router/stores/components/tests; rebuild embedded assets before a release. |

## Invariants worth preserving

1. Treat every API path as untrusted. Normalize it and use the user's scoped filesystem rather than direct OS access.
2. Enforce permissions and `data.Check` on the server. Frontend route guards and disabled controls are only convenience.
3. Preserve symlink confinement by default. New operations on `ScopedFs` must guard every path they dereference.
4. Keep global settings and user settings distinct. Do not expose secrets such as the signing key in API response DTOs.
5. Delete or regenerate thumbnails when mutations change an image or its path.
6. Keep share records consistent with file changes; deletion already removes shares beneath the deleted path.
7. Use `handle`, `withUser`, and `withAdmin` for standard API paths so settings loading, logging, headers, and error behavior remain uniform.

## Verification map

- Backend: run the focused Go package tests first, then `go test ./...` for cross-package changes.
- Frontend: from `frontend/`, run `pnpm typecheck`, `pnpm lint`, and focused or full Vitest tests as appropriate.
- Full build: build the frontend before validating an embedded-asset release build. The `Taskfile.yml`, Dockerfiles, and CI workflow show the supported packaging paths.
- Security-sensitive work: add regression tests around authentication, rules, public shares, and symlinks. Existing tests such as `http/public_symlink_test.go`, `http/tus_symlink_test.go`, and `files/fs_test.go` are useful patterns.

## Practical feature workflow

1. Find the API route and identify whether it is authenticated, admin-only, or public.
2. Trace its handler through the relevant domain/store package before changing its API contract.
3. Decide where authorization, rule evaluation, scope confinement, hooks, and cache invalidation must occur.
4. Update the frontend contract and route/store/component only after the server behavior is clear.
5. Add a focused regression test that demonstrates the intended behavior and, for file operations, a forbidden-path case.
