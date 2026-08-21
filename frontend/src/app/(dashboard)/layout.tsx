"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Clock, Send, LogOut, Loader2, Menu, X, User, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

const baseNavItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Scheduled', href: '/scheduled', icon: Clock },
  { name: 'Sent', href: '/sent', icon: Send },
];

interface SidebarContentProps {
  pathname: string;
  setMobileMenuOpen: (open: boolean) => void;
  stats?: { scheduledCount?: number; sentCount?: number; failedCount?: number; totalCampaigns?: number };
}

const SidebarContent = ({ pathname, setMobileMenuOpen, stats }: SidebarContentProps) => {
  const navItems = [
    { ...baseNavItems[0], badge: '' },
    { ...baseNavItems[1], badge: stats?.scheduledCount?.toString() || '0' },
    { ...baseNavItems[2], badge: stats?.sentCount?.toString() || '0' },
  ];

  return (
  <div className="flex flex-col h-full bg-white px-4">
    {/* Logo */}
    <div className="h-20 flex items-center shrink-0">
      <h1 className="text-2xl font-black text-black tracking-tight" style={{ fontFamily: 'monospace' }}>
        ONB
      </h1>
    </div>



    {/* Compose Button */}
    <div className="mb-6 shrink-0">
      <Link href="/compose" onClick={() => setMobileMenuOpen(false)}>
        <button className="w-full flex items-center justify-center px-4 py-2 border border-[#00A83B] text-[#00A83B] bg-white hover:bg-[#EBF7EE] font-medium rounded-full transition-colors text-sm">
          Compose
        </button>
      </Link>
    </div>

    {/* Navigation Section */}
    <div className="flex-1 overflow-y-auto">
      <div className="px-1 mb-2">
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Core</span>
      </div>
      <nav className="space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (pathname === '/' && item.href === '/dashboard');
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center justify-between px-3 py-2 text-sm font-medium rounded-xl transition-colors ${
                isActive
                  ? 'bg-[#EBF7EE] text-black'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-black'
              }`}
            >
              <div className="flex items-center">
                <Icon className={`mr-3 h-[18px] w-[18px] ${isActive ? 'text-black' : 'text-gray-500'}`} />
                <span>{item.name}</span>
              </div>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${isActive ? 'text-gray-500' : 'text-gray-400'}`}>
                {item.badge}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>


  </div>
  );
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, logout, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const res = await api.get('/campaigns/stats');
      return res.data.data;
    },
    refetchInterval: 5000,
    enabled: !!user,
  });

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center">
          <Loader2 className="h-10 w-10 animate-spin text-[#00A83B] mb-4" />
          <p className="text-sm font-medium text-gray-500">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen bg-white font-sans text-black">
      <Toaster position="top-right" toastOptions={{
        className: 'shadow-md border border-gray-100 text-sm rounded-lg',
        style: {
          background: '#fff',
          color: '#000',
        },
      }} />
      
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col shrink-0 border-r border-gray-100 bg-white">
        <SidebarContent pathname={pathname} setMobileMenuOpen={setMobileMenuOpen} stats={stats} />
      </aside>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}></div>
          <div className="relative flex w-full max-w-xs flex-1 flex-col bg-white">
            <div className="absolute right-0 top-0 -mr-12 pt-2">
              <button
                className="ml-1 flex h-10 w-10 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X className="h-6 w-6 text-white" aria-hidden="true" />
              </button>
            </div>
            <SidebarContent pathname={pathname} setMobileMenuOpen={setMobileMenuOpen} stats={stats} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden bg-white">
        <header className="sticky top-0 z-10 flex h-16 flex-shrink-0 items-center justify-between border-b border-gray-100 bg-white px-4 shadow-sm md:px-6">
          <div className="flex items-center">
            <button
              type="button"
              className="-m-2.5 p-2.5 text-black md:hidden"
              onClick={() => setMobileMenuOpen(true)}
            >
              <span className="sr-only">Open sidebar</span>
              <Menu className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex flex-col items-end mr-2">
              <p className="text-sm font-medium text-black leading-tight">
                {user?.name || 'Anonymous'}
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {user?.email || 'No email'}
              </p>
            </div>
            <div className="relative h-9 w-9 shrink-0">
              {user?.picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.picture}
                  alt={user.name || 'User Profile'}
                  className="rounded-full object-cover h-full w-full"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="h-full w-full rounded-full bg-[#EBF7EE] flex items-center justify-center text-[#00A83B]">
                  <User className="h-5 w-5" />
                </div>
              )}
            </div>
            <button
              onClick={logout}
              className="p-2 text-gray-400 hover:text-red-600 transition-colors ml-2"
              title="Logout"
            >
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
