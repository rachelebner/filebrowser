# Internal engineering notes

These notes describe the current codebase for contributors planning changes. They complement the user-facing documentation in [`www/docs/`](../www/docs/), which covers installation and operation.

- [Architecture](architecture.md) maps the runtime components and ownership boundaries.
- [Core functionality](functionality.md) explains the main user-visible flows and their code locations.
- [Change guide](change-guide.md) identifies the safest extension points and the checks that should accompany changes.

## Repository at a glance

File Browser is a Go application that is normally distributed as one binary. It serves a Vue single-page application (SPA), exposes an HTTP API under `/api`, persists application metadata in BoltDB, and operates on files beneath a configured server root. The browser bundle is built separately in `frontend/` and embedded into the Go binary through `frontend/assets.go`.

The application has two kinds of state:

1. **Managed metadata** — users, authentication configuration, global settings, and shares. This is stored in the database through `storage.Storage`.
2. **Managed content** — the actual files and directories. These remain on the host filesystem and are accessed through a per-user scoped filesystem.

When changing behavior, keep that distinction explicit: database updates do not alter files unless the relevant handler deliberately does so.
