import { AdminConsole } from '@/components/admin/AdminConsole';
import { ConfirmProvider } from '@/components/admin/ConfirmProvider';
import { ADMIN_TABS, type AdminTab } from '@/components/admin/shared';

type AdminPageProps = {
  searchParams?: Promise<{
    tab?: string;
  }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const resolved = searchParams ? await searchParams : undefined;
  const requestedTab = typeof resolved?.tab === 'string' ? resolved.tab.trim() : '';
  const initialTab =
    requestedTab && ADMIN_TABS.some((item) => item.key === requestedTab)
      ? (requestedTab as AdminTab)
      : null;

  return (
    <ConfirmProvider>
      <AdminConsole initialTabFromQuery={initialTab} />
    </ConfirmProvider>
  );
}
