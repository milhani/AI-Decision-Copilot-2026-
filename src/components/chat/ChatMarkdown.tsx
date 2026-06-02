import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

const components: Components = {
  h1: ({ children }) => (
    <h3 className="mb-2 mt-4 text-base font-semibold first:mt-0">{children}</h3>
  ),
  h2: ({ children }) => (
    <h4 className="mb-1.5 mt-3 text-sm font-semibold first:mt-0">{children}</h4>
  ),
  h3: ({ children }) => (
    <h5 className="mb-1 mt-2 text-sm font-medium first:mt-0">{children}</h5>
  ),
  p: ({ children }) => <p className="mb-2 leading-relaxed last:mb-0">{children}</p>,
  ul: ({ children }) => (
    <ul className="mb-2 ml-4 list-disc space-y-1.5 [&>li]:leading-relaxed">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 ml-4 list-decimal space-y-1.5 [&>li]:leading-relaxed">{children}</ol>
  ),
  li: ({ children }) => <li>{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic text-muted-foreground">{children}</em>,
  hr: () => <hr className="my-4 border-border" />,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-primary/40 pl-3 text-muted-foreground">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-primary underline-offset-2 hover:underline"
    >
      {children}
    </a>
  ),
  code: ({ className, children }) => {
    const isBlock = Boolean(className)
    if (isBlock) {
      return (
        <pre className="my-2 overflow-x-auto rounded-lg bg-background/80 p-3 text-xs leading-relaxed ring-1 ring-border">
          <code className={className}>{children}</code>
        </pre>
      )
    }
    return (
      <code className="rounded bg-background/80 px-1.5 py-0.5 font-mono text-[0.85em] ring-1 ring-border">
        {children}
      </code>
    )
  },
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-lg ring-1 ring-border">
      <table className="w-full min-w-[280px] border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/80 text-xs uppercase">{children}</thead>,
  th: ({ children }) => (
    <th className="border-b border-border px-3 py-2 font-medium">{children}</th>
  ),
  td: ({ children }) => <td className="border-b border-border/60 px-3 py-2">{children}</td>,
}

interface ChatMarkdownProps {
  content: string
}

function ChatMarkdownInner({ content }: ChatMarkdownProps) {
  return (
    <div className="chat-markdown text-sm text-foreground">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  )
}

export const ChatMarkdown = memo(ChatMarkdownInner)
