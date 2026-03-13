'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!isLoading) router.replace(user ? '/dashboard' : '/auth/login');
  }, [user, isLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-600">
      <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
    </div>
  );
}
