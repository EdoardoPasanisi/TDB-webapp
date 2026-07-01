import { AdminConsole } from '@/components/admin/AdminConsole';
import { ConfirmProvider } from '@/components/admin/ConfirmProvider';

type AdminPageProps = {
  searchParams?: Promise<{
    tab?: string;
  }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const resolved = searchParams ? await searchParams : undefined;
  // Validazione del tab fatta lato client in AdminConsole: ADMIN_TABS vive in un
  // modulo 'use client', quindi importarlo qui (Server Component) lo trasformerebbe
  // in un client-reference e `.some` lancerebbe 500 quando il tab è presente.
  const requestedTab = typeof resolved?.tab === 'string' ? resolved.tab.trim() : '';

  return (
    <ConfirmProvider>
      <AdminConsole initialTabFromQuery={requestedTab || null} />
    </ConfirmProvider>
  );
}
