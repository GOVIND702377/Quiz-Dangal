import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Toaster } from '@/components/ui/toaster';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import Home from '@/pages/Home';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

/**
 * lazyRetry — wraps a dynamic import so that when a chunk 404s
 * (common after a deployment with new hashes) the page auto-reloads
 * once instead of showing "Something went wrong".
 */
const lazyRetry = (importFn) =>
  lazy(() =>
    importFn().catch(() => {
      // Prevent infinite reload loops — allow one retry per session
      const key = 'qd_lazy_retry';
      try {
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, '1');
          globalThis.location.reload();
          // Return a never-resolving promise so React doesn't render stale tree
          return new Promise(() => {});
        }
      } catch {
        /* sessionStorage unavailable */
      }
      // If we already retried, let it throw naturally → ErrorBoundary catches it
      return importFn();
    }),
  );

const MyQuizzes = lazyRetry(() => import('@/pages/MyQuizzes'));
const Wallet = lazyRetry(() => import('@/pages/Wallet'));
const Profile = lazyRetry(() => import('@/pages/Profile'));
const Login = lazyRetry(() => import('@/pages/Login'));
const ResetPassword = lazyRetry(() => import('@/pages/ResetPassword'));
const AboutUs = lazyRetry(() => import('@/pages/AboutUs'));
const ContactUs = lazyRetry(() => import('@/pages/ContactUs'));
const TermsConditions = lazyRetry(() => import('@/pages/TermsConditions'));
const PrivacyPolicy = lazyRetry(() => import('@/pages/PrivacyPolicy'));
const Quiz = lazyRetry(() => import('@/pages/Quiz'));
const CategoryQuizzes = lazyRetry(() => import('@/pages/CategoryQuizzes'));
// Unified Admin panel now lives in Admin.jsx
const Admin = lazyRetry(() => import('@/pages/Admin'));
const Results = lazyRetry(() => import('@/pages/Results'));
const Leaderboards = lazyRetry(() => import('@/pages/Leaderboards'));
const Redemptions = lazyRetry(() => import('@/pages/Redemptions'));
const ReferEarn = lazyRetry(() => import('@/pages/ReferEarn'));
const PlayWinQuiz = lazyRetry(() => import('@/pages/PlayWinQuiz'));
const OpinionQuiz = lazyRetry(() => import('@/pages/OpinionQuiz'));
const ReferEarnInfo = lazyRetry(() => import('@/pages/ReferEarnInfo'));
const NotificationsDebug = lazyRetry(() => import('@/pages/NotificationsDebug'));
const GKQuiz = lazyRetry(() => import('@/pages/seo/GKQuiz'));
const CricketQuiz = lazyRetry(() => import('@/pages/seo/CricketQuiz'));
const CurrentAffairsQuiz = lazyRetry(() => import('@/pages/seo/CurrentAffairsQuiz'));
const BollywoodQuiz = lazyRetry(() => import('@/pages/seo/BollywoodQuiz'));
const NotFound = lazyRetry(() => import('@/pages/NotFound'));
const Footer = lazyRetry(() => import('@/components/Footer'));
const ProfileUpdateModal = lazyRetry(() => import('@/components/ProfileUpdateModal'));
const CookieConsent = lazyRetry(() => import('@/components/CookieConsent'));
const PWAInstallButton = lazyRetry(() => import('@/components/PWAInstallButton'));
const AdSenseLoader = lazyRetry(() => import('@/components/AdSenseLoader'));

