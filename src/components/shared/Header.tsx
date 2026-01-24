'use client';

import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { NotificationToggle } from '@/components/notifications/NotificationToggle';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Menu, LogOut, History, Home, RefreshCw } from 'lucide-react';

export function Header() {
  const { user, signOut } = useAuth();

  return (
    <header className="bg-stone-800 text-white">
      <div className="max-w-4xl mx-auto px-3 py-1.5 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-1.5">
          <span className="text-sm font-bold">CODENAMES</span>
          <span className="text-[10px] font-medium bg-emerald-600 px-1.5 py-0.5 rounded">DUET</span>
        </Link>

        {user && (
          <div className="flex items-center gap-1">
            <NotificationToggle />
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-white hover:bg-green-700 gap-2">
                <span className="hidden sm:inline">{user.username}</span>
                <Menu className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-2 py-1.5 text-sm font-medium text-stone-900">
                {user.username}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard" className="cursor-pointer">
                  <Home className="mr-2 h-4 w-4" />
                  Dashboard
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/history" className="cursor-pointer">
                  <History className="mr-2 h-4 w-4" />
                  Game History
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => window.location.reload()}
                className="cursor-pointer"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Reload App
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => signOut()}
                className="text-red-600 cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        )}
      </div>
    </header>
  );
}
