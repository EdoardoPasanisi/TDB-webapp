import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { CHAT_KB_PATH } from '@/lib/chat/config';

let cachedKnowledgeBase: string | null = null;

export async function loadChatKnowledgeBase(): Promise<string> {
  if (cachedKnowledgeBase) return cachedKnowledgeBase;

  const filePath = path.resolve(process.cwd(), CHAT_KB_PATH);
  const content = await readFile(filePath, 'utf8');
  cachedKnowledgeBase = content.trim();
  return cachedKnowledgeBase;
}
