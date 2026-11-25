import { Building2, ArrowLeftRight, HandCoins, LayoutDashboard, Settings } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

export const bottomNavItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/residency', label: 'Residency', icon: Building2 },
  { to: '/loans', label: 'Loans', icon: HandCoins },
  { to: '/expenses', label: 'Expenses', icon: ArrowLeftRight },
  { to: '/settings', label: 'Settings', icon: Settings },
]
