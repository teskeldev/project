/**
 * Context compaction — summarizes long conversations to fit within
 * the AI's context window. When a thread exceeds a threshold,
 * older messages are summarized into a single "compaction" message.
 */
import { prisma } from "@/lib/db";
import { chat, type AIMessage } from "@/lib/ai/provider";

const COMPACTION_THRESHOLD = 30; // messages before compaction triggers
const KEEP_RECENT = 10; // always keep the last N messages uncompacted
const MAX_SUMMARY_TOKENS = 500;

const COMPACTION_PROMPT = `You are a conversation summarizer. Summarize the following conversation between a user and an AI coding assistant. Preserve:
- Key decisions made
- Important code changes discussed
- Unresolved questions or tasks
- Technical context that would be needed to continue the conversation

Format as a concise bullet-point summary. Do NOT include greetings or filler.`;

export type CompactionResult = {
  summary: string;
  compactedCount: number;
  remainingCount: number;
};

/**
 * Check if a thread needs compaction and perform it if so.
 * Returns null if no compaction was needed.
 */
export async function compactThreadIfNeeded(
  threadId: string,
  options?: { workspaceId?: string }
): Promise<CompactionResult | null> {
  const messages = await prisma.chatMessage.findMany({
    where: { threadId },
    orderBy: { createdAt: "asc" },
    select: { id: true, role: true, content: true, createdAt: true },
  });

  if (messages.length <= COMPACTION_THRESHOLD) {
    return null; // No compaction needed
  }

  // Split: messages to compact vs messages to keep
  const toCompact = messages.slice(0, messages.length - KEEP_RECENT);
  const toKeep = messages.slice(messages.length - KEEP_RECENT);

  // Build conversation text for summarization
  const conversationText = toCompact
    .map((m) => `[${m.role}]: ${m.content.slice(0, 500)}`)
    .join("\n\n");

  const aiMessages: AIMessage[] = [
    { role: "system", content: COMPACTION_PROMPT },
    {
      role: "user",
      content: `Summarize this conversation (${toCompact.length} messages):\n\n${conversationText}`,
    },
  ];

  const summary = await chat(aiMessages, {
    temperature: 0.2,
    maxTokens: MAX_SUMMARY_TOKENS,
    workspaceId: options?.workspaceId,
  });

  // Delete old messages and insert summary as a SYSTEM message
  await prisma.$transaction([
    prisma.chatMessage.deleteMany({
      where: { id: { in: toCompact.map((m) => m.id) } },
    }),
    prisma.chatMessage.create({
      data: {
        threadId,
        role: "SYSTEM",
        content: `[Conversation Summary - ${toCompact.length} messages compacted]\n\n${summary}`,
        metadata: { type: "compaction", compactedCount: toCompact.length },
      },
    }),
  ]);

  return {
    summary,
    compactedCount: toCompact.length,
    remainingCount: toKeep.length + 1, // +1 for the summary message
  };
}

/**
 * Force compaction of a thread regardless of message count.
 * Requires at least KEEP_RECENT + 1 messages to have something to compact.
 */
export async function forceCompactThread(
  threadId: string,
  options?: { workspaceId?: string }
): Promise<CompactionResult | null> {
  const messages = await prisma.chatMessage.findMany({
    where: { threadId },
    orderBy: { createdAt: "asc" },
    select: { id: true, role: true, content: true, createdAt: true },
  });

  if (messages.length <= KEEP_RECENT + 1) {
    return null; // Not enough messages to compact
  }

  const toCompact = messages.slice(0, messages.length - KEEP_RECENT);
  const toKeep = messages.slice(messages.length - KEEP_RECENT);

  const conversationText = toCompact
    .map((m) => `[${m.role}]: ${m.content.slice(0, 500)}`)
    .join("\n\n");

  const aiMessages: AIMessage[] = [
    { role: "system", content: COMPACTION_PROMPT },
    {
      role: "user",
      content: `Summarize this conversation (${toCompact.length} messages):\n\n${conversationText}`,
    },
  ];

  const summary = await chat(aiMessages, {
    temperature: 0.2,
    maxTokens: MAX_SUMMARY_TOKENS,
    workspaceId: options?.workspaceId,
  });

  await prisma.$transaction([
    prisma.chatMessage.deleteMany({
      where: { id: { in: toCompact.map((m) => m.id) } },
    }),
    prisma.chatMessage.create({
      data: {
        threadId,
        role: "SYSTEM",
        content: `[Conversation Summary - ${toCompact.length} messages compacted]\n\n${summary}`,
        metadata: { type: "compaction", compactedCount: toCompact.length },
      },
    }),
  ]);

  return {
    summary,
    compactedCount: toCompact.length,
    remainingCount: toKeep.length + 1,
  };
}

/**
 * Get the effective message history for AI context.
 * If compaction has occurred, the summary message is included.
 */
export async function getEffectiveMessages(
  threadId: string
): Promise<AIMessage[]> {
  const messages = await prisma.chatMessage.findMany({
    where: { threadId },
    orderBy: { createdAt: "asc" },
    select: { role: true, content: true, metadata: true },
  });

  return messages.map((m) => ({
    role:
      m.role === "USER"
        ? ("user" as const)
        : m.role === "ASSISTANT"
          ? ("assistant" as const)
          : ("system" as const),
    content: m.content,
  }));
}
