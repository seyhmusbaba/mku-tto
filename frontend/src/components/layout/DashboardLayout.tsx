'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Sidebar } from './Sidebar';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.replace('/auth/login');
  }, [user, isLoading, router]);

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-cream">
      <div className="spinner" />
    </div>
  );
  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-cream">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-y-auto min-w-0">{children}</main>
    </div>
  );
}
