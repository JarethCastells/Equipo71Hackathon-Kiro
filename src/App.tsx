import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import CvOptimizer from './pages/CvOptimizer';
import DashboardPage from './pages/DashboardPage';
import JobBoardPage from './pages/JobBoardPage';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import MessagesPage from './pages/MessagesPage';
import SettingsPage from './pages/SettingsPage';
import SignupPage from './pages/SignupPage';
import VerifyEmailChangePage from './pages/VerifyEmailChangePage';
import VerifyPage from './pages/VerifyPage';

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path='/' element={<LandingPage />} />
            <Route path='/login' element={<LoginPage />} />
            <Route path='/signup' element={<SignupPage />} />
            <Route path='/verify' element={<VerifyPage />} />
            <Route path='/verify-email' element={<VerifyEmailChangePage />} />
            <Route
              path='/dashboard/configuracion'
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path='/dashboard/ofertas'
              element={
                <ProtectedRoute>
                  <JobBoardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path='/dashboard/cv-optimizer'
              element={
                <ProtectedRoute>
                  <CvOptimizer />
                </ProtectedRoute>
              }
            />
            {/* Ruta de mensajería — debe ir ANTES del catch-all /dashboard/* */}
            <Route
              path='/dashboard/mensajes'
              element={
                <ProtectedRoute>
                  <MessagesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path='/dashboard/*'
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route path='*' element={<Navigate to='/' replace />} />
          </Routes>
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
