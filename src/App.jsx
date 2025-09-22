import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Toaster } from '@/components/ui/toaster';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import OnboardingFlow from '@/components/OnboardingFlow';
import { lazy, Suspense, useEffect } from 'react';
import PWAInstallButton from '@/components/PWAInstallButton';
import { usePushNotifications } from '@/hooks/usePushNotifications';
const Home = lazy(() => import('@/pages/Home'));
const MyQuizzes = lazy(() => import('@/pages/MyQuizzes'));
const Wallet = lazy(() => import('@/pages/Wallet'));
const Profile = lazy(() => import('@/pages/Profile'));
const Login = lazy(() => import('@/pages/Login'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const AboutUs = lazy(() => import('@/pages/AboutUs'));
const ContactUs = lazy(() => import('@/pages/ContactUs'));
const TermsConditions = lazy(() => import('@/pages/TermsConditions'));
const PrivacyPolicy = lazy(() => import('@/pages/PrivacyPolicy'));
const Quiz = lazy(() => import('@/pages/Quiz'));
const Admin = lazy(() => import('@/pages/Admin'));
const Results = lazy(() => import('@/pages/Results'));
const Leaderboards = lazy(() => import('@/pages/Leaderboards'));
const Redemptions = lazy(() => import('@/pages/Redemptions'));
const ReferEarn = lazy(() => import('@/pages/ReferEarn'));

const UnconfirmedEmail = () => (
  <div className="min-h-screen flex items-center justify-center p-4">
    <div className="bg-white/80 backdrop-blur-md border border-white/20 rounded-2xl p-8 max-w-md w-full shadow-xl text-center">
      <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">Check your email</h2>
      <p className="text-gray-600">We've sent a confirmation link to your email address. Please click the link to complete your registration.</p>
    </div>
  </div>
);

const Page = ({ children }) => <div className="page-transition">{children}</div>;
const Fallback = () => (
  <div className="min-h-[40vh] flex items-center justify-center">
    <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-200 border-t-indigo-600"></div>
  </div>
);

function App() {
  const { user, userProfile, loading, isRecoveryFlow } = useAuth();
  usePushNotifications(); // Initialize Push Notifications

  if (loading) {
    return (
  <div className="min-h-screen flex items-center justify-center">
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
        <div className="min-h-screen flex flex-col relative text-gray-50 transition-all duration-300 ease-in-out">
          <Helmet>
            <title>Quiz Dangal - Opinion Based Quiz App</title>
            <meta name="description" content="Join Quiz Dangal for exciting opinion-based quizzes with real prizes!" />
          </Helmet>
          <Suspense fallback={<Fallback />}>
          <Routes>
            {/* If recovery flow is active, always route to reset-password */}
            {isRecoveryFlow ? (
              <>
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="*" element={<Navigate to="/reset-password" replace />} />
              </>
            ) : !user ? (
              <>
                {/* Public policy pages accessible without login and without Header/Footer */}
                <Route path="/terms-conditions" element={<TermsConditions />} />
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="*" element={<Login />} />
              </>
            ) : user.app_metadata?.provider === 'email' && !user.email_confirmed_at ? (
              <>
                {/* Public policy pages accessible during unconfirmed email state as well */}
                <Route path="/terms-conditions" element={<TermsConditions />} />
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />
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
          </Suspense>
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
  // Detect if current path is home to tailor layout spacing/overflow
  const isHome = typeof window !== 'undefined' && window.location && (window.location.hash === '' || window.location.hash === '#/' || window.location.hash === '#');
  useEffect(() => {
    // Skip warming on slow networks, data saver, low-memory devices, or when tab is hidden
    const shouldWarm = () => {
      try {
        if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return false;
        const conn = (navigator && (navigator.connection || navigator.mozConnection || navigator.webkitConnection)) || null;
        if (conn) {
          if (conn.saveData) return false;
          if (typeof conn.effectiveType === 'string' && /(^|\b)2g(\b|$)/i.test(conn.effectiveType)) return false;
        }
        const mem = (navigator && navigator.deviceMemory) || 4;
        if (mem && mem <= 2) return false;
        return true;
      } catch {
        return true;
      }
    };
    if (!shouldWarm()) return;

    const warm = () => {
      // Warm only the most commonly visited heavy routes
      import('@/pages/Leaderboards');
      import('@/pages/Wallet');
      // Defer the rest to user navigation
    };
    const ric = (cb) => (window.requestIdleCallback ? window.requestIdleCallback(cb) : setTimeout(cb, 1500));
    const id = ric(warm);
    return () => {
      if (window.cancelIdleCallback && typeof id === 'number') window.cancelIdleCallback(id);
      // setTimeout fallback can't be reliably cancelled without storing handle; safe to ignore
    };
  }, []);
  return (
    <>
      <Header />
  <main className={`flex-1 ${isHome ? 'pt-8 sm:pt-10 pb-24 overflow-hidden min-h-0' : 'pb-24 pt-4 sm:pt-6'}`}>
        <Suspense fallback={<Fallback />}>
          <Routes>
            <Route path="/" element={<Page><Home /></Page>} />
            <Route path="/my-quizzes" element={<Page><MyQuizzes /></Page>} />
            <Route path="/wallet" element={<Page><Wallet /></Page>} />
            <Route path="/profile" element={<Page><Profile /></Page>} />
            <Route path="/leaderboards" element={<Page><Leaderboards /></Page>} />
            <Route path="/refer" element={<Page><ReferEarn /></Page>} />
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
      <PWAInstallButton />
      <OnboardingFlow />
    </>
  );
};

export default App;