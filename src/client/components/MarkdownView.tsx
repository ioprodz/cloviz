import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownViewProps {
  content: string;
}

export default function MarkdownView({ content }: MarkdownViewProps) {
  return (
    <div className="prose-invert max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
