"use client";

import {
  NotionLayout,
  HeadingBlock,
  TextBlock,
  BulletListBlock,
  NumberedListBlock,
  ToggleBlock,
  CalloutBlock,
  QuoteBlock,
  DividerBlock,
  TodoBlock,
  CodeBlock,
} from "@/components/notion";

export default function NotionDemoPage() {
  return (
    <NotionLayout
      workspaceName="Acme Corp"
      userInitial="A"
      breadcrumbs={["Projects"]}
      pageTitle="Getting Started"
    >
      {/* Page body */}
      <div className="max-w-[900px] mx-auto pt-16 pb-32 pl-[96px] pr-[96px]">
        {/* ── Page header ─────────────────────────────── */}
        <div className="mb-2 group">
          {/* Cover hover area */}
          <div className="mb-6 -mx-[96px] h-[200px] bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-end px-[96px] pb-4 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/10 dark:to-black/30" />
          </div>

          {/* Page icon */}
          <div className="-mt-8 mb-4 text-[72px] leading-none select-none cursor-pointer hover:bg-[var(--notion-hover)] rounded-notion-md inline-flex items-center justify-center w-[80px] h-[80px]">
            🚀
          </div>

          {/* Page title */}
          <div
            contentEditable
            suppressContentEditableWarning
            className="notion-block text-[40px] font-bold leading-[1.2] tracking-[-0.02em] text-[var(--notion-text)] outline-none cursor-text w-full break-words mb-1"
            data-placeholder="Untitled"
            dangerouslySetInnerHTML={{ __html: "Getting Started" }}
          />

          {/* Page subtitle / description row */}
          <div className="flex items-center gap-2 mt-3 mb-8">
            {/* Properties row (Notion-style) */}
            {[
              { key: "Created", value: "Apr 16, 2026" },
              { key: "Author", value: "You" },
              { key: "Status", value: "In Progress", accent: true },
            ].map(({ key, value, accent }) => (
              <div
                key={key}
                className="flex items-center gap-1.5 h-[28px] px-2 rounded-notion hover:bg-[var(--notion-hover)] cursor-pointer"
              >
                <span className="text-[14px] text-[var(--notion-text-2)]">{key}</span>
                <span
                  className={`text-[14px] font-medium px-1.5 py-0.5 rounded-notion ${
                    accent
                      ? "bg-notion-blue/10 text-notion-blue"
                      : "text-[var(--notion-text)]"
                  }`}
                >
                  {value}
                </span>
              </div>
            ))}
            <button className="flex items-center gap-1.5 h-[28px] px-2 rounded-notion hover:bg-[var(--notion-hover)] text-[14px] text-[var(--notion-text-2)]">
              + Add a property
            </button>
          </div>
        </div>

        {/* ── Block content ────────────────────────────── */}
        <div className="relative pl-14 space-y-0.5">
          <TextBlock content="Welcome to your Notion workspace. This is a fully editable block-based page. Every element below is a separate block that you can edit, move, and delete." />

          <div className="pt-2" />
          <HeadingBlock level={1} content="The Block System" />
          <TextBlock content="Notion is built around blocks. Everything you see is a block — text, headings, images, databases. Click anywhere to start editing." />

          <div className="pt-1" />
          <HeadingBlock level={2} content="Text Formatting" />
          <TextBlock content="Use rich text to <strong>bold</strong>, <em>italicize</em>, or <code style='font-family: SFMono-Regular, Menlo, monospace; background: rgba(135,131,120,0.15); border-radius: 3px; padding: 2px 4px; font-size: 85%;'>inline code</code> any text. Highlight text to see the toolbar." />

          <div className="pt-1" />
          <HeadingBlock level={2} content="Lists" />
          <BulletListBlock content="Brainstorm freely — bullet lists are great for unstructured ideas" />
          <BulletListBlock content="Indent nested items with Tab for hierarchy" />
          <BulletListBlock content="Press Enter to add the next item" depth={1} />
          <BulletListBlock content="Press Backspace on empty item to exit the list" depth={1} />

          <div className="pt-2" />
          <NumberedListBlock content="Plan your project in steps" index={1} />
          <NumberedListBlock content="Execute with precision" index={2} />
          <NumberedListBlock content="Review and iterate" index={3} />

          <div className="pt-1" />
          <HeadingBlock level={2} content="Tasks" />
          <TodoBlock content="Read the Notion documentation" checked={true} />
          <TodoBlock content="Set up your workspace" checked={true} />
          <TodoBlock content="Invite team members" />
          <TodoBlock content="Create your first database" />
          <TodoBlock content="Build an AI agent" />

          <div className="pt-1" />
          <HeadingBlock level={2} content="Callouts" />
          <CalloutBlock
            icon="💡"
            color="blue"
            content="Pro tip: Use callouts to highlight important information, warnings, or tips."
          />
          <CalloutBlock
            icon="⚠️"
            color="yellow"
            content="This is a warning callout. Use it to draw attention to critical steps."
          />
          <CalloutBlock
            icon="✅"
            color="green"
            content="Success! You've completed this section."
          />

          <div className="pt-1" />
          <HeadingBlock level={2} content="Toggles" />
          <ToggleBlock summary="What is a toggle block?" defaultOpen={false}>
            <TextBlock content="A toggle block hides content until you click the arrow. Great for FAQs, spoilers, or any content you want to keep accessible but out of the way." />
          </ToggleBlock>
          <ToggleBlock summary="How do I add nested blocks?" defaultOpen={true}>
            <TextBlock content="Click inside the toggle body and type normally. You can add any block type inside a toggle, including other toggles." />
            <BulletListBlock content="TextBlock" />
            <BulletListBlock content="HeadingBlock" />
            <BulletListBlock content="Another ToggleBlock" />
          </ToggleBlock>

          <div className="pt-1" />
          <HeadingBlock level={2} content="Quotes & Dividers" />
          <QuoteBlock content="The best productivity system is the one you'll actually use." />
          <DividerBlock className="my-4" />
          <TextBlock content="Content after a divider continues here. Use dividers to visually separate major sections." />

          <div className="pt-1" />
          <HeadingBlock level={2} content="Code" />
          <CodeBlock
            language="typescript"
            content={`function greet(name: string): string {\n  return \`Hello, \${name}!\`;\n}\n\nconsole.log(greet("Notion"));`}
          />

          <div className="pt-1" />
          <HeadingBlock level={2} content="Cards" />
          <div className="grid grid-cols-3 gap-3 mt-2">
            {[
              { icon: "📄", title: "Docs", desc: "Write and collaborate on documents" },
              { icon: "🗃️", title: "Databases", desc: "Track anything in tables, boards, and calendars" },
              { icon: "🤖", title: "AI Agents", desc: "Automate workflows with Notion Agent" },
            ].map(({ icon, title, desc }) => (
              <div
                key={title}
                className="p-4 rounded-notion-lg border border-[var(--notion-border)] hover:border-[var(--notion-border-2)] hover:shadow-notion-sm bg-[var(--notion-bg)] cursor-pointer transition-shadow group"
              >
                <div className="text-[24px] mb-2">{icon}</div>
                <div className="text-[14px] font-semibold text-[var(--notion-text)] mb-1">{title}</div>
                <div className="text-[13px] text-[var(--notion-text-2)] leading-[1.4]">{desc}</div>
              </div>
            ))}
          </div>

          <DividerBlock className="my-6" />
          <TextBlock content="Type '/' anywhere to insert a new block. Try headings, databases, embedded files, and more." />
        </div>
      </div>
    </NotionLayout>
  );
}
