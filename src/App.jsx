import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import QuizRoute from './routes/QuizRoute.jsx';
import RequireAdmin from './components/RequireAdmin.jsx';
import AdminLogin from './pages/admin/AdminLogin.jsx';
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import ExamEditor from './pages/admin/ExamEditor.jsx';
import ExamResults from './pages/admin/ExamResults.jsx';
import CandidateAttemptDetail from './pages/admin/CandidateAttemptDetail.jsx';
import ExamRegistration from './pages/exam/ExamRegistration.jsx';
import ExamInstructions from './pages/exam/ExamInstructions.jsx';
import ExamRun from './pages/exam/ExamRun.jsx';
import ExamDone from './pages/exam/ExamDone.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-bg">
        <Routes>
          <Route path="/" element={<QuizRoute />} />

          <Route path="/exam/:slug" element={<ExamRegistration />} />
          <Route path="/exam/:slug/instructions" element={<ExamInstructions />} />
          <Route path="/exam/:slug/run" element={<ExamRun />} />
          <Route path="/exam/:slug/done" element={<ExamDone />} />

          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
          <Route path="/admin/exams/new" element={<RequireAdmin><ExamEditor /></RequireAdmin>} />
          <Route path="/admin/exams/:id" element={<RequireAdmin><ExamEditor /></RequireAdmin>} />
          <Route path="/admin/exams/:id/results" element={<RequireAdmin><ExamResults /></RequireAdmin>} />
          <Route path="/admin/exams/:id/results/:candidateId" element={<RequireAdmin><CandidateAttemptDetail /></RequireAdmin>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        <footer className="text-center py-10 opacity-40">
          <div className="w-8 h-[1px] bg-accent/30 mx-auto mb-4" />
          <p className="text-[10px] text-accent uppercase tracking-[0.4em]">
            Al-Qawā'id Al-Muthlaa • Révision
          </p>
        </footer>
      </div>
    </BrowserRouter>
  );
}
