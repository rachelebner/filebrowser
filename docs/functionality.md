# Core functionality

## File management

The resource API is the main file-management surface and is registered under `/api/resources` in `http/http.go`.

| Capability | API / handler area | Important behavior |
| --- | --- | --- |
| Browse and inspect | `GET /api/resources` in `http/resource.go` | Produces `files.FileInfo`, directory listings, sorting, MIME/type metadata, optional text content, and checksums. |
| Create/upload | `POST /api/resources` | Creates directories for trailing-slash paths or writes uploaded files. It checks create/modify rights and invalidates thumbnails. |
| Edit/save | `PUT /api/resources` | Rewrites existing files and requires modify permission. |
| Rename, copy, move, archive/extract | `PATCH /api/resources` | Dispatches an action using the destination query parameter and uses `fileutils/` for the filesystem-heavy operations. |
| Delete | `DELETE /api/resources` | Rejects deletion of the scope root, removes related shares and cached thumbnails, then deletes through the scoped filesystem. |
| Resumable upload | `/api/tus` in `http/tus_handlers.go` | Implements the tus protocol with an in-memory or Redis upload cache. |
| Download/view | `/api/raw`, `/api/preview`, `/api/subtitle` | Streams raw content, supplies image previews/thumbnails, and exposes subtitles. |
| Search and usage | `/api/search`, `/api/usage` | Searches the scoped tree and reports disk use. |

The implementation routes filesystem mutations through `runner.Runner.RunHook` where applicable. Hooks and the command runner are security-sensitive: execution is disabled by default through `settings.Server.EnableExec`.

## Accounts and administration

Administrators manage users through `/api/users` and global settings through `/api/settings`. A user model includes credentials, a scope, permissions, rules, commands, UI preferences, and a scoped filesystem initialized when the user is loaded.

Sign-up is optional (`settings.Settings.Signup`). Self-registered users are intentionally forced to non-admin and non-execution permissions even when global defaults would grant them. Password validation and hashing live in `users/`.

The CLI also supports user, configuration, rule, and command administration. It uses the same store layer as the HTTP service, so CLI and web administration act on the same records.

## Sharing and public access

Shares are stored metadata (`share.Link`) that point to a path owned by a user. They can expire and be password-protected. Authenticated users manage their links through `/api/shares` and `/api/share`; public consumers use `/api/public/share` and `/api/public/dl`.

Public-share handling rebases the exposed filesystem to the shared path. The request checker preserves the original-path prefix so user/global rules still apply correctly after rebasing. Treat this as a critical invariant when modifying sharing or path normalization.

## Authentication modes

The selected `settings.AuthMethod` determines which `auth.Auther` validates login requests:

- `json`: local username/password records.
- `proxy`: identity supplied by a reverse proxy.
- `hook`: an external authentication hook.
- `noauth`: quick setup/development-style access without a login page.

Successful authentication produces an expiring JWT signed with the application key. Middleware refreshes the client token when close to expiry or when the user record has changed.

## Images, caches, and static delivery

`img/` provides bounded-concurrency image processing. `diskcache/` provides a no-op or filesystem thumbnail cache, while uploads use an in-memory cache by default or Redis when configured for multi-instance deployments. Static SPA delivery is handled by `http/static.go`; non-API paths resolve to the SPA so Vue Router can render client-side routes.
