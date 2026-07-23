export type MarkdownSourceDirection = "auto" | "rtl" | "ltr";

type AceDirectionEditor = {
  setOption(name: string, value: boolean): void;
};

/**
 * Keep Ace's `rtlText` option disabled: it can add bidi control characters to
 * the document during editing. `rtl` changes display state only.
 */
export const applyMarkdownSourceDirection = (
  editor: AceDirectionEditor,
  direction: MarkdownSourceDirection
) => {
  editor.setOption("rtl", direction === "rtl");
};
