import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Toaster } from '@/components/ui/toaster';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
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
import AdminRedemptions from '@/pages/AdminRedemptions';
import AdminReports from '@/pages/AdminReports';
import AdminUsers from '@/pages/AdminUsers';
import AdminLeaderboards from '@/pages/AdminLeaderboards';
import AdminTest from '@/pages/AdminTest';
import Results from '@/pages/Results';
import Leaderboards from '@/pages/Leaderboards';
import Redemptions from '@/pages/Redemptions';
import Language from '@/pages/Language';

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
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <Router>
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
      <Router>
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

  
  // Gate profile completion: require username + full name + phone number
  if (user && userProfile && (!userProfile.full_name || !userProfile.username || !userProfile.phone_number)) {
    return (
      <Router>
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
      <Router>
        <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 to-indigo-100 text-gray-800">
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
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-indigo-500"></div>
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
      <main className="flex-1 pb-24 pt-16">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/my-quizzes" element={<MyQuizzes />} />
          <Route path="/wallet" element={<Wallet />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/leaderboards" element={<Leaderboards />} />
          <Route path="/language" element={<Language />} />
          <Route path="/rewards" element={<Navigate to="/wallet" replace />} />
          <Route path="/redemptions" element={<Redemptions />} />
          <Route path="/about-us" element={<AboutUs />} />
          <Route path="/contact-us" element={<ContactUs />} />
          <Route path="/terms-conditions" element={<TermsConditions />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
          <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
          <Route path="/admin/leaderboards" element={<AdminRoute><AdminLeaderboards /></AdminRoute>} />
          <Route path="/admin/redemptions" element={<AdminRoute><AdminRedemptions /></AdminRoute>} />
          <Route path="/admin/reports" element={<AdminRoute><AdminReports /></AdminRoute>} />
          <Route path="/admin-test" element={<AdminTest />} />
          <Route path="/test" element={<div style={{padding: '20px', color: 'red', fontSize: '24px'}}>TEST PAGE WORKING!</div>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
};

export default App;