// Reusable group of static public informational routes (as a fragment – not a component – so <Routes> accepts it)
const policyRoutes = (
  <>
    <Route path="/terms-conditions" element={<Navigate to="/terms-conditions/" replace />} />
    <Route path="/terms-conditions/" element={<TermsConditions />} />
    <Route path="/privacy-policy" element={<Navigate to="/privacy-policy/" replace />} />
    <Route path="/privacy-policy/" element={<PrivacyPolicy />} />
    <Route path="/about-us" element={<Navigate to="/about-us/" replace />} />
    <Route path="/about-us/" element={<AboutUs />} />
    <Route path="/contact-us" element={<Navigate to="/contact-us/" replace />} />
    <Route path="/contact-us/" element={<ContactUs />} />
    <Route path="/gk-quiz" element={<Navigate to="/gk-quiz/" replace />} />
    <Route path="/gk-quiz/" element={<GKQuiz />} />
    <Route path="/cricket-quiz" element={<Navigate to="/cricket-quiz/" replace />} />
    <Route path="/cricket-quiz/" element={<CricketQuiz />} />
    <Route path="/ipl-prediction-quiz" element={<Navigate to="/category/opinion/" replace />} />
    <Route path="/ipl-prediction-quiz/" element={<Navigate to="/category/opinion/" replace />} />
    <Route path="/current-affairs-quiz" element={<Navigate to="/current-affairs-quiz/" replace />} />
    <Route path="/current-affairs-quiz/" element={<CurrentAffairsQuiz />} />
    <Route path="/bollywood-quiz" element={<Navigate to="/bollywood-quiz/" replace />} />
    <Route path="/bollywood-quiz/" element={<BollywoodQuiz />} />
    <Route path="/play-win-quiz-app" element={<Navigate to="/play-win-quiz-app/" replace />} />
    <Route path="/play-win-quiz-app/" element={<PlayWinQuiz />} />
    <Route path="/opinion-quiz-app" element={<Navigate to="/opinion-quiz-app/" replace />} />
    <Route path="/opinion-quiz-app/" element={<OpinionQuiz />} />
    <Route path="/refer-earn-quiz-app" element={<Navigate to="/refer-earn-quiz-app/" replace />} />
    <Route path="/refer-earn-quiz-app/" element={<ReferEarnInfo />} />
    <Route path="/leaderboards" element={<Navigate to="/leaderboards/" replace />} />
    <Route path="/leaderboards/" element={<Leaderboards />} />
  </>
);

const legacyRedirectRoutes = (
  <>
    <Route path="/category/sports/*" element={<Navigate to="/category/gk/" replace />} />
    <Route path="/category/movies/*" element={<Navigate to="/category/gk/" replace />} />
    <Route path="/quiz-questions/*" element={<Navigate to="/play-win-quiz-app/" replace />} />
    <Route path="/quiz-questions-with-answers/*" element={<Navigate to="/play-win-quiz-app/" replace />} />
    <Route path="/gk-questions/*" element={<Navigate to="/gk-quiz/" replace />} />
    <Route path="/hindi-quiz/*" element={<Navigate to="/gk-quiz/" replace />} />
    <Route path="/english-quiz/*" element={<Navigate to="/gk-quiz/" replace />} />
    <Route path="/online-quiz/*" element={<Navigate to="/play-win-quiz-app/" replace />} />
    <Route path="/science-quiz/*" element={<Navigate to="/gk-quiz/" replace />} />
    <Route path="/maths-quiz/*" element={<Navigate to="/gk-quiz/" replace />} />
    <Route path="/quiz-game/*" element={<Navigate to="/play-win-quiz-app/" replace />} />
    <Route path="/quiz-competition/*" element={<Navigate to="/play-win-quiz-app/" replace />} />
    <Route path="/quiz-app/*" element={<Navigate to="/play-win-quiz-app/" replace />} />
    <Route path="/quiz-for-kids/*" element={<Navigate to="/play-win-quiz-app/" replace />} />
    <Route path="/india-quiz/*" element={<Navigate to="/gk-quiz/" replace />} />
    <Route path="/sports-quiz/*" element={<Navigate to="/gk-quiz/" replace />} />
    <Route path="/general-knowledge-quiz/*" element={<Navigate to="/gk-quiz/" replace />} />
  </>
);

const UnconfirmedEmail = () => (
  <div className="min-h-screen flex items-center justify-center p-4">
    <div className="bg-white/80 backdrop-blur-md border border-white/20 rounded-2xl p-8 max-w-md w-full shadow-xl text-center">
      <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">
        Check your email
      </h2>
      <p className="text-gray-600">
        We&apos;ve sent a confirmation link to your email address. Please click the link to complete
        your registration.
      </p>
    </div>
  </div>
);

