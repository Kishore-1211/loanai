'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  HandCoins,
  AlertTriangle,
  BarChart3,
  Bot,
  UserCog,
  Settings,
  Shield,
  Coins,
} from 'lucide-react';
import { useAuthStore } from '@/lib/auth';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/loans', label: 'Loans', icon: HandCoins },
  { href: '/loans?status=OVERDUE', label: 'Overdue', icon: AlertTriangle, className: 'text-red-600', basePath: '/loans' },
  { href: '/reports', label: 'Reports', icon: BarChart3, permission: 'VIEW_REPORTS' },
  { href: '/ai', label: 'AI Assistant', icon: Bot, permission: 'USE_AI_ASSISTANT' },
  { href: '/staff', label: 'Staff', icon: UserCog, ownerOnly: true },
  { href: '/settings', label: 'Settings', icon: Settings, ownerOnly: true },
  { href: '/audit-logs', label: 'Audit Logs', icon: Shield, ownerOnly: true },
] as const;

export function Sidebar({ open = false, onClose }: { open?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const isOwner = useAuthStore((s) => s.isOwner);
  const hasPermission = useAuthStore((s) => s.hasPermission);

  const visibleItems = navItems.filter((item) => {
    if ('ownerOnly' in item && item.ownerOnly) return isOwner();
    if ('permission' in item && item.permission) return hasPermission(item.permission);
    return true;
  });

  return (
    <>
      {/* Backdrop — only on mobile while the drawer is open */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/40 transition-opacity md:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-60 bg-white border-r border-slate-200 flex flex-col h-full shrink-0',
          'transform transition-transform duration-200 md:static md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Coins className="h-6 w-6 text-yellow-600" />
          <span className="font-bold text-slate-900">GoldLoan AI</span>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const basePath = 'basePath' in item ? (item as { basePath: string }).basePath : item.href.split('?')[0];
          const isActive = 'exact' in item && item.exact
            ? pathname === '/'
            : pathname.startsWith(basePath) && basePath !== '/';
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-yellow-50 text-yellow-800'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                'className' in item ? item.className : undefined,
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
    </>
  );
}
