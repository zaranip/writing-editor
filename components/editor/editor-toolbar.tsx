"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
  Highlighter,
  Quote,
  Minus,
  Code,
} from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface EditorToolbarProps {
  editor: any;
}

interface ToolItem {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  action: () => void;
  disabled?: boolean;
  isActive?: boolean;
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  if (!editor) return null;

  const tools: { group: string; items: ToolItem[] }[] = [
    {
      group: "history",
      items: [
        {
          icon: Undo,
          title: "Undo",
          action: () => editor.chain().focus().undo().run(),
          disabled: !editor.can().undo(),
        },
        {
          icon: Redo,
          title: "Redo",
          action: () => editor.chain().focus().redo().run(),
          disabled: !editor.can().redo(),
        },
      ],
    },
    {
      group: "headings",
      items: [
        {
          icon: Heading1,
          title: "Heading 1",
          action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
          isActive: editor.isActive("heading", { level: 1 }),
        },
        {
          icon: Heading2,
          title: "Heading 2",
          action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
          isActive: editor.isActive("heading", { level: 2 }),
        },
        {
          icon: Heading3,
          title: "Heading 3",
          action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
          isActive: editor.isActive("heading", { level: 3 }),
        },
      ],
    },
    {
      group: "formatting",
      items: [
        {
          icon: Bold,
          title: "Bold",
          action: () => editor.chain().focus().toggleBold().run(),
          isActive: editor.isActive("bold"),
        },
        {
          icon: Italic,
          title: "Italic",
          action: () => editor.chain().focus().toggleItalic().run(),
          isActive: editor.isActive("italic"),
        },
        {
          icon: Underline,
          title: "Underline",
          action: () => editor.chain().focus().toggleUnderline().run(),
          isActive: editor.isActive("underline"),
        },
        {
          icon: Strikethrough,
          title: "Strikethrough",
          action: () => editor.chain().focus().toggleStrike().run(),
          isActive: editor.isActive("strike"),
        },
        {
          icon: Highlighter,
          title: "Highlight",
          action: () => editor.chain().focus().toggleHighlight().run(),
          isActive: editor.isActive("highlight"),
        },
        {
          icon: Code,
          title: "Code",
          action: () => editor.chain().focus().toggleCode().run(),
          isActive: editor.isActive("code"),
        },
      ],
    },
    {
      group: "alignment",
      items: [
        {
          icon: AlignLeft,
          title: "Align left",
          action: () => editor.chain().focus().setTextAlign("left").run(),
          isActive: editor.isActive({ textAlign: "left" }),
        },
        {
          icon: AlignCenter,
          title: "Align center",
          action: () => editor.chain().focus().setTextAlign("center").run(),
          isActive: editor.isActive({ textAlign: "center" }),
        },
        {
          icon: AlignRight,
          title: "Align right",
          action: () => editor.chain().focus().setTextAlign("right").run(),
          isActive: editor.isActive({ textAlign: "right" }),
        },
      ],
    },
    {
      group: "blocks",
      items: [
        {
          icon: List,
          title: "Bullet list",
          action: () => editor.chain().focus().toggleBulletList().run(),
          isActive: editor.isActive("bulletList"),
        },
        {
          icon: ListOrdered,
          title: "Ordered list",
          action: () => editor.chain().focus().toggleOrderedList().run(),
          isActive: editor.isActive("orderedList"),
        },
        {
          icon: Quote,
          title: "Blockquote",
          action: () => editor.chain().focus().toggleBlockquote().run(),
          isActive: editor.isActive("blockquote"),
        },
        {
          icon: Minus,
          title: "Horizontal rule",
          action: () => editor.chain().focus().setHorizontalRule().run(),
        },
      ],
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b p-1">
      {tools.map((group, gi) => (
        <div key={group.group} className="flex items-center">
          {gi > 0 && <Separator orientation="vertical" className="mx-1 h-6" />}
          {group.items.map((item) => (
            <Button
              key={item.title}
              variant="ghost"
              size="icon"
              className={`h-8 w-8 ${item.isActive ? "bg-muted" : ""}`}
              onClick={item.action}
              disabled={item.disabled}
              title={item.title}
              type="button"
            >
              <item.icon className="h-4 w-4" />
            </Button>
          ))}
        </div>
      ))}
    </div>
  );
}
