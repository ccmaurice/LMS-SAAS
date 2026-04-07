"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import { TextStyleKit } from "@tiptap/extension-text-style";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  BetweenHorizontalEnd,
  BetweenVerticalEnd,
  Bold,
  Code2,
  Eraser,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Maximize2,
  Minimize2,
  Minus,
  Quote,
  Redo2,
  Sparkles,
  Strikethrough,
  Table2,
  TableColumnsSplit,
  TableRowsSplit,
  Trash2,
  Undo2,
  Underline as UnderlineIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { sanitizeAssessmentHtml } from "@/components/assessments/sanitized-html";
import { cn } from "@/lib/utils";

const FONT_OPTIONS: { label: string; value: string }[] = [
  { label: "Default", value: "" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times", value: "Times New Roman, Times, serif" },
  { label: "Monospace", value: "ui-monospace, monospace" },
];

const SIZE_OPTIONS: { label: string; value: string }[] = [
  { label: "Size", value: "" },
  { label: "12", value: "12px" },
  { label: "14", value: "14px" },
  { label: "16", value: "16px" },
  { label: "18", value: "18px" },
  { label: "20", value: "20px" },
];

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-8 w-8 shrink-0 text-muted-foreground",
        active && "bg-muted text-foreground",
      )}
    >
      {children}
    </Button>
  );
}

