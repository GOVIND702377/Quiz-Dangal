import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import ProfileUpdateModal from '@/components/ProfileUpdateModal';

const OnboardingFlow = () => {
  const { user, userProfile, refreshUserProfile } = useAuth();
  const [activeStep, setActiveStep] = useState(null);

  // FIX: `checkOnboardingStatus` is now defined *before* it is used in `useEffect`.
  // It's also wrapped in `useCallback` to prevent it from changing on every render.
  const checkOnboardingStatus = useCallback(() => {
    if (!userProfile) return;

    // Only show profile modal for truly new users (recently created profiles)
    const createdAt = userProfile.created_at ? new Date(userProfile.created_at) : null;
    const NEW_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
    const isNewProfile = createdAt ? (Date.now() - createdAt.getTime() <= NEW_WINDOW_MS) : false;

    const profileComplete = Boolean(userProfile.username && userProfile.mobile_number && userProfile.is_profile_complete);

    // Show only once per session for brand-new profiles
    const sessKey = user ? `qd_new_profile_prompt_shown_${user.id}` : null;
    let shownThisSession = false;
    try { if (sessKey) shownThisSession = sessionStorage.getItem(sessKey) === '1'; } catch {}

    if (isNewProfile && !profileComplete && !shownThisSession) {
      try { if (sessKey) sessionStorage.setItem(sessKey, '1'); } catch {}
      setActiveStep('profile');
      return;
    }

    // Language selection removed

    setActiveStep(null);
  }, [userProfile]);

  useEffect(() => {
    const timer = setTimeout(() => {
        if (userProfile) {
            checkOnboardingStatus();
        }
    }, 1500); // 1.5 second delay so it's not too intrusive.

    return () => clearTimeout(timer);
  }, [userProfile, checkOnboardingStatus]);

  if (!userProfile || !activeStep) return null;

  if (activeStep === 'profile') {
    return <ProfileUpdateModal isOpen={true} onClose={() => setActiveStep(null)} isFirstTime={true} />;
  }

  // No language step

  return null;
};

export default OnboardingFlow;