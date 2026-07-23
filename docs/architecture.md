# Architecture

## Runtime shape

```text
CLI flags / env / config file / BoltDB
                |
                v
      cmd/root.go starts the server
                |
     +----------+-----------+
     |                      |
     v                      v
embedded Vue SPA       HTTP API (`/api`)
frontend/dist          `http/` handlers
     |                      |
     +-------- browser -----+
                            |
              +-------------+-------------+
              |                           |
              v                           v
      `storage.Storage`             per-user `afero.Fs`
      BoltDB-backed metadata         scoped host filesystem
```

`main.go` only delegates to Cobra. The root command in `cmd/root.go` resolves configuration, creates infrastructure, starts the HTTP server, and shuts it down gracefully on a signal.

### Configuration ownership

Runtime server configuration is assembled with this precedence: command-line flags, environment variables, config file, database values, then defaults. This is implemented by the `cmd` package using Viper.

`settings.Server` contains runtime/process concerns such as listener address, TLS, root path, base URL, caches, and feature flags. `settings.Settings` contains database-managed application policy: authentication method, branding, default users, rules, commands, uploads, and password policy. Keep the two separate when introducing configuration: a setting necessary before the database can be opened belongs in server/config-file territory; a setting administrators should edit in the app generally belongs in `settings.Settings`.

## Backend layers

| Layer | Main location | Responsibility |
| --- | --- | --- |
| CLI/bootstrap | `cmd/` | Cobra commands, configuration merge, quick setup, listener and dependency construction. |
| HTTP transport | `http/` | Routing, JSON and binary responses, authentication middleware, validation at API boundaries. |
| Domain services | `users/`, `share/`, `settings/`, `auth/`, `files/`, `rules/`, `runner/` | Models, authorization rules, filesystem abstractions, command hooks, and store contracts. |
| Persistence | `storage/`, `storage/bolt/` | Aggregated store and Bolt/Storm implementation of each backend. |
| Infrastructure | `diskcache/`, `img/`, `fileutils/` | Thumbnail cache, image transforms, and archive/file utilities. |

`storage.Storage` is the application-level dependency container. It owns user, share, auth, and settings stores. Handlers receive this container rather than talking to BoltDB directly; preserve this indirection to keep a storage-backend replacement possible.

## HTTP request lifecycle

`http.NewHandler` builds the Gorilla Mux router. The catch-all route serves the SPA, while `/api` is split into feature handlers. Each API handler is adapted by `handle` in `http/data.go`:

1. It applies response headers and loads global application settings.
2. It builds a per-request `data` object with settings, server configuration, storage, and a command runner.
3. Authentication middleware (`withUser` or `withAdmin`) parses an HS256 JWT, loads the current user, and enforces administrator permissions where required.
4. The endpoint performs domain/file work and returns a status plus error for centralized logging and HTTP error rendering.

The API routes are declared in `http/http.go`. They cover login/sign-up/token renewal, users, resources, resumable uploads, usage, shares, settings, raw/download/preview content, commands, search, subtitles, and public links.

## Identity, authorization, and filesystem scope

Authentication is pluggable behind `auth.Auther`. The configured method is retrieved from `auth.Storage`; current implementations include JSON credentials, proxy authentication, hook authentication, and no-auth. Login returns a signed JWT. Requests usually send it in `X-Auth`; GET requests may use the `auth` cookie.

Authorization has several independent gates, all of which need consideration for new file operations:

- `users.Permissions` controls capabilities such as admin, create, modify, delete, download, and execute.
- Global and user `rules.Rule` values are evaluated by `data.Check`; later matches override earlier ones.
- Hidden files are rejected by `data.Check` when enabled for the user.
- Each loaded user receives an `afero.Fs` rooted at their scope. By default `files.ScopedFs` additionally refuses symlink resolution outside that scope. `FollowExternalSymlinks` deliberately relaxes this protection and is unsafe.

Do not bypass `d.user.Fs` with host-path operations for a user-supplied path. If a feature needs a real host path, derive it through the scoped filesystem facilities and preserve the scope/rule checks.

## Frontend

`frontend/` is a Vue 3 + TypeScript SPA built with Vite. `src/router/index.ts` defines login, files, shares, settings, and error routes. Pinia stores under `src/stores/` hold authentication, current resource/listing, uploads, layout, clipboard, and router state. The frontend calls the Go API and uses route guards for UX; the backend remains the authorization authority.

In release builds, `frontend/dist` is embedded with Go's `embed` package. In development, build tags and the static-handler code support serving frontend assets differently. Any frontend API-contract change should update both the handler payload and the TypeScript API types/callers.
