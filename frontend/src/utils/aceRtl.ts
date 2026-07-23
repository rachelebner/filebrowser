export type MarkdownSourceDirection = "auto" | "rtl" | "ltr";

type AceDirectionEditor = {
  setOption(name: string, value: boolean): void;
};

/**
 * Ace's `rtlText` option adds U+202B markers to the document for some edits.
 * Keep it disabled: the `rtl` option is display state only.
 *
 * `auto` deliberately uses Ace's normal mixed-bidi rendering. It does not try
 * to infer or persist a per-line direction, because that requires markers.
 */
export const applyMarkdownSourceDirection = (
  editor: AceDirectionEditor,
  direction: MarkdownSourceDirection
) => {
  editor.setOption("rtl", direction === "rtl");
};
