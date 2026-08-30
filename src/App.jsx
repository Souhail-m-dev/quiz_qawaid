import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { RequireAdmin, RequireContentManager, RequireStaff, RequirePlatformAdmin, RequireStudent } from './components/RequireRole.jsx';
import AdminLayout from './components/AdminLayout.jsx';
import AdminLogin from './pages/admin/AdminLogin.jsx';
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import ExamEditor from './pages/admin/ExamEditor.jsx';
import ExamResults from './pages/admin/ExamResults.jsx';
import CandidateAttemptDetail from './pages/admin/CandidateAttemptDetail.jsx';
import ExamStats from './pages/admin/ExamStats.jsx';
import ReviewQueue from './pages/admin/ReviewQueue.jsx';
import Users from './pages/admin/Users.jsx';
import Activity from './pages/admin/Activity.jsx';
import QuizBank from './pages/admin/QuizBank.jsx';
import QuizCourseEditor from './pages/admin/QuizCourseEditor.jsx';
import MatieresAdmin from './pages/admin/MatieresAdmin.jsx';
import ClassesAdmin from './pages/admin/ClassesAdmin.jsx';
import Tenants from './pages/admin/Tenants.jsx';
import TenantDetail from './pages/admin/TenantDetail.jsx';
import Students from './pages/admin/Students.jsx';
import StudentDetail from './pages/admin/StudentDetail.jsx';
import StudentSignup from './pages/eleve/StudentSignup.jsx';
import StudentLogin from './pages/eleve/StudentLogin.jsx';
import StudentDashboard from './pages/eleve/StudentDashboard.jsx';
import ExamRegistration from './pages/exam/ExamRegistration.jsx';
import ExamInstructions from './pages/exam/ExamInstructions.jsx';
import ExamRun from './pages/exam/ExamRun.jsx';
import ExamDone from './pages/exam/ExamDone.jsx';
import InviteAccept from './pages/InviteAccept.jsx';
import QuizRoute from './pages/revision/QuizRoute.jsx';
import TenantHome from './pages/public/TenantHome.jsx';
import MatierePage from './pages/public/MatierePage.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-bg">
        <Routes>
          {/* Vitrine publique par domaine (tenant). /admin reste joignable par URL directe. */}
          <Route path="/" element={<TenantHome />} />
          <Route path="/m/:slug" element={<MatierePage />} />

          <Route path="/revision" element={<QuizRoute />} />

          <Route path="/exam/:slug" element={<ExamRegistration />} />
          <Route path="/exam/:slug/instructions" element={<ExamInstructions />} />
          <Route path="/exam/:slug/run" element={<ExamRun />} />
          <Route path="/exam/:slug/done" element={<ExamDone />} />

          {/* Espace élève: inscription libre, accès aux examens après validation admin. */}
          <Route path="/eleve/inscription" element={<StudentSignup />} />
          <Route path="/eleve/login" element={<StudentLogin />} />
          <Route path="/eleve" element={<RequireStudent><StudentDashboard /></RequireStudent>} />

          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/invite/:token" element={<InviteAccept />} />

          {/* Espace admin: layout commun (barre latérale responsive) */}
          <Route element={<RequireStaff><AdminLayout /></RequireStaff>}>
            <Route path="/admin" element={<AdminDashboard />} />

            {/* Owner only */}
            <Route path="/admin/users" element={<RequireAdmin><Users /></RequireAdmin>} />
            <Route path="/admin/activity" element={<RequireAdmin><Activity /></RequireAdmin>} />
            <Route path="/admin/eleves" element={<RequireAdmin><Students /></RequireAdmin>} />
            <Route path="/admin/eleves/:studentId" element={<RequireAdmin><StudentDetail /></RequireAdmin>} />

            {/* Création/édition du contenu: owner + editeur (« Admin ») */}
            <Route path="/admin/exams/new" element={<RequireContentManager><ExamEditor /></RequireContentManager>} />
            <Route path="/admin/exams/:id" element={<RequireContentManager><ExamEditor /></RequireContentManager>} />
            <Route path="/admin/matieres" element={<RequireContentManager><MatieresAdmin /></RequireContentManager>} />
            <Route path="/admin/classes" element={<RequireContentManager><ClassesAdmin /></RequireContentManager>} />
            <Route path="/admin/quiz" element={<RequireContentManager><QuizBank /></RequireContentManager>} />
            <Route path="/admin/quiz/:courseId" element={<RequireContentManager><QuizCourseEditor /></RequireContentManager>} />

            {/* Plateforme uniquement: dashboard par tenant */}
            <Route path="/admin/tenants" element={<RequirePlatformAdmin><Tenants /></RequirePlatformAdmin>} />
            <Route path="/admin/tenants/:tenantId" element={<RequirePlatformAdmin><TenantDetail /></RequirePlatformAdmin>} />

            {/* Staff: admin + correcteur */}
            <Route path="/admin/exams/:id/stats" element={<RequireStaff><ExamStats /></RequireStaff>} />
            <Route path="/admin/exams/:id/results" element={<RequireStaff><ExamResults /></RequireStaff>} />
            <Route path="/admin/exams/:id/review" element={<RequireStaff><ReviewQueue /></RequireStaff>} />
            <Route path="/admin/exams/:id/results/:candidateId" element={<RequireStaff><CandidateAttemptDetail /></RequireStaff>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
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
