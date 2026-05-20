import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (error) {
      return this.props.fallback ?? (
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-6 text-center">
          <p className="text-sm font-bold text-rose-500">Something went wrong in this view.</p>
          <p className="mt-1 text-xs text-rose-400">{error.message}</p>
          <button
            className="mt-3 rounded-md border border-rose-500/30 px-3 py-1.5 text-xs font-bold text-rose-500 hover:bg-rose-500/10"
            onClick={() => this.setState({ error: null })}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
