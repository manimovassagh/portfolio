import {
  Activity,
  ArrowLeftRight,
  BarChart2,
  Briefcase,
  CheckCircle2,
  LayoutDashboard,
  Receipt,
  Sliders,
  Star,
  Target,
  Wallet,
} from 'lucide-react';
import type { SectionId } from '../types';

export const sections: Array<{ id: SectionId; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview',  label: 'Overview',      icon: LayoutDashboard },
  { id: 'analytics', label: 'Analytics',     icon: BarChart2 },
  { id: 'holdings',  label: 'Holdings',      icon: Briefcase },
  { id: 'cash',      label: 'Cash flow',     icon: ArrowLeftRight },
  { id: 'income',    label: 'Income',        icon: Wallet },
  { id: 'realized',  label: 'Realized P&L',  icon: CheckCircle2 },
  { id: 'tax',       label: 'Tax',           icon: Receipt },
  { id: 'watchlist', label: 'Watchlist',     icon: Star },
  { id: 'rebalance', label: 'Rebalance',     icon: Sliders },
  { id: 'goals',     label: 'Goals / FIRE',  icon: Target },
];

export { Activity };
