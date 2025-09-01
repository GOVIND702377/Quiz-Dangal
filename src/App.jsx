import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
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
import ProfileUpdate from '@/pages/ProfileUpdate';
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

const UnconfirmedEmail = () => (
  <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
    <div className="bg-white/80 backdrop-blur-md border border-white/20 rounded-2xl p-8 max-w-md w-full shadow-xl text-center">
      <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">Check your email</h2>
      <p className="text-gray-600">We've sent a confirmation link to your email address. Please click the link to complete your registration.</p>
    </div>
  </div>
);

function App() {
  const { user, userProfile, loading } = useAuth();

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

  if (!user) {
    return (
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Helmet>
          <title>Quiz Dangal - Login</title>
          <meta name="description" content="Login to Quiz Dangal and start playing opinion-based quizzes." />
        </Helmet>
        <Routes>
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<Login />} />
        </Routes>
        <Toaster />
      </Router>
    );
  }
  
  if (user && user.app_metadata?.provider === 'email' && !user.email_confirmed_at) {
     return (
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Helmet>
          <title>Quiz Dangal - Confirm Email</title>
          <meta name="description" content="Confirm your email to continue." />
        </Helmet>
        <Routes>
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<UnconfirmedEmail />} />
        </Routes>
        <Toaster />
      </Router>
    );
  }

  
  // Gate profile completion: require username + mobile number + profile complete flag
  if (user && userProfile && (!userProfile.username || !userProfile.mobile_number || !userProfile.is_profile_complete)) {
    return (
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/profile-update" element={<ProfileUpdate />} />
          <Route path="*" element={<Navigate to="/profile-update" replace />} />
        </Routes>
        <Toaster />
      </Router>
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
            <Route path="/reset-password" element={<ResetPassword />} />
             <Route path="/quiz/:id" element={<Quiz />} />
             <Route path="/results/:id" element={<Results />} />
             <Route path="/*" element={<MainLayout />} />
          </Routes>
          <Toaster />
        </div>
      </Router>
    </ErrorBoundary>
  );
}

// AdminRoute: sirf admin users ke liye
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
      <main className="flex-1 pb-24 pt-4 page-transition">
        <Routes>
          <Route path="/" element={<div className="page-transition"><Home /></div>} />
          <Route path="/my-quizzes" element={<div className="page-transition"><MyQuizzes /></div>} />
          <Route path="/wallet" element={<div className="page-transition"><Wallet /></div>} />
          <Route path="/profile" element={<div className="page-transition"><Profile /></div>} />
          <Route path="/leaderboards" element={<div className="page-transition"><Leaderboards /></div>} />
          <Route path="/language" element={<div className="page-transition"><Language /></div>} />
          <Route path="/rewards" element={<Navigate to="/wallet" replace />} />
          <Route path="/redemptions" element={<div className="page-transition"><Redemptions /></div>} />
          <Route path="/about-us" element={<div className="page-transition"><AboutUs /></div>} />
          <Route path="/contact-us" element={<div className="page-transition"><ContactUs /></div>} />
          <Route path="/terms-conditions" element={<div className="page-transition"><TermsConditions /></div>} />
          <Route path="/privacy-policy" element={<div className="page-transition"><PrivacyPolicy /></div>} />
          <Route path="/admin" element={<AdminRoute><div className="page-transition"><Admin /></div></AdminRoute>} />
          {/* Back-compat redirects to single admin with tab param */}
          <Route path="/admin/users" element={<Navigate to="/admin?tab=users" replace />} />
          <Route path="/admin/leaderboards" element={<Navigate to="/admin?tab=leaderboards" replace />} />
          <Route path="/admin/redemptions" element={<Navigate to="/admin?tab=redemptions" replace />} />
          <Route path="/admin/reports" element={<Navigate to="/admin?tab=reports" replace />} />
          <Route path="/test" element={<div style={{padding: '20px', color: 'red', fontSize: '24px'}}>TEST PAGE WORKING!</div>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
      
      {/* PWA Install Button */}
      <PWAInstallButton />
      
      {/* Onboarding Flow */}
      <OnboardingFlow />
    </>
  );
};

export default App;
