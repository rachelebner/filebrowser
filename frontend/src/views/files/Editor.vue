<template>
  <div id="editor-container">
    <header-bar>
      <action icon="close" :label="t('buttons.close')" @action="close()" />
      <title>{{ fileStore.req?.name ?? "" }}</title>

      <action
        icon="add"
        @action="increaseFontSize"
        :label="t('buttons.increaseFontSize')"
      />
      <span class="editor-font-size">{{ fontSize }}px</span>
      <action
        icon="remove"
        @action="decreaseFontSize"
        :label="t('buttons.decreaseFontSize')"
      />

      <action
        v-if="authStore.user?.perm.modify"
        id="save-button"
        icon="save"
        :label="t('buttons.save')"
        @action="save()"
      />

      <action
        icon="preview"
        :label="isPreview ? t('buttons.editAsText') : t('buttons.preview')"
        @action="preview()"
        v-show="isMarkdownFile"
      />
    </header-bar>

    <!-- preview container -->
    <div class="loading delayed" v-if="layoutStore.loading">
      <div class="spinner">
        <div class="bounce1"></div>
        <div class="bounce2"></div>
        <div class="bounce3"></div>
      </div>
    </div>
    <template v-else>
      <div class="editor-header">
        <Breadcrumbs base="/files" noLink />

        <div class="editor-controls">
          <label v-if="isMarkdownFile" class="direction-control">
            <span>{{ t("buttons.direction") }}</span>
            <select :value="markdownDirection" @change="setDirection">
              <option value="auto">{{ t("buttons.auto") }}</option>
              <option value="rtl">RTL</option>
              <option value="ltr">LTR</option>
            </select>
          </label>
          <button
            :disabled="isSelectionEmpty"
            @click="executeEditorCommand('copy')"
          >
            <span><i class="material-icons">content_copy</i></span>
          </button>
          <button
            :disabled="isSelectionEmpty"
            @click="executeEditorCommand('cut')"
          >
            <span><i class="material-icons">content_cut</i></span>
          </button>
          <button @click="executeEditorCommand('paste')">
            <span><i class="material-icons">content_paste</i></span>
          </button>
          <button @click="executeEditorCommand('openCommandPalette')">
            <span><i class="material-icons">more_vert</i></span>
          </button>
        </div>
      </div>

      <div
        v-show="isPreview && isMarkdownFile"
        id="preview-container"
        class="md_preview"
        :dir="markdownDirection"
        v-html="previewContent"
      ></div>
      <form v-show="!isPreview || !isMarkdownFile" id="editor"></form>
    </template>
  </div>
</template>

<script setup lang="ts">
import { files as api } from "@/api";
import buttons from "@/utils/buttons";
import { applyMarkdownSourceDirection } from "@/utils/aceRtl";
import url from "@/utils/url";
import ace, { Ace, version as ace_version } from "ace-builds";
import "ace-builds/src-noconflict/ext-language_tools";
import modelist from "ace-builds/src-noconflict/ext-modelist";
import "ace-builds/src-noconflict/ext-rtl";
import DOMPurify from "dompurify";

import Breadcrumbs from "@/components/Breadcrumbs.vue";
import Action from "@/components/header/Action.vue";
import HeaderBar from "@/components/header/HeaderBar.vue";
import { useAuthStore } from "@/stores/auth";
import { useFileStore } from "@/stores/file";
import { useLayoutStore } from "@/stores/layout";
import { getEditorTheme } from "@/utils/theme";
import { marked } from "marked";
import markedKatex from "marked-katex-extension";
import {
  computed,
  inject,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  watchEffect,
} from "vue";
import { useI18n } from "vue-i18n";
import { onBeforeRouteUpdate, useRoute, useRouter } from "vue-router";
import { read, copy } from "@/utils/clipboard";

const $showError = inject<IToastError>("$showError")!;

const fileStore = useFileStore();
const authStore = useAuthStore();
const layoutStore = useLayoutStore();

const { t } = useI18n();

const route = useRoute();
const router = useRouter();

const editor = ref<Ace.Editor | null>(null);
const fontSize = ref(parseInt(localStorage.getItem("editorFontSize") || "14"));

const previewContent = ref("");
const isMarkdownFile = computed(
  () =>
    fileStore.req?.name.endsWith(".md") ||
    fileStore.req?.name.endsWith(".markdown")
);
const isPreview = computed(
  () => isMarkdownFile.value && route.query.mode === "preview"
);
const markdownDirection = computed<"auto" | "rtl" | "ltr">(() => {
  const direction = route.query.dir;
  return direction === "rtl" || direction === "ltr" || direction === "auto"
    ? direction
    : "auto";
});
const katexOptions = {
  output: "mathml" as const,
  throwOnError: false,
};
marked.use(markedKatex(katexOptions));

const isSelectionEmpty = ref(true);

const updateMarkdownSourceDirection = () => {
  if (!editor.value || !isMarkdownFile.value) return;

  // Do not use Ace's `rtlText`: it persists U+202B control characters during
  // edits. `rtl` changes rendering/cursor behavior without touching the doc.
  applyMarkdownSourceDirection(editor.value, markdownDirection.value);
};

watch(markdownDirection, updateMarkdownSourceDirection);

const executeEditorCommand = (name: string) => {
  if (name == "paste") {
    read()
      .then((data) => {
        editor.value?.execCommand("paste", {
          text: data,
        });
      })
      .catch((e) => {
        if (
          document.queryCommandSupported &&
          document.queryCommandSupported("paste")
        ) {
          document.execCommand("paste");
        } else {
          console.warn("the clipboard api is not supported", e);
        }
      });
    return;
  }
  if (name == "copy" || name == "cut") {
    const selectedText = editor.value?.getCopyText();
    copy({ text: selectedText });
  }
  editor.value?.execCommand(name);
};

