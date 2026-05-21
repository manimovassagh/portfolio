import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { EmptyState } from '../components/ui/Skeleton';

describe('EmptyState', () => {
  it('renders the message', () => {
    render(<EmptyState message="No data available" />);
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('renders default text when no message prop is given', () => {
    render(<EmptyState />);
    expect(screen.getByText(/Add a CSV file to exports\//)).toBeInTheDocument();
  });

  it('renders the heading', () => {
    render(<EmptyState />);
    expect(screen.getByRole('heading', { name: /No CSV export found/i })).toBeInTheDocument();
  });
});
