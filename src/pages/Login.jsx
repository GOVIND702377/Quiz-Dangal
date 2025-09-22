import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Eye, EyeOff } from 'lucide-react';

const Login = () => {
  const { toast } = useToast();
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { signUp, signIn } = auth;
  const [isSignUp, setIsSignUp] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Show a success toast if redirected from reset-password and switch to Sign In mode
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('reset') === '1') {
      toast({
        title: 'Password updated',
        description: 'Please sign in with your new password.',
      });
      setIsSignUp(false);
      // Clean the query string so reloads don't re-toast
      navigate('/login', { replace: true });
    }
  }, [location.search, navigate, toast]);

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (error) {
      toast({
        title: "Google Login Failed",
        description: error.message || "Please try again.",
        variant: "destructive"
      });
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
  setIsLoading(true);
    setEmailSent(false);

    if (isSignUp) {
      const { error, data } = await signUp(email, password);
      if (error) {
        toast({
          title: "Sign Up Failed",
          description: error.message,
          variant: "destructive"
        });
      } else {
        setEmailSent(true);
        toast({
          title: "Confirmation email sent!",
          description: "Please check your inbox to verify your email.",
        });
      }
    } else {
      const { error, data } = await signIn(email, password);
      if (error) {
        toast({
          title: "Sign In Failed",
          description: error.message,
          variant: "destructive"
        });
      }
    }
    setIsLoading(false);
  };

  if (emailSent) {
    return (
  <div className="min-h-[100dvh] flex items-center justify-center px-4 py-6 sm:py-8" style={{paddingTop:'max(1rem, env(safe-area-inset-top))', paddingBottom:'max(1rem, env(safe-area-inset-bottom))'}}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="qd-card rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-xl text-center text-slate-100"
        >
          <h2 className="text-2xl font-bold text-white text-shadow-sm mb-4">Check your email</h2>
          <p className="text-slate-300">We've sent a confirmation link to <strong>{email}</strong>. Please click the link to complete your registration.</p>
        </motion.div>
      </div>
    );
  }

  if (showForgot) {
    return (
  <div className="min-h-[100dvh] flex items-center justify-center px-4 py-6 sm:py-8" style={{paddingTop:'max(1rem, env(safe-area-inset-top))', paddingBottom:'max(1rem, env(safe-area-inset-bottom))'}}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="qd-card rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-xl text-center text-slate-100"
        >
          <h2 className="text-2xl font-bold text-white text-shadow-sm mb-4">Forgot Password</h2>
          <p className="text-slate-300 mb-4">Enter your email to receive a password reset link.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setForgotLoading(true);
              try {
                const { error } = await supabase.auth.resetPasswordForEmail(
                  forgotEmail,
                  { redirectTo: `${window.location.origin}/#/reset-password` }
                );
                if (error) throw error;
                toast({
                  title: "Reset Email Sent!",
                  description: `Check your inbox (${forgotEmail}) for a password reset link.`,
                });
                setShowForgot(false);
              } catch (error) {
                toast({
                  title: "Reset Failed",
                  description: error.message || "Please try again.",
                  variant: "destructive"
                });
              }
              setForgotLoading(false);
            }}
            className="space-y-3 sm:space-y-4"
          >
            <Input
              id="forgot-email"
              type="email"
              value={forgotEmail}
              onChange={e => setForgotEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="mb-2 bg-white text-black placeholder-slate-500 border-slate-300"
            />
            <Button type="submit" disabled={forgotLoading} className="w-full">
              {forgotLoading ? "Sending..." : "Send Reset Link"}
            </Button>
            <Button type="button" variant="white" className="w-full rounded-lg focus:ring-2 focus:ring-indigo-500/40" onClick={() => setShowForgot(false)}>
              Back to Login
            </Button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
  <div className="min-h-[100dvh] flex items-center justify-center px-4 py-6 sm:py-8" style={{paddingTop:'max(1rem, env(safe-area-inset-top))', paddingBottom:'max(1rem, env(safe-area-inset-bottom))'}}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
  className="qd-card rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-xl text-slate-100 flex flex-col"
      >
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-6 sm:mb-8"
        >
          <img 
            src="/logo.svg"
            alt="Quiz Dangal Logo"
            onError={(e) => { e.currentTarget.src='/android-chrome-512x512.png'; }}
            className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 rounded-full shadow-lg"
          />
          <h1 className="text-3xl font-bold text-white text-shadow mb-2">
            Quiz Dangal
          </h1>
          <p className="text-slate-300">Where Minds Clash</p>
        </motion.div>

        {/* Mode label (no box) */}
        <div className="mb-2 text-left">
          <span className="text-accent-b text-sm font-semibold">
            {isSignUp ? 'Create Account' : 'Sign In'}
          </span>
        </div>

        <motion.form
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          onSubmit={handleSubmit}
          className="space-y-3 sm:space-y-4"
        >
          <div>
            <Label htmlFor="email" className="text-slate-200">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email address" required className="bg-white text-black placeholder-slate-500 border-slate-300" />
          </div>
          <div>
            <Label htmlFor="password" className="text-slate-200">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                autoComplete={isSignUp ? "new-password" : "current-password"}
                className="pr-10 bg-white text-black placeholder-slate-500 border-slate-300"
              />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-600 hover:text-slate-800"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {!isSignUp && (
              <button
                type="button"
                className="text-xs text-accent-b hover:underline mt-1 float-right"
                onClick={() => setShowForgot(true)}
              >
                Forgot Password?
              </button>
            )}
          </div>
          {isSignUp && (
            <div>
              <Label htmlFor="referral" className="text-slate-200">Referral Code (optional)</Label>
              <Input id="referral" type="text" value={referralCode} onChange={(e) => setReferralCode(e.target.value.trim())} placeholder="Enter referral code" className="bg-white text-black placeholder-slate-500 border-slate-300" />
            </div>
          )}
          <Button type="submit" disabled={isLoading || isGoogleLoading} variant="brand" className="w-full font-semibold py-3 rounded-lg shadow-lg">
            {isLoading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
          </Button>
        </motion.form>


        <div className="relative my-4 sm:my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-slate-700/60"></span>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-slate-900/80 border border-slate-700/60 px-3 py-0.5 text-slate-300 rounded-full tracking-wide">Or continue with</span>
          </div>
        </div>

        <Button
          onClick={handleGoogleLogin}
          disabled={isLoading || isGoogleLoading}
          variant="white"
          className="w-full font-semibold py-3 rounded-xl shadow-md focus:ring-2 focus:ring-indigo-500/40"
          aria-label="Continue with Google"
        >
          {isGoogleLoading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div>
          ) : (
            <div className="flex items-center justify-center gap-3">
              <svg className="w-5 h-5" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
                <path fill="#EA4335" d="M9 3.48c1.69 0 2.82.73 3.47 1.34l2.36-2.36C13.7 1.07 11.68 0 9 0 5.48 0 2.44 1.99.96 4.9l2.83 2.2C4.5 5.04 6.57 3.48 9 3.48z"/>
                <path fill="#4285F4" d="M17.64 9.2c0-.74-.06-1.28-.19-1.84H9v3.34h4.96c-.1.83-.64 2.08-1.85 2.92l2.84 2.2c1.71-1.57 2.69-3.88 2.69-6.62z"/>
                <path fill="#FBBC05" d="M3.79 10.59A5.52 5.52 0 0 1 3.48 9c0-.55.09-1.08.28-1.59L.96 5.2A9.01 9.01 0 0 0 0 9c0 1.45.35 2.82.96 4.02l2.83-2.43z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.84-2.2c-.76.5-1.78.85-3.12.85-2.43 0-4.49-1.56-5.21-3.68L.96 13.02C2.44 16.01 5.48 18 9 18z"/>
              </svg>
              <span className="font-semibold">Continue with Google</span>
            </div>
          )}
        </Button>

        <p className="mt-3 text-center text-sm text-slate-300">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button onClick={() => setIsSignUp(!isSignUp)} className="font-semibold text-accent-b hover:opacity-90">
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </p>

        {/* Consent: T&C and Privacy Policy links (tiny, subtle) — placed at the very bottom */}
        <p className="mt-5 text-[11px] leading-snug text-white text-center">
          By continuing, you agree to our{' '}
          <Link to="/terms-conditions" className="underline decoration-dotted underline-offset-2 text-accent-b hover:opacity-90">Terms & Conditions</Link>
          {' '}and{' '}
          <Link to="/privacy-policy" className="underline decoration-dotted underline-offset-2 text-accent-b hover:opacity-90">Privacy Policy</Link>.
        </p>
      </motion.div>
    </div>
  );
};

export default Login;