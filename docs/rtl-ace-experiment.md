# Ace RTL Markdown source experiment

This branch deliberately uses Ace's `rtl` display option only. The direction
selector maps `rtl` to `editor.setOption("rtl", true)` and maps both `ltr` and
`auto` to `false`. `auto` is therefore deterministic and safe: Ace's normal
mixed-bidi rendering remains in use, but the editor never adds a direction
marker to the Markdown source.

Do **not** enable Ace's `rtlText` option or invoke its `rightToLeft` command.
In ace-builds 1.44.0 those paths insert U+202B (RIGHT-TO-LEFT EMBEDDING) into
the document, including directly through `session.doc.$lines` after multiline
inserts. That violates the source-integrity requirement.

## Reproducible manual check

1. Run the frontend development server and open
   `/rtl-ace-experiment.html`. The fixture exercises actual Ace 1.44.0 with
   RTL/LTR/auto toggles, navigation, selection, typing, undo, paste, and the
   value used as a save payload; it reports PASS only when the source is exact.
2. Create a Markdown file with the following exact text, then record a digest
   (for example, `shasum -a 256 sample.md`).
3. Open it in File Browser and test each selector value (`rtl`, `ltr`, then
   `auto`). For each value, use arrows, Home/End, select/copy/cut/paste, type
   and undo an edit, and save. Download or otherwise re-read the saved file and
   compare its digest to the original after undoing test edits. Also confirm no
   characters match `[\u200E\u200F\u202A-\u202E\u2066-\u2069]`.

````markdown
# עברית and English: punctuation, links, and tables

שלום, **bold English** — [קישור](https://example.test/a?x=1&y=2#עברית).
مرحبا `inline-code --flag=value` and `path/to/file.md`.

| עברית | English       | رابط                         |
| ----- | ------------- | ---------------------------- |
| שלום  | left-to-right | [مثال](https://example.test) |

```ts
const greeting = "שלום / مرحبا";
console.log(greeting, { markdown: "[link](https://example.test)" });
```
````

The automated `aceRtl.test.ts` additionally locks the selector mapping down:
only explicit `rtl` enables the display option, and none of the three values
creates a bidi control character in the representative source.
