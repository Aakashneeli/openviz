// ============================================
// Main App Entry Point
// ============================================

import { useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { Toaster } from '@/components/ui/Toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { getSharedStateFromURL, decompressDashboardState, clearShareStateFromURL } from '@/services/shareService';
import { useVizStore } from '@/store/useVizStore';
import { toast } from '@/lib/toast';
import './index.css';

function App() {
  const importDashboard = useVizStore(state => state.importDashboard);
  const setDashboardConfig = useVizStore(state => state.setDashboardConfig);
  const setViewMode = useVizStore(state => state.setViewMode);

  // Check for shared dashboard state in URL on mount
  useEffect(() => {
    const sharedState = getSharedStateFromURL();
    if (sharedState) {
      try {
        const { dashboard, dataset, includeDataset } = decompressDashboardState(sharedState);

        if (dataset) {
          importDashboard(dashboard, dataset);
        } else {
          // SharePayloadV2 can intentionally omit raw dataset for privacy.
          setDashboardConfig(dashboard);
          setViewMode('dashboard');
        }

        clearShareStateFromURL();

        if (includeDataset) {
          toast.success('Shared dashboard loaded', {
            description: `${dashboard.charts.length} charts loaded from shared link`,
          });
        } else {
          toast.success('Shared dashboard layout loaded', {
            description: 'Dataset was excluded from this link. Load data to render chart values.',
          });
        }
      } catch (err) {
        console.error('Failed to load shared dashboard:', err);
        clearShareStateFromURL();
        toast.error('Failed to load shared dashboard', {
          description: 'The shared link may be invalid or corrupted',
        });
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
