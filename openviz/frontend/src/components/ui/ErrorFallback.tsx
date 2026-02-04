// ============================================
// ErrorFallback - Graceful error recovery UI
// ============================================

import { AlertTriangle, RefreshCw, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary?: () => void;
  componentName?: string;
  compact?: boolean;
}

export function ErrorFallback({
  error,
  resetErrorBoundary,
  componentName,
  compact = false,
}: ErrorFallbackProps) {
  const handleReportBug = () => {
    const issueUrl = new URL('https://github.com/anthropics/claude-code/issues/new');
    issueUrl.searchParams.set('title', `[OpenViz Bug] ${error.name}: ${error.message.slice(0, 50)}`);
    issueUrl.searchParams.set('body', `
## Error Details
- **Component**: ${componentName || 'Unknown'}
- **Error**: ${error.name}
- **Message**: ${error.message}

## Stack Trace
\`\`\`
${error.stack || 'No stack trace available'}
\`\`\`

## Steps to Reproduce
1.
2.
3.

## Expected Behavior


## Additional Context

    `.trim());
    window.open(issueUrl.toString(), '_blank');
  };

  if (compact) {
    return (
      <div className="flex items-center justify-center h-full w-full p-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="p-2 rounded-full bg-red-500/10">
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Something went wrong</p>
          </div>
          {resetErrorBoundary && (
            <Button
              variant="outline"
              size="sm"
              onClick={resetErrorBoundary}
              className="gap-1.5"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full w-full p-6">
      <div className="max-w-md w-full">
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 backdrop-blur-sm p-6">
          {/* Header */}
          <div className="flex items-start gap-4 mb-4">
            <div className="p-3 rounded-full bg-red-500/10 shrink-0">
              <AlertTriangle className="h-6 w-6 text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-foreground mb-1">
                Something went wrong
              </h3>
              <p className="text-sm text-muted-foreground">
                {componentName
                  ? `An error occurred in the ${componentName} component.`
                  : 'An unexpected error occurred.'}
              </p>
            </div>
          </div>

          {/* Error Details */}
          <div className="mb-4 p-3 rounded-lg bg-black/20 border border-white/5">
            <p className="text-xs font-mono text-red-300 break-all">
              {error.message || 'Unknown error'}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {resetErrorBoundary && (
              <Button
                variant="default"
                size="sm"
                onClick={resetErrorBoundary}
                className="gap-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-100 border-red-500/30"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try Again
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleReportBug}
              className="gap-1.5"
            >
              <Bug className="h-3.5 w-3.5" />
              Report Bug
            </Button>
          </div>

          {/* Dev Info */}
          {process.env.NODE_ENV === 'development' && error.stack && (
            <details className="mt-4">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                Show stack trace (dev only)
              </summary>
              <pre className="mt-2 p-2 rounded bg-black/30 text-[10px] font-mono text-muted-foreground overflow-auto max-h-32 whitespace-pre-wrap break-all">
                {error.stack}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
