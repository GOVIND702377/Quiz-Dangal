import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Toaster } from '@/components/ui/toaster';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
// OnboardingFlow removed (unused)
import { lazy, Suspense, useEffect, useMemo } from 'react';
import { prefetch } from '@/lib/prefetch';
import PWAInstallButton from '@/components/PWAInstallButton';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import NotificationPermissionPrompt from '@/components/NotificationPermissionPrompt';
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
const CategoryQuizzes = lazy(() => import('@/pages/CategoryQuizzes'));
const Admin = lazy(() => import('@/pages/Admin'));
const Results = lazy(() => import('@/pages/Results'));
const Leaderboards = lazy(() => import('@/pages/Leaderboards'));
const Redemptions = lazy(() => import('@/pages/Redemptions'));
const ReferEarn = lazy(() => import('@/pages/ReferEarn'));
const Landing = lazy(() => import('@/pages/Landing'));
const PlayWinQuiz = lazy(() => import('@/pages/PlayWinQuiz'));
const OpinionQuiz = lazy(() => import('@/pages/OpinionQuiz'));
const ReferEarnInfo = lazy(() => import('@/pages/ReferEarnInfo'));

// Reusable group of static public informational routes (as a fragment – not a component – so <Routes> accepts it)
const policyRoutes = (
  <>
    <Route path="/terms-conditions" element={<TermsConditions />} />
    <Route path="/privacy-policy" element={<PrivacyPolicy />} />
    <Route path="/about-us" element={<AboutUs />} />
    <Route path="/contact-us" element={<ContactUs />} />
    <Route path="/play-win-quiz-app" element={<PlayWinQuiz />} />
    <Route path="/opinion-quiz-app" element={<OpinionQuiz />} />
    <Route path="/refer-earn-quiz-app" element={<ReferEarnInfo />} />
    <Route path="/leaderboards" element={<Leaderboards />} />
  </>
);

const UnconfirmedEmail = () => (
  <div className="min-h-screen flex items-center justify-center p-4">
    <div className="bg-white/80 backdrop-blur-md border border-white/20 rounded-2xl p-8 max-w-md w-full shadow-xl text-center">
      <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">Check your email</h2>
    <p className="text-gray-600">We&apos;ve sent a confirmation link to your email address. Please click the link to complete your registration.</p>
    </div>
  </div>
);

const Page = ({ children }) => <div className="page-transition">{children}</div>;
const Fallback = () => (
  <div className="min-h-[40vh] flex items-center justify-center" role="status" aria-live="polite" aria-label="Loading content">
    <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-200 border-t-indigo-600" aria-hidden="true"></div>
  </div>
);

function RouteChangeTracker() {
  const location = useLocation();
  useEffect(() => {
    try {
      const page_path = location.pathname + location.search + location.hash;
      if (window.gtag) window.gtag('event', 'page_view', { page_path });
    } catch (e) { /* analytics page_view failed silently */ }
  }, [location]);
  return null;
}

// Simple focus management hook for route changes
function useRouteFocus() {
  const location = useLocation();
  useEffect(() => {
    const main = document.getElementById('app-main');
    if (main) {
      // Using setTimeout to allow React suspense content to paint first
      setTimeout(() => {
  try { main.focus({ preventScroll: false }); } catch (e) { /* ignore focus error */ }
      }, 0);
    }
  }, [location.pathname]);
}

function InitNotifications() {
  // Initialize Push Notifications only when this component is rendered
  // Removed unused user variable (auth state already handled in parent conditional)
  usePushNotifications();
  return null;
}

