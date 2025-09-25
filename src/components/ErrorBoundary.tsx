import React from 'react';
import { emitToast } from '../lib/toast';

type Props = { children: React.ReactNode };
type State = { hasError: boolean; message?: string };

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, message: (error as Error)?.message || 'Something went wrong' };
  }

  componentDidCatch(error: unknown) {
    const message = (error as Error)?.message || 'Unexpected error';
    emitToast({ message, variant: 'error' });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="sc-card p-6 max-w-md text-center">
            <h1 className="text-xl font-semibold mb-2" style={{ color: 'var(--sc-text-dark)' }}>Something went wrong</h1>
            <p className="text-sm mb-4" style={{ color: 'var(--sc-text-light)' }}>{this.state.message}</p>
            <button onClick={() => { this.setState({ hasError: false, message: undefined }); window.location.reload(); }} className="sc-primary-button">Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;


