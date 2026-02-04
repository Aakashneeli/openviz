// ============================================
// Main App Entry Point
// ============================================

import { AppLayout } from '@/components/layout/AppLayout';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { Toaster } from '@/components/ui/Toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import './index.css';

function App() {
  return (
    <ErrorBoundary componentName="Application">
      <TooltipProvider delayDuration={300}>
        <AppLayout />
        <Toaster />
      </TooltipProvider>
    </ErrorBoundary>
  );
}

export default App;
