export type NotificationType =
  | 'CHAT_OPERATOR_REPLY'
  | 'DOCUMENT_STATUS'
  | 'BOOKING_STATUS'
  | 'MEDIA_AVAILABLE';

export type NotificationData = {
  href?: string | null;
  conversationId?: string | null;
  bookingId?: string | null;
  bookingKind?: 'PENSIONE' | 'SERVICE_SLOT' | null;
  documentKind?: 'ID_DOCUMENT' | 'WAIVER_SIGNED' | null;
  status?: string | null;
};

export type NotificationRow = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data_json: NotificationData | null;
  read_at: string | null;
  created_at: string;
};
