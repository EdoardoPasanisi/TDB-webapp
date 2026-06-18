import { PrintBookingClient } from './PrintBookingClient';

export default async function PrintPensioneBookingPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  return <PrintBookingClient bookingId={bookingId} />;
}
