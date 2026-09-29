# Deploy to the Mac Mini

## How deploys work

- Every push to `prod` runs `.github/workflows/deploy-macmini.yml`.
- The build job runs on `ubuntu-latest`. It builds the frontend, then cross-compiles `darwin/arm64` with `CGO_ENABLED=0`.
- The version is stamped with ldflags. It looks like `2.63.14-markdown-rtl-backport` plus the 8-char commit.
- The deploy job runs on the self-hosted runner labelled `filebrowser-macmini`.
- It backs up the current binary as `filebrowser.prev` inside the app bundle.
- It swaps in the new binary and restarts both LaunchAgents.
- Concurrency group `deploy-macmini` prevents overlapping deploys.
- The workflow never uses `pull_request` or `pull_request_target`.

## Deployed pieces

- **Binary:** `/Users/razi/Applications/FileBrowser RTL.app/Contents/MacOS/filebrowser`
- **`com.openclaw.rzcontent-server`:** port 8765, base URL `/files`.
- **`com.openclaw.obsidian-server`:** port 8768.
- Both bind `127.0.0.1` and serve `~/Documents/MySecondBrain`.

## Health check

- `http://127.0.0.1:8765/files/` and `http://127.0.0.1:8768/` must respond.
- Each is retried for up to 60 seconds.
- On failure the job restores `filebrowser.prev`, restarts both agents and fails.

## Manual deploy

- Open the Actions tab, pick "Deploy to Mac Mini", click "Run workflow".
- The deploy job only runs when the selected branch is `prod`.

## Rollback

- Automatic: a failed health check restores `filebrowser.prev`.
- Manual on the Mac Mini:

```sh
APP="/Users/razi/Applications/FileBrowser RTL.app/Contents/MacOS/filebrowser"
cp "$APP.prev" "$APP"
launchctl kickstart -k gui/$(id -u)/com.openclaw.rzcontent-server
launchctl kickstart -k gui/$(id -u)/com.openclaw.obsidian-server
```

- Or revert the commit on `prod` and let the workflow redeploy.
- `filebrowser.prev` holds only the last binary. A second deploy overwrites it.

## Runner

- **Directory:** `~/actions-runner-filebrowser`
- **Name and label:** `MacMini-filebrowser`, `filebrowser-macmini`
- **Service:** `actions.runner.rachelebner-filebrowser.MacMini-filebrowser`
- **Manage:** `./svc.sh status|stop|start` from that directory.
- It is separate from the trade-wizz runner in `~/actions-runner`. Do not reconfigure that one.

## Repo protections

- `prod` is the default branch.
- Ruleset `protect-prod` blocks force-push and deletion.
- Interaction limit is `collaborators_only`. It expires after six months, so renew it.
- Pull request creation is limited to collaborators.
- Fork PR workflows need approval for all external contributors.
