import { AdminAuthProvider } from '@/src/components/admin/AdminAuthContext';

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AdminAuthProvider>
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        {children}
      </div>
    </AdminAuthProvider>
  );
}
