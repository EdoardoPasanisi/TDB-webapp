export type StaffNotificationType =
  | 'BOOKING_ACTION_REQUIRED'
  | 'DOCUMENT_ACTION_REQUIRED'
  | 'CHAT_ACTION_REQUIRED';

export type StaffNotificationData = {
  href?: string | null;
  adminTab?: 'overview' | 'users' | 'dogs' | 'services' | 'chat' | 'media' | 'analytics' | 'config' | null;
  bookingId?: string | null;
  documentId?: string | null;
  conversationId?: string | null;
};

export type StaffNotificationRow = {
  id: string;
  user_id: string;
  type: StaffNotificationType;
  title: string;
  body: string;
  data_json: StaffNotificationData | null;
  read_at: string | null;
  created_at: string;
};
