'use client';

const BOOKING_DRAFT_PREFIX = 'booking-draft-v1';

function buildDraftStorageKey(scope: string, ownerKey: string): string {
  return `${BOOKING_DRAFT_PREFIX}:${scope}:${ownerKey}`;
}

export function buildSlotBookingDraftKey(userId: string, groupKey: string): string {
  return buildDraftStorageKey('slot', `${userId}:${groupKey}`);
}

export function buildPensioneBookingDraftKey(userId: string, bookingId: string | null | undefined): string {
  return buildDraftStorageKey('pensione', `${userId}:${bookingId ?? 'new'}`);
}

export function readBookingDraft<T>(key: string | null | undefined): T | null {
  if (typeof window === 'undefined' || !key) return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeBookingDraft(key: string | null | undefined, value: unknown): void {
  if (typeof window === 'undefined' || !key) return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function clearBookingDraft(key: string | null | undefined): void {
  if (typeof window === 'undefined' || !key) return;

  try {
    window.localStorage.removeItem(key);
  } catch {}
}
