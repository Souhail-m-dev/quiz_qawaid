import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { RequireAdmin, RequireStaff, RequirePlatformAdmin } from './components/RequireRole.jsx';
import AdminLayout from './components/AdminLayout.jsx';
import AdminLogin from './pages/admin/AdminLogin.jsx';
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import ExamEditor from './pages/admin/ExamEditor.jsx';
import ExamResults from './pages/admin/ExamResults.jsx';
import CandidateAttemptDetail from './pages/admin/CandidateAttemptDetail.jsx';
import ExamStats from './pages/admin/ExamStats.jsx';
import Users from './pages/admin/Users.jsx';
import Activity from './pages/admin/Activity.jsx';
import Tenants from './pages/admin/Tenants.jsx';
import TenantDetail from './pages/admin/TenantDetail.jsx';
import ExamRegistration from './pages/exam/ExamRegistration.jsx';
import ExamInstructions from './pages/exam/ExamInstructions.jsx';
import ExamRun from './pages/exam/ExamRun.jsx';
import ExamDone from './pages/exam/ExamDone.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-bg">
        <Routes>
          {/* Module examens uniquement */}
          <Route path="/" element={<Navigate to="/admin" replace />} />

          <Route path="/exam/:slug" element={<ExamRegistration />} />
          <Route path="/exam/:slug/instructions" element={<ExamInstructions />} />
          <Route path="/exam/:slug/run" element={<ExamRun />} />
          <Route path="/exam/:slug/done" element={<ExamDone />} />

          <Route path="/admin/login" element={<AdminLogin />} />

          {/* Espace admin: layout commun (barre latérale responsive) */}
          <Route element={<RequireStaff><AdminLayout /></RequireStaff>}>
            <Route path="/admin" element={<AdminDashboard />} />

            {/* Admin only */}
            <Route path="/admin/exams/new" element={<RequireAdmin><ExamEditor /></RequireAdmin>} />
            <Route path="/admin/exams/:id" element={<RequireAdmin><ExamEditor /></RequireAdmin>} />
            <Route path="/admin/users" element={<RequireAdmin><Users /></RequireAdmin>} />
            <Route path="/admin/activity" element={<RequireAdmin><Activity /></RequireAdmin>} />

            {/* Plateforme uniquement: dashboard par tenant */}
            <Route path="/admin/tenants" element={<RequirePlatformAdmin><Tenants /></RequirePlatformAdmin>} />
            <Route path="/admin/tenants/:tenantId" element={<RequirePlatformAdmin><TenantDetail /></RequirePlatformAdmin>} />

            {/* Staff: admin + correcteur */}
            <Route path="/admin/exams/:id/stats" element={<RequireStaff><ExamStats /></RequireStaff>} />
            <Route path="/admin/exams/:id/results" element={<RequireStaff><ExamResults /></RequireStaff>} />
            <Route path="/admin/exams/:id/results/:candidateId" element={<RequireStaff><CandidateAttemptDetail /></RequireStaff>} />
          </Route>

          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>

        <footer className="text-center py-10 opacity-40">
          <div className="w-8 h-[1px] bg-accent/30 mx-auto mb-4" />
          <p className="text-[10px] text-accent uppercase tracking-[0.4em]">
            Plateforme d'Examens • Propulsé par Quizz SaaS
          </p>
        </footer>
      </div>
    </BrowserRouter>
  );
}
