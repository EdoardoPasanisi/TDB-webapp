import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { adminErrorResponse } from '@/lib/admin/route';
import { listAdminChatConversations } from '@/lib/chat/db';
import type { ChatConversationStatus } from '@/types/chat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function readStatusParam(value: string | null): ChatConversationStatus | 'ACTIVE' | 'ALL' {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (
    normalized === 'BOT_ACTIVE' ||
    normalized === 'HANDOFF_REQUESTED' ||
    normalized === 'ADMIN_ACTIVE' ||
    normalized === 'CLOSED'
  ) {
    return normalized;
  }
  if (normalized === 'ALL') return 'ALL';
  return 'ACTIVE';
}

export async function GET(request: Request) {
  try {
    const access = await requireStaffAccess('view');
    const { searchParams } = new URL(request.url);
    const status = readStatusParam(searchParams.get('status'));
    const items = await listAdminChatConversations({ status, access });
    return NextResponse.json({ items });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
