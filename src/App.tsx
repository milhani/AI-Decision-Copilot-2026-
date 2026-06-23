import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/pages/auth/LoginPage'
import { SignupPage } from '@/pages/auth/SignupPage'
import { OnboardingPage } from '@/pages/OnboardingPage'
import { ProjectsPage } from '@/pages/ProjectsPage'
import { OverviewPage } from '@/pages/project/OverviewPage'
import { ImportPage } from '@/pages/project/ImportPage'
import { HypothesesPage } from '@/pages/project/HypothesesPage'
import { HypothesisFormPage } from '@/pages/project/HypothesisFormPage'
import { HypothesisTemplatesPage } from '@/pages/project/HypothesisTemplatesPage'
import { AiAssistantPage } from '@/pages/project/AiAssistantPage'
import { ReportPage } from '@/pages/project/ReportPage'
import { SettingsPage } from '@/pages/project/SettingsPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:id" element={<Navigate to="overview" replace />} />
            <Route path="/projects/:id/overview" element={<OverviewPage />} />
            <Route path="/projects/:id/import" element={<ImportPage />} />
            <Route path="/projects/:id/hypotheses" element={<HypothesesPage />} />
            <Route path="/projects/:id/hypotheses/new" element={<HypothesisFormPage />} />
            <Route path="/projects/:id/hypotheses/templates" element={<HypothesisTemplatesPage />} />
            <Route path="/projects/:id/hypotheses/:hypothesisId/edit" element={<HypothesisFormPage />} />
            <Route path="/projects/:id/ai" element={<AiAssistantPage />} />
            <Route path="/projects/:id/chat" element={<Navigate to="../ai" replace />} />
            <Route path="/projects/:id/report" element={<ReportPage />} />
            <Route path="/projects/:id/settings" element={<SettingsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/projects" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </AuthProvider>
  )
}
