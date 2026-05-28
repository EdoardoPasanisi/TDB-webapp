import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { adminErrorResponse } from '@/lib/admin/route';
import {
  canStaffMutateConversation,
  canStaffViewConversation,
  claimConversationByAdmin,
  closeConversationAndCreateFreshUserThread,
  getAdminConversationDetail,
  getConversationById,
  reopenConversation,
} from '@/lib/chat/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    conversationId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const access = await requireStaffAccess('view');
    const { conversationId } = await context.params;
    const conversation = await getConversationById(conversationId);
    if (!conversation) {
      return NextResponse.json({ error: 'Conversazione non trovata.' }, { status: 404 });
    }
    if (!canStaffViewConversation({ conversation, access })) {
      return NextResponse.json({ error: 'Non puoi visualizzare questa conversazione.' }, { status: 403 });
    }
    const detail = await getAdminConversationDetail(conversationId);
    if (!detail) {
      return NextResponse.json({ error: 'Conversazione non trovata.' }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const access = await requireStaffAccess(request, 'view');
    const { conversationId } = await context.params;
    const body = await request.json().catch(() => null);
    const action =
      body && typeof body === 'object' ? String((body as { action?: unknown }).action ?? '').trim() : '';

    const conversation = await getConversationById(conversationId);
    if (!conversation) {
      return NextResponse.json({ error: 'Conversazione non trovata.' }, { status: 404 });
    }

    if (action === 'claim') {
      if (!canStaffMutateConversation({ conversation, access, action: 'claim' })) {
        return NextResponse.json({ error: 'Non puoi prendere in carico questa conversazione.' }, { status: 403 });
      }
      await claimConversationByAdmin({
        conversationId,
        adminUserId: access.userId,
      });
    } else if (action === 'close') {
      if (!canStaffMutateConversation({ conversation, access, action: 'close' })) {
        return NextResponse.json({ error: 'Non puoi chiudere questa conversazione.' }, { status: 403 });
      }
      await closeConversationAndCreateFreshUserThread({
        conversationId,
        adminUserId: access.userId,
      });
    } else if (action === 'reopen') {
      if (!canStaffMutateConversation({ conversation, access, action: 'reopen' })) {
        return NextResponse.json({ error: 'Non puoi riaprire questa conversazione.' }, { status: 403 });
      }
      await reopenConversation({
        conversationId,
        adminUserId: access.userId,
      });
    } else {
      return NextResponse.json({ error: 'Azione non valida.' }, { status: 400 });
    }

    const detail = await getAdminConversationDetail(conversationId);
    if (!detail) {
      return NextResponse.json({ error: 'Conversazione non trovata.' }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    return adminErrorResponse(error);
  }
}