const Page = ({ children }) => <div className="page-transition">{children}</div>;
const Fallback = () => (
  <div
    className="min-h-[40vh] flex items-center justify-center"
    role="status"
    aria-live="polite"
    aria-label="Loading content"
  >
    <div
      className="rounded-full h-8 w-8 border-3 border-white/20 border-t-indigo-500"
      style={{ animation: 'spin 0.7s linear infinite' }}
      aria-hidden="true"
    ></div>
  </div>
);

const DeferredRender = ({ children, delayMs = 2200 }) => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let timeoutId = null;
    let idleId = null;

    const activate = () => setReady(true);
    const schedule = () => {
      if (typeof window.requestIdleCallback === 'function') {
        idleId = window.requestIdleCallback(activate, { timeout: delayMs });
      } else {
        timeoutId = window.setTimeout(activate, delayMs);
      }
    };

    if (document.readyState === 'complete') {
      schedule();
    } else {
      window.addEventListener('load', schedule, { once: true });
    }

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      if (idleId && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId);
      }
      window.removeEventListener('load', schedule);
    };
  }, [delayMs]);

  if (!ready) return null;
  return <>{children}</>;
};

function RouteChangeTracker() {
  const location = useLocation();
  useEffect(() => {
    try {
      const page_path = location.pathname + location.search + location.hash;
      if (window.gtag) window.gtag('event', 'page_view', { page_path });
    } catch (e) {
      /* analytics page_view failed silently */
    }
  }, [location]);
  return null;
}

// Simple focus management hook for route changes
function useRouteFocus() {
  const location = useLocation();
  const firstRouteRef = useRef(true);

  useEffect(() => {
    if (firstRouteRef.current) {
      firstRouteRef.current = false;
      return;
    }

    const main = document.getElementById('app-main');
    if (main) {
      // Using setTimeout to allow React suspense content to paint first
      setTimeout(() => {
        try {
          main.focus({ preventScroll: false });
        } catch (e) {
          /* ignore focus error */
        }
      }, 0);
    }
  }, [location.pathname]);
}

function InitNotifications() {
  usePushNotifications();
  return null;
}

