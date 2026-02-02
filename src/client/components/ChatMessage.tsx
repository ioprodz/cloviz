import { useState } from "react";
import ThinkingBlock from "./ThinkingBlock";
import ToolUseCard from "./ToolUseCard";
import { calculateMessageCost } from "../utils/pricing";
import { formatCost } from "../utils/format";

interface ContentBlock {
  type: string;
  text?: string;
  thinking?: string;
  name?: string;
  id?: string;
  input?: unknown;
  content?: string;
  tool_use_id?: string;
}

interface Message {
  id: number;
  uuid?: string;
  type: string;
  role?: string;
  model?: string;
  content_text?: string;
  content_json?: string;
  input_tokens?: number;
  output_tokens?: number;
  cache_read_tokens?: number;
  cache_creation_tokens?: number;
  timestamp?: string;
}

interface ToolUse {
  id: number;
  message_id: number;
  tool_name: string;
  tool_use_id?: string;
  input_json?: string;
  timestamp?: string;
}

interface ChatMessageProps {
  message: Message;
  toolUses?: ToolUse[];
}

export default function ChatMessage({ message, toolUses }: ChatMessageProps) {
  const isAssistant = message.type === "assistant" || message.role === "assistant";
  const isUser = message.type === "user" || message.role === "user";

  let blocks: ContentBlock[] = [];
  if (message.content_json) {
    try {
      blocks = JSON.parse(message.content_json);
    } catch {
      // fall through to text-only
    }
  }

  const hasBlocks = blocks.length > 0;
  const msgToolUses = toolUses?.filter((t) => t.message_id === message.id) ?? [];

  const totalTokens =
    (message.input_tokens ?? 0) +
    (message.output_tokens ?? 0) +
    (message.cache_read_tokens ?? 0);

  // Per-message cost for assistant messages with model and token data
  let msgCost: number | null = null;
  if (isAssistant && message.model && totalTokens > 0) {
    msgCost = calculateMessageCost(
      message.model,
      message.input_tokens ?? 0,
      message.output_tokens ?? 0,
      message.cache_creation_tokens ?? 0,
      message.cache_read_tokens ?? 0
    );
  }

  return (
    <div
      className={`flex gap-3 py-3 ${isAssistant ? "bg-surface/50" : ""}`}
    >
      {/* Avatar */}
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
          isAssistant
            ? "bg-primary/20 text-primary"
            : "bg-blue-900/30 text-blue-400"
        }`}
      >
        {isAssistant ? "C" : "U"}
      </div>

      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-gray-400">
            {isAssistant ? "Assistant" : "User"}
          </span>
          {message.model && (
            <span className="text-[10px] bg-surface-lighter px-1.5 py-0.5 rounded text-gray-500">
              {message.model.replace("claude-", "").replace(/-\d{8}$/, "")}
            </span>
          )}
          {message.timestamp && (
            <span className="text-[10px] text-gray-600">
              {new Date(message.timestamp).toLocaleTimeString()}
            </span>
          )}
          {totalTokens > 0 && (
            <span className="text-[10px] text-gray-600">
              {totalTokens.toLocaleString()} tok
            </span>
          )}
          {msgCost !== null && msgCost > 0 && (
            <span className="text-[10px] text-primary bg-primary/10 px-1 py-0.5 rounded">
              {formatCost(msgCost)}
            </span>
          )}
        </div>

        {/* Content */}
        {hasBlocks ? (
          <div className="space-y-2">
            {blocks.map((block, i) => {
              if (block.type === "thinking" && block.thinking) {
                return <ThinkingBlock key={i} content={block.thinking} />;
              }
              if (block.type === "tool_use" && block.name) {
                return (
                  <ToolUseCard
                    key={i}
                    name={block.name}
                    input={block.input}
                    toolUseId={block.id}
                  />
                );
              }
              if (block.type === "text" && block.text) {
                return (
                  <div
                    key={i}
                    className="text-sm text-gray-200 whitespace-pre-wrap break-words"
                  >
                    {block.text}
                  </div>
                );
              }
              if (block.type === "tool_result") {
                return (
                  <div
                    key={i}
                    className="text-xs text-gray-500 bg-surface-light rounded p-2 font-mono overflow-x-auto max-h-40 overflow-y-auto"
                  >
                    {typeof block.content === "string"
                      ? block.content.slice(0, 2000)
                      : JSON.stringify(block.content)?.slice(0, 2000)}
                  </div>
                );
              }
              return null;
            })}
          </div>
        ) : (
          <div className="text-sm text-gray-200 whitespace-pre-wrap break-words">
            {message.content_text?.slice(0, 5000) || (
              <span className="text-gray-600 italic">empty</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