onMounted(() => {
  window.addEventListener("keydown", keyEvent);
  window.addEventListener("beforeunload", handlePageChange);

  const fileContent = fileStore.req?.content || "";

  watchEffect(async () => {
    if (isMarkdownFile.value && isPreview.value) {
      const new_value = editor.value?.getValue() || "";
      try {
        previewContent.value = DOMPurify.sanitize(await marked(new_value));
      } catch (error) {
        console.error("Failed to convert content to HTML:", error);
        previewContent.value = "";
      }
    }
  });

  ace.config.set(
    "basePath",
    `https://cdn.jsdelivr.net/npm/ace-builds@${ace_version}/src-min-noconflict/`
  );

  if (!layoutStore.loading) {
    initEditor(fileContent);
  } else {
    const unwatch = watchEffect(() => {
      // Initialize editor when layout is loaded
      if (!layoutStore.loading) {
        setTimeout(() => {
          initEditor(fileContent);
          unwatch();
        }, 50);
      }
    });
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", keyEvent);
  window.removeEventListener("beforeunload", handlePageChange);
  editor.value?.destroy();
});

onBeforeRouteUpdate((to, from, next) => {
  // Preview and direction controls only update the query string. They must not
  // interrupt editing or prevent browser Back/Forward from restoring state.
  if (to.path === from.path) {
    next();
    return;
  }

  if (editor.value?.session.getUndoManager().isClean()) {
    next();

    return;
  }

  layoutStore.showHover({
    prompt: "discardEditorChanges",
    confirm: (event: Event) => {
      event.preventDefault();
      next();
    },
    saveAction: async () => {
      await save();
      next();
    },
  });
});

const initEditor = (fileContent: string) => {
  editor.value = ace.edit("editor", {
    value: fileContent,
    showPrintMargin: false,
    readOnly: fileStore.req?.type === "textImmutable",
    theme: getEditorTheme(authStore.user?.aceEditorTheme ?? ""),
    mode: modelist.getModeForPath(fileStore.req!.name).mode,
    wrap: true,
    enableBasicAutocompletion: true,
    enableLiveAutocompletion: true,
    enableSnippets: true,
  });

  editor.value.setFontSize(fontSize.value);
  updateMarkdownSourceDirection();
  editor.value.focus();

  const selection = editor.value?.getSelection();
  selection.on("changeSelection", function () {
    isSelectionEmpty.value = selection.isEmpty();
  });
};

const keyEvent = (event: KeyboardEvent) => {
  if (event.code === "Escape") {
    close();
  }

  if (!event.ctrlKey && !event.metaKey) {
    return;
  }

  if (event.key !== "s") {
    return;
  }

  event.preventDefault();
  save();
};

const handlePageChange = (event: BeforeUnloadEvent) => {
  if (!editor.value?.session.getUndoManager().isClean()) {
    event.preventDefault();
    // returnValue is now depecrated, though keeping in for legacy browser support
    // https://developer.mozilla.org/en-US/docs/Web/API/BeforeUnloadEvent/returnValue
    event.returnValue = true;
  }
};

const save = async (throwError?: boolean) => {
  const button = "save";
  buttons.loading("save");

  try {
    await api.put(route.path, editor.value?.getValue());
    editor.value?.session.getUndoManager().markClean();
    buttons.success(button);
  } catch (e: any) {
    buttons.done(button);
    $showError(e);
    if (throwError) throw e;
  }
};

const increaseFontSize = () => {
  fontSize.value += 1;
  editor.value?.setFontSize(fontSize.value);
  localStorage.setItem("editorFontSize", fontSize.value.toString());
};

const decreaseFontSize = () => {
  if (fontSize.value > 1) {
    fontSize.value -= 1;
    editor.value?.setFontSize(fontSize.value);
    localStorage.setItem("editorFontSize", fontSize.value.toString());
  }
};

const close = () => {
  if (!editor.value?.session.getUndoManager().isClean()) {
    layoutStore.showHover({
      prompt: "discardEditorChanges",
      confirm: (event: Event) => {
        event.preventDefault();
        editor.value?.session.getUndoManager().reset();
        finishClose();
      },
      saveAction: async () => {
        try {
          await save(true);
          finishClose();
        } catch {}
      },
    });
    return;
  }
  finishClose();
};

const finishClose = () => {
  const uri = url.removeLastDir(route.path) + "/";
  const query = { ...route.query };
  delete query.mode;
  delete query.dir;
  router.push({ path: uri, query });
};

const preview = () => {
  router.push({
    query: {
      ...route.query,
      mode: isPreview.value ? "edit" : "preview",
    },
  });
};

const setDirection = (event: Event) => {
  const direction = (event.target as HTMLSelectElement).value;
  if (direction !== "auto" && direction !== "rtl" && direction !== "ltr") {
    return;
  }

  router.push({
    query: {
      ...route.query,
      dir: direction,
    },
  });
};
</script>

<style scoped>
.editor-font-size {
  margin: 0 0.5em;
  color: var(--fg);
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.editor-controls {
  display: flex;
  align-items: center;
}

.direction-control {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-right: 0.5rem;
  font-size: 0.8rem;
}

.direction-control select {
  color: var(--fg);
  background: var(--background);
}

.editor-controls > button {
  background: transparent;
  color: var(--action);
  border: none;
  outline: none;
  opacity: 0.8;
  cursor: pointer;
}

.editor-controls > button:hover:not(:disabled) {
  opacity: 1;
}

.editor-controls > button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.editor-controls > button > span > i {
  font-size: 1.2rem;
}
</style>