function App() {
  const { user: authUser, loading, isRecoveryFlow } = useAuth();
  // We only need focus management once layout is rendered; apply inside Router tree via helper component

  // Remove static loader only when app is fully ready
  useEffect(() => {
    if (!loading) {
      // App is ready, remove static loader with smooth transition
      requestAnimationFrame(() => {
        const staticLoader = document.getElementById('static-loader');
        if (staticLoader) {
          staticLoader.style.opacity = '0';
          setTimeout(() => {
            staticLoader.remove();
          }, 150);
        }
      });
    }
  }, [loading]);

  // Safety fallback: forcefully remove loader after 8 seconds if it's still there
  useEffect(() => {
    const fallbackId = setTimeout(() => {
      const staticLoader = document.getElementById('static-loader');
      if (staticLoader) {
        staticLoader.style.opacity = '0';
        setTimeout(() => staticLoader.remove(), 150);
      }
    }, 8000);
    return () => clearTimeout(fallbackId);
  }, []);

  // While loading, keep static loader visible (don't render anything else)
  if (loading) {
    return null; // Static loader from index.html stays visible
  }

  return (
    <ErrorBoundary>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <a href="#app-main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:bg-indigo-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-semibold">Skip to content</a>
        <RouteChangeTracker />
        {/* Global Cyberpunk Background - Same as Home page */}
        <div className="app-bg" aria-hidden="true">
          <div className="app-bg-base" />
          <div className="app-bg-grid" />
          <div className="app-bg-vignette" />
        </div>
        <div
          className="min-h-screen flex flex-col relative text-gray-50 z-10"
          style={{ margin: 0, padding: 0, background: 'transparent' }}
        >
          <Helmet>
            <html lang="en-IN" />
            <title>Quiz Dangal – Play Quizzes & Win | Refer & Earn</title>
            <meta
              name="description"
              content="Play opinion-based quizzes, climb leaderboards, win rewards, and refer friends to earn coins on Quiz Dangal. India's #1 free quiz platform."
            />
            <meta name="author" content="Quiz Dangal" />
            <meta name="creator" content="Quiz Dangal" />
            <meta name="publisher" content="Quiz Dangal" />
            <meta name="rating" content="General" />
            <meta name="distribution" content="global" />
            <meta name="revisit-after" content="3 days" />
          </Helmet>
          {/* Initialize notifications for authenticated, confirmed users outside of <Routes> */}
          <DeferredRender delayMs={2400}>
            <Suspense fallback={null}>
              <AdSenseLoader />
            </Suspense>
          </DeferredRender>
          {authUser &&
            !isRecoveryFlow &&
            !(authUser.app_metadata?.provider === 'email' && !authUser.email_confirmed_at) && (
              <InitNotifications />
            )}
          <Suspense fallback={<Fallback />}>
            <RouteFocusWrapper>
              <Routes>
                {/* If recovery flow is active, always route to reset-password */}
                {isRecoveryFlow ? (
                  <>
                        <Route path="/reset-password/" element={<ResetPassword />} />
                        <Route path="/reset-password" element={<Navigate to="/reset-password/" replace />} />
                        <Route path="*" element={<Navigate to="/reset-password/" replace />} />
                  </>
                ) : !authUser ? (
                  <>
                    {/* Public pages accessible without login - with Header */}
                        <Route path="/reset-password/" element={<ResetPassword />} />
                        <Route path="/reset-password" element={<Navigate to="/reset-password/" replace />} />
                        <Route path="/login/" element={<Login />} />
                        <Route path="/login" element={<Navigate to="/login/" replace />} />
                    {/* All other public routes get Header + Footer */}
                    <Route path="/*" element={<PublicLayout />} />
                  </>
                ) : authUser.app_metadata?.provider === 'email' && !authUser.email_confirmed_at ? (
                  <>
                    {/* Public policy pages accessible during unconfirmed email state as well */}
                    {policyRoutes}
                        <Route path="/reset-password/" element={<ResetPassword />} />
                        <Route path="/reset-password" element={<Navigate to="/reset-password/" replace />} />
                    <Route path="*" element={<UnconfirmedEmail />} />
                  </>
                ) : (
                  <>
                    {/* Redirect authenticated users away from login to home */}
                    <Route path="/login/" element={<Navigate to="/" replace />} />
                    <Route path="/login" element={<Navigate to="/" replace />} />
                    <Route path="/quiz/" element={<Navigate to="/" replace />} />
                    <Route path="/quiz" element={<Navigate to="/" replace />} />
                    <Route path="/quiz/:id" element={<Quiz />} />
                    <Route path="/quiz/slot/:slotId" element={<Quiz />} />
                    {legacyRedirectRoutes}
                    {/* Redirect bare /category/ to home – no "all categories" page exists */}
                    <Route path="/category/" element={<Navigate to="/" replace />} />
                    <Route path="/category" element={<Navigate to="/" replace />} />
                    {/* Canonicalize category routes (avoid duplicate-content URLs) */}
                    <Route
                      path="/category/:slug/"
                      element={
                        <Page>
                          <CategoryQuizzes />
                        </Page>
                      }
                    />
                    <Route
                      path="/category/:slug"
                      element={<CategoryTrailingSlashRedirect />}
                    />
                    <Route path="/results/" element={<Navigate to="/" replace />} />
                    <Route path="/results" element={<Navigate to="/" replace />} />
                    <Route path="/results/:id" element={<Results />} />
                    <Route path="/results/slot/:slotId" element={<Results />} />
                    <Route path="/*" element={<MainLayout />} />
                  </>
                )}
              </Routes>
            </RouteFocusWrapper>
          </Suspense>
          <Toaster />
          <DeferredRender delayMs={10000}>
            <Suspense fallback={null}>
              <CookieConsent />
            </Suspense>
          </DeferredRender>
        </div>
      </Router>
    </ErrorBoundary>
  );
}