function RichTextToolbar({
  editor,
  disabled,
  sourceMode,
  onToggleSource,
  fullscreen,
  onToggleFullscreen,
}: {
  editor: Editor | null;
  disabled?: boolean;
  sourceMode: boolean;
  onToggleSource: () => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  useEditorState({
    editor,
    selector: (ctx) => ctx.transactionNumber,
  });

  if (!editor || disabled) return null;

  const tt = editor.getAttributes("textStyle") as { fontFamily?: string; fontSize?: string; color?: string };

  const blockValue = editor.isActive("heading", { level: 2 })
    ? "h2"
    : editor.isActive("heading", { level: 3 })
      ? "h3"
      : "p";

  return (
    <div className="flex flex-col gap-1 border-b border-border/80 bg-muted/25 px-1.5 py-1.5 dark:bg-muted/15">
      <div className="flex flex-wrap items-center gap-0.5">
        <ToolbarButton
          title="Focus the editor. Shortcuts: Ctrl+B bold · Ctrl+I italic · Ctrl+U underline · Ctrl+Z undo · Ctrl+Shift+8 bullet list. Pasted rich text is cleaned automatically."
          onClick={() => editor.chain().focus("end").run()}
        >
          <Sparkles className="h-4 w-4 text-amber-700 dark:text-amber-400" aria-hidden />
        </ToolbarButton>
        <span className="mx-0.5 h-5 w-px bg-border/80" aria-hidden />
        <select
          className="h-8 max-w-[7.5rem] rounded-md border border-input bg-background px-1.5 text-xs text-foreground"
          value={tt.fontFamily ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) editor.chain().focus().unsetFontFamily().run();
            else editor.chain().focus().setFontFamily(v).run();
          }}
        >
          {FONT_OPTIONS.map((o) => (
            <option key={o.label} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          className="h-8 max-w-[4.5rem] rounded-md border border-input bg-background px-1.5 text-xs text-foreground"
          value={tt.fontSize ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) editor.chain().focus().unsetFontSize().run();
            else editor.chain().focus().setFontSize(v).run();
          }}
        >
          {SIZE_OPTIONS.map((o) => (
            <option key={o.label} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          className="h-8 max-w-[6.5rem] rounded-md border border-input bg-background px-1.5 text-xs text-foreground"
          value={blockValue}
          onChange={(e) => {
            const v = e.target.value;
            const chain = editor.chain().focus();
            if (v === "h2") chain.toggleHeading({ level: 2 }).run();
            else if (v === "h3") chain.toggleHeading({ level: 3 }).run();
            else chain.setParagraph().run();
          }}
        >
          <option value="p">Normal</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
        </select>
        <span className="mx-0.5 h-5 w-px bg-border/80" aria-hidden />
        <ToolbarButton
          title="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Underline"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Strikethrough"
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Clear formatting"
          onClick={() => editor.chain().focus().unsetAllMarks().setParagraph().run()}
        >
          <Eraser className="h-4 w-4" />
        </ToolbarButton>
        <label
          className="relative flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-input bg-background"
          title="Text color"
        >
          <span className="text-xs font-bold leading-none">A</span>
          <span
            className="pointer-events-none absolute bottom-1 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-sm bg-amber-400"
            style={{ backgroundColor: tt.color || "var(--color-amber-400, #fbbf24)" }}
          />
          <input
            type="color"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            value={tt.color && /^#[0-9a-f]{6}$/i.test(tt.color) ? tt.color : "#111827"}
            onInput={(e) => {
              editor.chain().focus().setColor((e.target as HTMLInputElement).value).run();
            }}
          />
        </label>
        <span className="mx-0.5 h-5 w-px bg-border/80" aria-hidden />
        <ToolbarButton
          title="Bullet list"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Numbered list"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Quote"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <select
          className="h-8 max-w-[7rem] rounded-md border border-input bg-background px-1.5 text-xs text-foreground"
          aria-label="Text alignment"
          value={
            editor.isActive({ textAlign: "center" })
              ? "center"
              : editor.isActive({ textAlign: "right" })
                ? "right"
                : "left"
          }
          onChange={(e) => {
            const v = e.target.value as "left" | "center" | "right";
            editor.chain().focus().setTextAlign(v).run();
          }}
        >
          <option value="left">Align left</option>
          <option value="center">Center</option>
          <option value="right">Align right</option>
        </select>
        <span className="mx-0.5 h-5 w-px bg-border/80" aria-hidden />
        <ToolbarButton
          title="Link"
          active={editor.isActive("link")}
          onClick={() => {
            const prev = editor.getAttributes("link").href as string | undefined;
            const url = window.prompt("Link URL", prev ?? "https://");
            if (url === null) return;
            if (url === "") {
              editor.chain().focus().extendMarkRange("link").unsetLink().run();
              return;
            }
            editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
          }}
        >
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Image"
          onClick={() => {
            const url = window.prompt("Image URL (https only recommended)");
            if (!url?.trim()) return;
            editor.chain().focus().setImage({ src: url.trim() }).run();
          }}
        >
          <ImageIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Insert table (3×3 with header row)"
          onClick={() =>
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
          }
        >
          <Table2 className="h-4 w-4" />
        </ToolbarButton>
        {editor.can().deleteTable() ? (
          <ToolbarButton title="Delete table" onClick={() => editor.chain().focus().deleteTable().run()}>
            <Trash2 className="h-4 w-4" />
          </ToolbarButton>
        ) : null}
        {editor.isActive("table") ? (
          <>
            <span
              className="mx-0.5 hidden h-5 w-px bg-amber-500/35 sm:block"
              aria-hidden
            />
            <span className="hidden rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200/90 sm:inline">
              Table
            </span>
            <ToolbarButton
              title="Add column after"
              disabled={!editor.can().addColumnAfter()}
              onClick={() => editor.chain().focus().addColumnAfter().run()}
            >
              <BetweenHorizontalEnd className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              title="Add row below"
              disabled={!editor.can().addRowAfter()}
              onClick={() => editor.chain().focus().addRowAfter().run()}
            >
              <BetweenVerticalEnd className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              title="Delete column"
              disabled={!editor.can().deleteColumn()}
              onClick={() => editor.chain().focus().deleteColumn().run()}
            >
              <TableColumnsSplit className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              title="Delete row"
              disabled={!editor.can().deleteRow()}
              onClick={() => editor.chain().focus().deleteRow().run()}
            >
              <TableRowsSplit className="h-4 w-4" />
            </ToolbarButton>
          </>
        ) : null}
        <ToolbarButton title="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <Minus className="h-4 w-4" />
        </ToolbarButton>
      </div>
      <div className="flex flex-wrap items-center gap-0.5">
        <ToolbarButton
          title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          onClick={onToggleFullscreen}
        >
          {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </ToolbarButton>
        <ToolbarButton title="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title={sourceMode ? "Visual editor" : "HTML source"} active={sourceMode} onClick={onToggleSource}>
          <Code2 className="h-4 w-4" />
        </ToolbarButton>
      </div>
    </div>
  );
}

export function AssessmentRichTextField({
  id,
  value,
  onChange,
  placeholder = "Start typing…",
  disabled,
  editorMinHeightClass = "min-h-[200px]",
  className,
  lockdownAllowInput,
  variant = "composer",
  showFooterHint = true,
}: {
  id?: string;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  editorMinHeightClass?: string;
  className?: string;
  /** Marks the field as an allowed input target in secure lockdown mode (student take view). */
  lockdownAllowInput?: boolean;
  /** Composer = authoring; respondent = learner answers (copy and hints tuned). */
  variant?: "composer" | "respondent";
  showFooterHint?: boolean;
}) {
  const [sourceMode, setSourceMode] = useState(false);
  const [sourceHtml, setSourceHtml] = useState(value);
  const [fullscreen, setFullscreen] = useState(false);
  const editorRef = useRef<Editor | null>(null);

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: {
            class: "text-primary underline underline-offset-2",
            rel: "noopener noreferrer nofollow",
            target: "_blank",
          },
        },
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyleKit.configure({
        backgroundColor: false,
        lineHeight: false,
      }),
      Image.configure({ inline: true, allowBase64: false }),
      TableKit.configure({
        table: { resizable: false },
        tableCell: { HTMLAttributes: { class: "border border-border/80 px-2 py-1.5 align-top" } },
        tableHeader: { HTMLAttributes: { class: "border border-border/80 bg-muted/40 px-2 py-1.5 font-semibold align-bottom" } },
      }),
      Placeholder.configure({ placeholder }),
    ],
    [placeholder],
  );

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions,
      content: value || "",
      editable: !disabled,
      onCreate: ({ editor: ed }) => {
        editorRef.current = ed;
      },
      onDestroy: () => {
        editorRef.current = null;
      },
      editorProps: {
        attributes: {
          class: "px-3 py-2 focus:outline-none",
        },
        handlePaste: (_view, event) => {
          const ed = editorRef.current;
          if (!ed?.view || ed.isDestroyed) return false;
          const html = event.clipboardData?.getData("text/html");
          if (!html?.trim()) return false;
          try {
            event.preventDefault();
            const clean = sanitizeAssessmentHtml(html);
            if (!clean.trim()) return true;
            ed.chain().focus().insertContent(clean).run();
            return true;
          } catch {
            return false;
          }
        },
      },
      onUpdate: ({ editor: ed }) => {
        onChange(ed.getHTML());
      },
    },
    [extensions, disabled],
  );

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const dom = editor.view.dom as HTMLElement;
    dom.setAttribute("role", "textbox");
    dom.setAttribute("aria-multiline", "true");
    dom.setAttribute(
      "aria-label",
      variant === "respondent" ? "Your answer, rich text" : "Rich text editor",
    );
    if (id) dom.id = id;
    else dom.removeAttribute("id");
  }, [editor, id, variant]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (!editor || sourceMode) return;
    const cur = editor.getHTML();
    if (value !== cur) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [value, editor, sourceMode]);

  useEffect(() => {
    if (sourceMode && editor) {
      setSourceHtml(editor.getHTML());
    }
  }, [sourceMode, editor]);

  const toggleSource = () => {
    if (!editor) return;
    if (!sourceMode) {
      setSourceHtml(editor.getHTML());
      setSourceMode(true);
      return;
    }
    const next = sourceHtml;
    editor.commands.setContent(next || "<p></p>", { emitUpdate: true });
    setSourceMode(false);
  };

  const shell = (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border border-input bg-background shadow-xs",
        fullscreen && "fixed inset-4 z-[80] shadow-2xl",
        className,
      )}
      {...(lockdownAllowInput ? { "data-lockdown-allow-input": true } : {})}
    >
      {!sourceMode ? (
        <RichTextToolbar
          editor={editor}
          disabled={disabled}
          sourceMode={sourceMode}
          onToggleSource={toggleSource}
          fullscreen={fullscreen}
          onToggleFullscreen={() => setFullscreen((f) => !f)}
        />
      ) : (
        <div className="flex items-center justify-end border-b border-border/80 bg-muted/25 px-2 py-1.5">
          <Button type="button" variant="secondary" size="sm" onClick={toggleSource}>
            Back to visual editor
          </Button>
        </div>
      )}
      {sourceMode ? (
        <Textarea
          className={cn(
            "min-h-[240px] resize-y rounded-none border-0 font-mono text-xs focus-visible:ring-0",
            editorMinHeightClass,
          )}
          value={sourceHtml}
          onChange={(e) => {
            setSourceHtml(e.target.value);
            onChange(e.target.value);
          }}
        />
      ) : (
        <div className={cn("assessment-tiptap-scope relative min-h-0 flex-1 resize-y overflow-auto", editorMinHeightClass)}>
          <EditorContent editor={editor} className="h-full min-h-[inherit]" />
          <div
            className="flex cursor-ns-resize justify-center py-0.5 text-muted-foreground/50"
            aria-hidden
            title="Resize"
          >
            <div className="h-1 w-10 rounded-full bg-border" />
          </div>
          {showFooterHint ? (
            <p className="border-t border-border/60 bg-muted/15 px-3 py-2 text-[11px] leading-snug text-muted-foreground dark:border-white/10">
              {variant === "respondent"
                ? "Paste is cleaned automatically; common shortcuts (Ctrl+B, Ctrl+I, Ctrl+Z) still work."
                : "Paste from the web or Word is sanitized. Shortcuts: Ctrl+B / Ctrl+I / Ctrl+U · Ctrl+Z undo · Ctrl+Shift+8 bullets. Use $…$ or $$…$$ for math in question text."}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );

  return shell;
}
