import {
  Activity,
  ArrowLeftRight,
  BarChart2,
  Briefcase,
  CheckCircle2,
  Globe,
  LayoutDashboard,
  Receipt,
  Sliders,
  Star,
  Target,
  Wallet,
} from 'lucide-react';
import type { SectionId } from '../types';

export const sections: Array<{ id: SectionId; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview',  label: 'Overview',   icon: LayoutDashboard },
  { id: 'markets',   label: 'Markets',    icon: Globe },
  { id: 'analytics', label: 'Analytics',  icon: BarChart2 },
  { id: 'holdings',  label: 'Holdings',   icon: Briefcase },
  { id: 'cash',      label: 'Cash',       icon: ArrowLeftRight },
  { id: 'income',    label: 'Income',     icon: Wallet },
  { id: 'realized',  label: 'P&L',        icon: CheckCircle2 },
  { id: 'tax',       label: 'Tax',        icon: Receipt },
  { id: 'watchlist', label: 'Watchlist',  icon: Star },
  { id: 'rebalance', label: 'Rebalance',  icon: Sliders },
  { id: 'goals',     label: 'FIRE',       icon: Target },
];

export { Activity };
