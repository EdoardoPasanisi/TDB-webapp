import { PrintWaiverClient } from './PrintWaiverClient';

export default async function PrintWaiverPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  return <PrintWaiverClient userId={userId} />;
}