/**
 * AdminRoute - Client-side UI protection ONLY
 * ⚠️ SECURITY NOTE: This is NOT real security! It only hides the UI.
 * Real security is enforced by Supabase RLS (Row Level Security) policies.
 * Anyone with DevTools can bypass this check - that's why backend RLS is critical.
 */
function AdminRoute({ children }) {
  const { userProfile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-3 border-indigo-200 border-t-indigo-600"></div>
      </div>
    );
  }
  const role = String(userProfile?.role || '')
    .trim()
    .toLowerCase();
  // Only check role from server-backed profile.
  // Real security is enforced by Supabase RLS, this is UI-only protection
  const isAdmin = role === 'admin';

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="qd-glass rounded-2xl max-w-md w-full p-6 text-center">
          <h2 className="text-xl font-semibold text-red-400 mb-2">Admin access required</h2>
          <p className="text-sm text-white/70">
            Admin panel kholne ke liye aapke Supabase <code>profiles</code> record ka{' '}
            <strong>role</strong> field <code>&apos;admin&apos;</code> hona zaroori hai.
          </p>
          <ul className="text-left text-sm text-white/65 mt-4 space-y-2 list-disc list-inside">
            <li>
              Supabase dashboard &rarr; Table editor &rarr; <code>profiles</code> me login user ka{' '}
              <code>role</code> update karein.
            </li>
            <li>Changes apply hone ke baad dobara login karein ya session refresh karein.</li>
            <li>
              Agar dev bypass (<code>VITE_BYPASS_AUTH=1</code>) use kar rahe hain to mock admin
              profile already enable hai.
            </li>
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
    <div
      id="app-focus-wrapper"
      tabIndex="-1"
      className="outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
    >
      {children}
    </div>
  );
}

// Public layout for non-authenticated users (no Header - integrated in Home)
const PublicLayout = () => {
  const location = useLocation();
  const isHome = location.pathname === '/';
  return (
    <>
      <main
        className={`flex-1 ${isHome ? 'pt-0 pb-0' : 'pt-0 pb-6'}`}
        id="app-main"
        tabIndex="-1"
        role="main"
        aria-label="Application Content"
      >
        <Suspense fallback={<Fallback />}>
          <Routes>
            <Route
              path="/"
              element={
                <Page>
                  <Home />
                </Page>
              }
            />
            {policyRoutes}
            {legacyRedirectRoutes}
            {/* Publicly accessible category pages for SEO */}
            <Route path="/category/" element={<Navigate to="/" replace />} />
            <Route path="/category" element={<Navigate to="/" replace />} />
            <Route
              path="/category/:slug/"
              element={
                <Page>
                  <CategoryQuizzes />
                </Page>
              }
            />
            <Route
              path="/category/:slug"
              element={<CategoryTrailingSlashRedirect />}
            />

            {/* Known protected routes: redirect to login instead of 404 */}
            <Route path="/quiz/*" element={<LoginRedirect message="Please sign in to play quizzes." />} />
            <Route path="/my-quizzes/*" element={<LoginRedirect message="Please sign in to view your quizzes." />} />
            <Route path="/wallet/*" element={<LoginRedirect message="Please sign in to open Wallet." />} />
            <Route path="/profile/*" element={<LoginRedirect message="Please sign in to open Profile." />} />
            <Route path="/redemptions/*" element={<LoginRedirect message="Please sign in to redeem rewards." />} />
            <Route path="/results/*" element={<LoginRedirect message="Please sign in to view results." />} />
            <Route path="/admin/*" element={<LoginRedirect message="Please sign in to continue." />} />
            <Route
              path="*"
              element={
                <Page>
                  <NotFound />
                </Page>
              }
            />
          </Routes>
        </Suspense>
      </main>
      <DeferredRender delayMs={3000}>
        <Suspense fallback={null}>
          <PWAInstallButton />
        </Suspense>
      </DeferredRender>
    </>
  );
};

