import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Toaster } from '@/components/ui/toaster';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import OnboardingFlow from '@/components/OnboardingFlow';
import Home from '@/pages/Home';
import MyQuizzes from '@/pages/MyQuizzes';
import Wallet from '@/pages/Wallet';
import Profile from '@/pages/Profile';
import Login from '@/pages/Login';
import ResetPassword from '@/pages/ResetPassword';
import AboutUs from '@/pages/AboutUs';
import ContactUs from '@/pages/ContactUs';
import TermsConditions from '@/pages/TermsConditions';
import PrivacyPolicy from '@/pages/PrivacyPolicy';
import Quiz from '@/pages/Quiz';
import Admin from '@/pages/Admin';
import Results from '@/pages/Results';
import Leaderboards from '@/pages/Leaderboards';
import Redemptions from '@/pages/Redemptions';
import Language from '@/pages/Language';
import PWAInstallButton from '@/components/PWAInstallButton';
import { usePushNotifications } from '@/hooks/usePushNotifications';

const UnconfirmedEmail = () => (
  <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
    <div className="bg-white/80 backdrop-blur-md border border-white/20 rounded-2xl p-8 max-w-md w-full shadow-xl text-center">
      <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">Check your email</h2>
      <p className="text-gray-600">We've sent a confirmation link to your email address. Please click the link to complete your registration.</p>
    </div>
  </div>
);

const Page = ({ children }) => <div className="page-transition">{children}</div>;

function App() {
  const { user, userProfile, loading } = useAuth();
  usePushNotifications(); // Initialize Push Notifications

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-200 border-t-indigo-600"></div>
          <div className="text-indigo-600 font-medium animate-pulse">Loading Quiz Dangal...</div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 to-indigo-100 text-gray-800 transition-all duration-300 ease-in-out">
          <Helmet>
            <title>Quiz Dangal - Opinion Based Quiz App</title>
            <meta name="description" content="Join Quiz Dangal for exciting opinion-based quizzes with real prizes!" />
          </Helmet>
          <Routes>
            {!user ? (
              <>
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="*" element={<Login />} />
              </>
            ) : user.app_metadata?.provider === 'email' && !user.email_confirmed_at ? (
              <>
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="*" element={<UnconfirmedEmail />} />
              </>
            ) : (
              <>
                <Route path="/quiz/:id" element={<Quiz />} />
                <Route path="/results/:id" element={<Results />} />
                <Route path="/*" element={<MainLayout />} />
              </>
            )}
          </Routes>
          <Toaster />
        </div>
      </Router>
    </ErrorBoundary>
  );
}

function AdminRoute({ children }) {
  const { userProfile, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-3 border-indigo-200 border-t-indigo-600"></div>
      </div>
    );
  }
  if (!userProfile || userProfile.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  return children;
}

const MainLayout = () => {
  return (
    <>
      <Header />
      <main className="flex-1 pb-24 pt-4">
        <Routes>
          <Route path="/" element={<Page><Home /></Page>} />
          <Route path="/my-quizzes" element={<Page><MyQuizzes /></Page>} />
          <Route path="/wallet" element={<Page><Wallet /></Page>} />
          <Route path="/profile" element={<Page><Profile /></Page>} />
          <Route path="/leaderboards" element={<Page><Leaderboards /></Page>} />
          <Route path="/language" element={<Page><Language /></Page>} />
          <Route path="/rewards" element={<Navigate to="/wallet" replace />} />
          <Route path="/redemptions" element={<Page><Redemptions /></Page>} />
          <Route path="/about-us" element={<Page><AboutUs /></Page>} />
          <Route path="/contact-us" element={<Page><ContactUs /></Page>} />
          <Route path="/terms-conditions" element={<Page><TermsConditions /></Page>} />
          <Route path="/privacy-policy" element={<Page><PrivacyPolicy /></Page>} />
          <Route path="/admin" element={<AdminRoute><Page><Admin /></Page></AdminRoute>} />
          <Route path="/admin/users" element={<Navigate to="/admin?tab=users" replace />} />
          <Route path="/admin/leaderboards" element={<Navigate to="/admin?tab=leaderboards" replace />} />
          <Route path="/admin/redemptions" element={<Navigate to="/admin?tab=redemptions" replace />} />
          <Route path="/admin/reports" element={<Navigate to="/admin?tab=reports" replace />} />
          <Route path="/test" element={<div style={{padding: '20px', color: 'red', fontSize: '24px'}}>TEST PAGE WORKING!</div>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
      <PWAInstallButton />
      <OnboardingFlow />
    </>
  );
};

export default App;