function App() {
  const { user: authUser, loading, isRecoveryFlow } = useAuth();
  // We only need focus management once layout is rendered; apply inside Router tree via helper component
  const isBot = useMemo(() => {
    try {
      if (typeof navigator === 'undefined' || !navigator.userAgent) return false;
      const ua = navigator.userAgent.toLowerCase();
      return /bot|crawl|slurp|spider|mediapartners|google|bing|duckduckgo|baiduspider|yandex|facebookexternalhit|linkedinbot|twitterbot/.test(ua);
    } catch (e) {
      return false; /* UA parse failed */
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" role="status" aria-live="polite" aria-label="Loading application">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-200 border-t-indigo-600" aria-hidden="true"></div>
          <div className="text-indigo-600 font-medium animate-pulse">Loading Quiz Dangal...</div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <RouteChangeTracker />
        <div className="min-h-screen flex flex-col relative text-gray-50 transition-all duration-300 ease-in-out">
          <Helmet>
            <title>Quiz Dangal – Play Quizzes & Win | Refer & Earn</title>
            <meta name="description" content="Play opinion-based quizzes, climb leaderboards, win rewards, and refer friends to earn coins on Quiz Dangal." />
            <meta name="keywords" content="Quiz Dangal, quizdangal, quiz app, opinion quiz, daily quiz, play and win, refer and earn, rewards, leaderboards" />
          </Helmet>
          {/* Initialize notifications for authenticated, confirmed users outside of <Routes> */}
          {authUser && !isRecoveryFlow && !(authUser.app_metadata?.provider === 'email' && !authUser.email_confirmed_at) && (
            <InitNotifications />
          )}
          <Suspense fallback={<Fallback />}>
          <RouteFocusWrapper>
          <Routes>
            {/* If recovery flow is active, always route to reset-password */}
            {isRecoveryFlow ? (
              <>
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="*" element={<Navigate to="/reset-password" replace />} />
              </>
            ) : !authUser ? (
              <>
                {/* Public pages accessible without login and without Header/Footer */}
                <Route path="/" element={isBot ? <Landing /> : <Navigate to="/login" replace />} />
                {policyRoutes}
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/login" element={<Login />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
              </>
            ) : authUser.app_metadata?.provider === 'email' && !authUser.email_confirmed_at ? (
              <>
                {/* Public policy pages accessible during unconfirmed email state as well */}
                {policyRoutes}
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="*" element={<UnconfirmedEmail />} />
              </>
            ) : (
              <>
                <Route path="/quiz/:id" element={<Quiz />} />
                <Route path="/category/:slug" element={<Page><CategoryQuizzes /></Page>} />
                <Route path="/results/:id" element={<Results />} />
                <Route path="/*" element={<MainLayout />} />
              </>
            )}
          </Routes>
          </RouteFocusWrapper>
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
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="qd-card rounded-2xl max-w-md w-full p-6 text-center">
          <h2 className="text-xl font-semibold text-red-400 mb-2">Admin access required</h2>
          <p className="text-sm text-white/70">
            Local or staging par admin panel kholne ke liye aapke Supabase <code>profiles</code> record ka <strong>role</strong> field <code>&apos;admin&apos;</code> hona zaroori hai.
          </p>
          <ul className="text-left text-sm text-white/65 mt-4 space-y-2 list-disc list-inside">
            <li>Supabase dashboard &rarr; Table editor &rarr; <code>profiles</code> me login user ka <code>role</code> update karein.</li>
            <li>Changes apply hone ke baad dobara login karein ya session refresh karein.</li>
            <li>Agar dev bypass (<code>VITE_BYPASS_AUTH=1</code>) use kar rahe hain to mock admin profile already enable hai.</li>
          </ul>
        </div>
      </div>
    );
  }
  return children;
}

// Wrapper component to apply focus effect inside Router context
function RouteFocusWrapper({ children }) {
  useRouteFocus();
  return (
  <div id="app-focus-wrapper" tabIndex="-1" className="outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60">
      {children}
    </div>
  );
}

const MainLayout = () => {
  // Detect if current path is home to tailor layout spacing/overflow (BrowserRouter)
  const isHome = typeof window !== 'undefined' && window.location && window.location.pathname === '/';
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

    prefetch(() => import('@/pages/Leaderboards'));
    prefetch(() => import('@/pages/Wallet'));
  }, []);
  return (
    <>
      <Header />
  <main className={`flex-1 ${isHome ? 'pt-8 sm:pt-10 pb-24 overflow-hidden min-h-0' : 'pb-24 pt-4 sm:pt-6'}`} id="app-main" tabIndex="-1" role="main" aria-label="Application Content">
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
            {/* Reuse informational routes inside authenticated layout as well */}
            <Route path="/about-us" element={<Page><AboutUs /></Page>} />
            <Route path="/contact-us" element={<Page><ContactUs /></Page>} />
            <Route path="/play-win-quiz-app" element={<Page><PlayWinQuiz /></Page>} />
            <Route path="/opinion-quiz-app" element={<Page><OpinionQuiz /></Page>} />
            <Route path="/refer-earn-quiz-app" element={<Page><ReferEarnInfo /></Page>} />
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
  <NotificationPermissionPrompt />
  {/* OnboardingFlow removed */}
    </>
  );
};

export default App;