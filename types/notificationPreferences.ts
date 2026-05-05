export type NotificationPreferenceCategory = 'booking' | 'document' | 'chat' | 'media';

export type NotificationPreferences = {
  user_id: string;
  booking_in_app: boolean;
  booking_email: boolean;
  document_in_app: boolean;
  document_email: boolean;
  chat_in_app: boolean;
  chat_email: boolean;
  media_in_app: boolean;
  media_email: boolean;
  created_at: string;
  updated_at: string;
};
