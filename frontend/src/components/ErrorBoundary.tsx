import { Component, type ReactNode, type ErrorInfo } from 'react';
import { showToast } from '../lib/toast';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorMessage: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
    showToast('error', `Something went wrong: ${error.message}`);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: '#080e1a',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#dde6ee',
          gap: '1.25rem',
          padding: '2rem',
          zIndex: 8000,
        }}>
          <div style={{
            fontSize: '1rem',
            color: '#9db8cc',
            textAlign: 'center',
            maxWidth: '480px',
            lineHeight: 1.65,
          }}>
            Something went wrong. The error has been logged.
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#00e5a0',
              color: '#080e1a',
              border: 'none',
              borderRadius: '0.375rem',
              padding: '0.5rem 1.5rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
