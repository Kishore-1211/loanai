'use client';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, ChevronDown } from 'lucide-react';
import { useAuthStore } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/customers': 'Customers',
  '/loans': 'Loans',
  '/reports': 'Reports',
  '/ai': 'AI Assistant',
  '/staff': 'Staff Management',
  '/settings': 'Settings',
  '/audit-logs': 'Audit Logs',
  '/payments/new': 'Record Payment',
};

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  if (pathname.startsWith('/customers/') && pathname.endsWith('/new')) return 'New Customer';
  if (pathname.startsWith('/loans/') && pathname.endsWith('/new')) return 'New Loan';
  if (pathname.startsWith('/customers/')) return 'Customer Detail';
  if (pathname.startsWith('/loans/')) return 'Loan Detail';
  if (pathname.startsWith('/receipts/')) return 'Receipt';
  return 'GoldLoan AI';
}

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    }
    clearAuth();
    router.replace('/login');
  };

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
      <h2 className="font-semibold text-slate-900">{getPageTitle(pathname)}</h2>
      <div className="flex items-center gap-3">
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-slate-100 transition-colors">
              <span className="text-sm text-slate-700">{user.fullName}</span>
              <Badge
                variant="outline"
                className={
                  user.role === 'OWNER'
                    ? 'text-yellow-700 border-yellow-300 bg-yellow-50'
                    : 'text-slate-600 border-slate-300'
                }
              >
                {user.role}
              </Badge>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleLogout} className="text-red-600 cursor-pointer">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
