import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AppDataProvider } from "./context/AppDataContext";
import { AppShellLayout } from "./layouts/AppShellLayout";
import { AssetsPage } from "./pages/AssetsPage";
import { AtlasesPage } from "./pages/AtlasesPage";
import { ExportsPage } from "./pages/ExportsPage";
import { JobsPage } from "./pages/JobsPage";
import { HelpPage } from "./pages/HelpPage";
import { LogsPage } from "./pages/LogsPage";
import { OverviewPage } from "./pages/OverviewPage";
import { PixiPage } from "./pages/PixiPage";
import { SpecsPage } from "./pages/SpecsPage";
import { TrainingPage } from "./pages/TrainingPage";
import { AdminPage } from "./pages/AdminPage";
import { AutomationPage } from "./pages/AutomationPage";

export function App() {
  return (
    <AppDataProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShellLayout />}>
            <Route index element={<OverviewPage />} />
            <Route path="specs" element={<SpecsPage />} />
            <Route path="assets" element={<AssetsPage />} />
            <Route path="atlases" element={<AtlasesPage />} />
            <Route path="exports" element={<ExportsPage />} />
            <Route path="jobs" element={<JobsPage />} />
            <Route path="pixi" element={<PixiPage />} />
            <Route path="training" element={<TrainingPage />} />
            <Route path="automation" element={<AutomationPage />} />
            <Route path="admin" element={<AdminPage />} />
            <Route path="help" element={<HelpPage />} />
            <Route path="logs" element={<LogsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppDataProvider>
  );
}
