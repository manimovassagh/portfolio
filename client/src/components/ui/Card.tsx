import type { HTMLAttributes, ReactNode } from 'react';

export function Card({ children, className = '', ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div {...props} className={`rounded-lg border border-slate-200 bg-white shadow-sm dark:border-[#303030] dark:bg-[#202020] ${className}`}>
      {children}
    </div>
  );
}
