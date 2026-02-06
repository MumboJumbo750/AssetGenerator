import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AppDataProvider } from "./context/AppDataContext";
import { ExpertModeProvider } from "./context/ExpertModeContext";
import { AppShellLayout } from "./layouts/AppShellLayout";
import { DashboardPage } from "./pages/dashboard/DashboardPage";
import { ExceptionInbox } from "./pages/exceptions/ExceptionInbox";
import { ExportPage } from "./pages/export/ExportPage";
import { LibraryPage } from "./pages/library/LibraryPage";
import { PipelinePage } from "./pages/pipeline/PipelinePage";
import { ReviewPage } from "./pages/review/ReviewPage";
import { SettingsPage } from "./pages/settings/SettingsPage";
import { TrendDashboardPage } from "./pages/trends/TrendDashboardPage";
import { MetricsDashboardPage } from "./pages/metrics/MetricsDashboardPage";
import { AdminPage } from "./pages/AdminPage";
import { AssetsPage } from "./pages/AssetsPage";
import { AtlasesPage } from "./pages/AtlasesPage";
import { AutomationPage } from "./pages/AutomationPage";
import { ExportsPage } from "./pages/ExportsPage";
import { HelpPage } from "./pages/HelpPage";
import { JobsPage } from "./pages/JobsPage";
import { LogsPage } from "./pages/LogsPage";
import { OverviewPage } from "./pages/OverviewPage";
import { PixiPage } from "./pages/PixiPage";
import { ReviewPage as ClassicReviewPage } from "./pages/ReviewPage";
import { SpecsPage } from "./pages/SpecsPage";
import { SpecDetailPage } from "./pages/specs/SpecDetailPage";
import { TrainingPage } from "./pages/TrainingPage";

export function App() {
  return (
    <ExpertModeProvider>
      <AppDataProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShellLayout />}>
              <Route index element={<Navigate to="/pipeline" replace />} />
              <Route path="pipeline" element={<PipelinePage />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="review" element={<ReviewPage />} />
              <Route path="review/decision-sprint" element={<Navigate to="/review?mode=sprint" replace />} />
              <Route path="library" element={<LibraryPage />} />
              <Route path="export" element={<ExportPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="exceptions" element={<ExceptionInbox />} />
              <Route path="trends" element={<TrendDashboardPage />} />
              <Route path="metrics" element={<MetricsDashboardPage />} />

              <Route path="classic/overview" element={<OverviewPage />} />
              <Route path="classic/specs" element={<SpecsPage />} />
              <Route path="classic/specs/:specId" element={<SpecDetailPage />} />
              <Route path="specs/:specId" element={<SpecDetailPage />} />
              <Route path="classic/review" element={<ClassicReviewPage />} />
              <Route path="classic/assets" element={<AssetsPage />} />
              <Route path="classic/atlases" element={<AtlasesPage />} />
              <Route path="classic/exports" element={<ExportsPage />} />
              <Route path="classic/jobs" element={<JobsPage />} />
              <Route path="classic/pixi" element={<PixiPage />} />
              <Route path="classic/training" element={<TrainingPage />} />
              <Route path="classic/automation" element={<AutomationPage />} />
              <Route path="classic/admin" element={<AdminPage />} />
              <Route path="classic/help" element={<HelpPage />} />
              <Route path="classic/logs" element={<LogsPage />} />

              <Route path="overview" element={<Navigate to="/classic/overview" replace />} />
              <Route path="specs" element={<Navigate to="/classic/specs" replace />} />
              <Route path="assets" element={<Navigate to="/classic/assets" replace />} />
              <Route path="atlases" element={<Navigate to="/classic/atlases" replace />} />
              <Route path="exports" element={<Navigate to="/classic/exports" replace />} />
              <Route path="jobs" element={<Navigate to="/classic/jobs" replace />} />
              <Route path="pixi" element={<Navigate to="/classic/pixi" replace />} />
              <Route path="training" element={<Navigate to="/classic/training" replace />} />
              <Route path="automation" element={<Navigate to="/classic/automation" replace />} />
              <Route path="admin" element={<Navigate to="/classic/admin" replace />} />
              <Route path="help" element={<Navigate to="/classic/help" replace />} />
              <Route path="logs" element={<Navigate to="/classic/logs" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AppDataProvider>
    </ExpertModeProvider>
  );
}
