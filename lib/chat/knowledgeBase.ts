import { readFile } from 'node:fs/promises';
import path from 'node:path';

let cachedKnowledgeBase: string | null = null;

const KNOWLEDGE_BASE_PATH = path.join(
  process.cwd(),
  'content',
  'chat',
  'tenuta-del-barone-knowledge-base-v3.md'
);

export async function loadChatKnowledgeBase(): Promise<string> {
  if (cachedKnowledgeBase) return cachedKnowledgeBase;

  const content = await readFile(KNOWLEDGE_BASE_PATH, 'utf8');
  cachedKnowledgeBase = content.trim();
  return cachedKnowledgeBase;
}
