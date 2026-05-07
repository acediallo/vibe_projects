import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  label?: string;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[Booksmart] ErrorBoundary caught', this.props.label, error, info);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="p-4 text-sm">
          <h2 className="font-semibold text-status-dead mb-1">
            {this.props.label ?? 'Something broke'}
          </h2>
          <p className="text-xs text-slate-600 mb-3">
            {this.state.error.message}
          </p>
          <button
            onClick={this.reset}
            className="px-2 py-1 text-xs rounded border border-slate-300 hover:bg-slate-100"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
