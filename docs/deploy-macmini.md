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

## File access permission (macOS)

- macOS ties Documents access to the binary's signing identity.
- A new unsigned or differently signed binary blocks in `open()`. The SPA loads, but every file API call hangs.
- The deploy signs the binary with the identifier `com.rachelebner.filebrowser.rtl`.
- The certificate is a self-signed identity named `FileBrowser RTL Local`. It is stable, so consent survives new builds.
- The signing step fails if the identity is missing. It never falls back to ad-hoc signing.
- The health check also lists the file tree, so a blocked read fails the deploy.

### Signing setup on the Mac Mini

- **Keychain:** `~/Library/Keychains/filebrowser-signing.keychain-db`. It holds the private key. Nothing else uses it.
- **Password file:** `~/.filebrowser-signing/keychain-pass`, mode 600, in a mode 700 directory. It is outside the repo.
- **Public cert:** `~/.filebrowser-signing/cert.pem`. It is public, but do not commit it.
- The deploy job unlocks the keychain from the password file, then runs `codesign --keychain`.
- Nothing is stored in GitHub secrets. The key and cert are never committed.
- The cert needs a one-time trust for code signing. macOS asks for the login password, so do it at the Mac's desktop:

```sh
security add-trusted-cert -r trustRoot -p codeSign \
  -k ~/Library/Keychains/filebrowser-signing.keychain-db ~/.filebrowser-signing/cert.pem
```

- Check it with `security find-identity -v -p codesigning ~/Library/Keychains/filebrowser-signing.keychain-db`.
- The cert is valid for 10 years. To replace it, generate a new one and re-trust it. Consent must then be granted again.

### First deploy with a new identity

- A new signing identity means a new app to macOS.
- Expect one consent prompt for Documents after the first deploy that uses the new cert.
- Approve it at the Mac's desktop. File API calls hang until then.
- The file-read health check retries for about 11 minutes, so there is time to approve the prompt.
- If nobody approves in time, the job rolls back to `filebrowser.prev`.
- Plan: be at the Mac before the deploy starts and approve the prompt when it appears.
- Later deploys keep the same identity, so no more prompts.

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

### Known-good backup

- `filebrowser.known-good` sits next to the binary. Deploys never touch it.
- It is a copy of the `5770f5b7` build, which had file access granted. The original `f3cdc5c6` build no longer exists.
- Restore it:

```sh
APP="/Users/razi/Applications/FileBrowser RTL.app/Contents/MacOS/filebrowser"
cp "$APP.known-good" "$APP"
launchctl kickstart -k gui/$(id -u)/com.openclaw.rzcontent-server
launchctl kickstart -k gui/$(id -u)/com.openclaw.obsidian-server
```

- Promote the running binary after you confirm it works:

```sh
cp "$APP" "$APP.known-good"
chmod 700 "$APP.known-good"
```

- Promote by hand only. Check both ports and a file read first.

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