function CategoryTrailingSlashRedirect() {
  const { slug } = useParams();
  const safeSlug = String(slug || '').trim();
  return <Navigate to={safeSlug ? `/category/${safeSlug}/` : '/category/'} replace />;
}

function LoginRedirect({ message }) {
  const location = useLocation();
  const from = location.pathname + location.search + location.hash;
  return <Navigate to="/login/" replace state={{ from, message: message || 'Please sign in to continue.' }} />;
}

const MainLayout = () => {
  const { userProfile, loading: authLoading, hasSupabaseConfig } = useAuth();
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const requiresProfileCompletion = useMemo(() => {
    // If profile hasn't loaded yet, don't show the modal to avoid flicker
    if (!userProfile) return false;
    const username = (userProfile?.username || '').trim();
    const mobileRaw = ((userProfile?.mobile_number ?? '') + '').trim();
    const usernameOk = /^[a-zA-Z0-9_]{3,}$/.test(username);
    const mobileOk = /^[6-9]\d{9}$/.test(mobileRaw);
    const completionFlag = userProfile?.is_profile_complete === true;
    // Show modal only when truly incomplete: either explicit flag false with missing fields,
    // or brand new user without valid username/mobile yet. If an older user already
    // has both fields valid, do NOT block even if flag was never set previously.
    if (completionFlag) return false;
    if (usernameOk && mobileOk) return false;
    return true;
  }, [userProfile]);

  useEffect(() => {
    if (authLoading) return;
    if (!hasSupabaseConfig) return;
    // Wait until a profile object is available to decide, prevents 1s flicker on initial load
    if (!userProfile) return;
    if (requiresProfileCompletion) {
      setProfileModalOpen(true);
    } else {
      setProfileModalOpen(false);
    }
  }, [authLoading, hasSupabaseConfig, requiresProfileCompletion, userProfile]);

  // Detect if current path is home using React Router
  const location = useLocation();
  const isHome = location.pathname === '/';
  const isProfile = location.pathname === '/profile/' || location.pathname === '/profile';

  return (
    <>
      {/* No Header - integrated in Home.jsx */}
      <main
        className={`flex-1 ${(isHome || isProfile) ? 'pt-0 pb-0' : 'pt-0 pb-24'}`}
        id="app-main"
        tabIndex="-1"
        role="main"
        aria-label="Application Content"
      >
        <Suspense fallback={<Fallback />}>
          <Routes>
            <Route
              path="/"
              element={
                <Page>
                  <Home />
                </Page>
              }
            />
            {legacyRedirectRoutes}
            <Route path="/my-quizzes" element={<Navigate to="/my-quizzes/" replace />} />
            <Route
              path="/my-quizzes/"
              element={
                <Page>
                  <MyQuizzes />
                </Page>
              }
            />
            <Route path="/wallet" element={<Navigate to="/wallet/" replace />} />
            <Route
              path="/wallet/"
              element={
                <Page>
                  <Wallet />
                </Page>
              }
            />
            <Route path="/profile" element={<Navigate to="/profile/" replace />} />
            <Route
              path="/profile/"
              element={
                <Page>
                  <Profile />
                </Page>
              }
            />
            <Route path="/leaderboards" element={<Navigate to="/leaderboards/" replace />} />
            <Route
              path="/leaderboards/"
              element={
                <Page>
                  <Leaderboards />
                </Page>
              }
            />
            <Route path="/refer" element={<Navigate to="/refer/" replace />} />
            <Route
              path="/refer/"
              element={
                <Page>
                  <ReferEarn />
                </Page>
              }
            />
            <Route path="/rewards" element={<Navigate to="/wallet/" replace />} />
            <Route path="/redemptions" element={<Navigate to="/redemptions/" replace />} />
            <Route
              path="/redemptions/"
              element={
                <Page>
                  <Redemptions />
                </Page>
              }
            />
            {/* Reuse informational routes inside authenticated layout as well */}
            <Route path="/about-us" element={<Navigate to="/about-us/" replace />} />
            <Route
              path="/about-us/"
              element={
                <Page>
                  <AboutUs />
                </Page>
              }
            />
            <Route path="/contact-us" element={<Navigate to="/contact-us/" replace />} />
            <Route
              path="/contact-us/"
              element={
                <Page>
                  <ContactUs />
                </Page>
              }
            />
            <Route path="/gk-quiz" element={<Navigate to="/gk-quiz/" replace />} />
            <Route
              path="/gk-quiz/"
              element={
                <Page>
                  <GKQuiz />
                </Page>
              }
            />
            <Route path="/cricket-quiz" element={<Navigate to="/cricket-quiz/" replace />} />
            <Route
              path="/cricket-quiz/"
              element={
                <Page>
                  <CricketQuiz />
                </Page>
              }
            />
            <Route path="/ipl-prediction-quiz" element={<Navigate to="/category/opinion/" replace />} />
            <Route
              path="/ipl-prediction-quiz/"
              element={
                <Page>
                  <Navigate to="/category/opinion/" replace />
                </Page>
              }
            />
            <Route path="/current-affairs-quiz" element={<Navigate to="/current-affairs-quiz/" replace />} />
            <Route
              path="/current-affairs-quiz/"
              element={
                <Page>
                  <CurrentAffairsQuiz />
                </Page>
              }
            />
            <Route path="/bollywood-quiz" element={<Navigate to="/bollywood-quiz/" replace />} />
            <Route
              path="/bollywood-quiz/"
              element={
                <Page>
                  <BollywoodQuiz />
                </Page>
              }
            />
            <Route path="/play-win-quiz-app" element={<Navigate to="/play-win-quiz-app/" replace />} />
            <Route
              path="/play-win-quiz-app/"
              element={
                <Page>
                  <PlayWinQuiz />
                </Page>
              }
            />
            <Route path="/opinion-quiz-app" element={<Navigate to="/opinion-quiz-app/" replace />} />
            <Route
              path="/opinion-quiz-app/"
              element={
                <Page>
                  <OpinionQuiz />
                </Page>
              }
            />
            <Route path="/refer-earn-quiz-app" element={<Navigate to="/refer-earn-quiz-app/" replace />} />
            <Route
              path="/refer-earn-quiz-app/"
              element={
                <Page>
                  <ReferEarnInfo />
                </Page>
              }
            />
            <Route
              path="/debug/notifications/"
              element={
                <Page>
                  <NotificationsDebug />
                </Page>
              }
            />
            <Route path="/debug/notifications" element={<Navigate to="/debug/notifications/" replace />} />
            <Route path="/terms-conditions" element={<Navigate to="/terms-conditions/" replace />} />
            <Route
              path="/terms-conditions/"
              element={
                <Page>
                  <TermsConditions />
                </Page>
              }
            />
            <Route path="/privacy-policy" element={<Navigate to="/privacy-policy/" replace />} />
            <Route
              path="/privacy-policy/"
              element={
                <Page>
                  <PrivacyPolicy />
                </Page>
              }
            />
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <Page>
                    <Admin />
                  </Page>
                </AdminRoute>
              }
            />
            <Route path="/admin/users" element={<Navigate to="/admin?tab=users" replace />} />
            <Route
              path="/admin/leaderboards"
              element={<Navigate to="/admin?tab=leaderboards" replace />}
            />
            <Route
              path="/admin/redemptions"
              element={<Navigate to="/admin?tab=redemptions" replace />}
            />
            <Route path="/admin/reports" element={<Navigate to="/admin?tab=reports" replace />} />
            <Route
              path="*"
              element={
                <Page>
                  <NotFound />
                </Page>
              }
            />
          </Routes>
        </Suspense>
      </main>
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
      <DeferredRender delayMs={3000}>
        <Suspense fallback={null}>
          <PWAInstallButton />
        </Suspense>
      </DeferredRender>
      {hasSupabaseConfig && profileModalOpen && (
        <Suspense fallback={null}>
          <ProfileUpdateModal
            isOpen={profileModalOpen}
            onClose={() => setProfileModalOpen(false)}
            isFirstTime={requiresProfileCompletion}
          />
        </Suspense>
      )}
    </>
  );
};

export default App;
