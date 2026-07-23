# Markdown URL mode and RTL editor backport

This branch starts at File Browser v2.63.14 commit
`dfe6e5b333e3211dd6ced146672657de598299c7`. It exists to provide the
Markdown URL mode and RTL editor experience on the Mac mini-compatible v2.63.14
release line while preserving that release's original filesystem behavior.

For Markdown files, the URL supports `mode=preview|edit` and
`dir=auto|rtl|ltr`. These query values are preserved when changing controls and
are restored by browser Back and Forward. Preview uses the selected document
direction; code blocks remain left-to-right.

The editor applies Ace's display-only `rtl` option only when `dir=rtl` is
explicitly selected. It never enables Ace `rtlText`, because that mode can
write bidi control characters into the Markdown source.

This is a frontend-only compatibility backport. It intentionally excludes newer
backend and filesystem/security changes, including any relaxation for external
symlinks (such as `--followExternalSymlinks`).
