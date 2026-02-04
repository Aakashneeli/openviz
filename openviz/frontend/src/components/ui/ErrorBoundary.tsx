// ============================================
// ErrorBoundary - React Error Boundary wrapper
// ============================================

import { Component, type ReactNode, type ErrorInfo } from 'react';
import { ErrorFallback } from '@/components/ui/ErrorFallback';

interface ErrorBoundaryProps {
  children: ReactNode;
  componentName?: string;
  fallback?: ReactNode;
  compact?: boolean;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to console
    console.error(
      `[ErrorBoundary] Error caught in ${this.props.componentName || 'component'}:`,
      error,
      errorInfo
    );

    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  resetErrorBoundary = (): void => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Use default ErrorFallback
      return (
        <ErrorFallback
          error={this.state.error}
          resetErrorBoundary={this.resetErrorBoundary}
          componentName={this.props.componentName}
          compact={this.props.compact}
        />
      );
    }

    return this.props.children;
  }
}

// Convenience HOC for wrapping components
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName: string,
  compact = false
) {
  return function WithErrorBoundaryWrapper(props: P) {
    return (
      <ErrorBoundary componentName={componentName} compact={compact}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}
