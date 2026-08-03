import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/useAuth';
import PageLoader from '@repo/ui/PageLoader';

interface ProtectedRouteProps {
  children: ReactNode;
  type?: 'auth' | 'guest';
  redirectTo?: string;
}

export const ProtectedRoute = ({
  children,
  type = 'auth',
  redirectTo = type === 'auth' ? '/login' : '/',
}: ProtectedRouteProps) => {
  const status = useAuth((s) => s.status);
  const fetchSession = useAuth((s) => s.fetchSession);
  const navigate = useNavigate();

  useEffect(() => {
    if (status === 'idle') {
      fetchSession();
    }
  }, [status, fetchSession]);

  useEffect(() => {
    if (type === 'auth' && status === 'unauthenticated') {
      navigate(redirectTo);
    }
    if (type === 'guest' && status === 'authenticated') {
      navigate(redirectTo);
    }
  }, [status, type, redirectTo, navigate]);

  if (status === 'idle' || status === 'loading') {
    return <PageLoader />;
  }

  if (
    (type === 'auth' && status !== 'authenticated') ||
    (type === 'guest' && status === 'authenticated')
  ) {
    return null;
  }

  return <>{children}</>;
};
