import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import ProfileUpdateModal from '@/components/ProfileUpdateModal';

const OnboardingFlow = () => {
  const { userProfile } = useAuth();
  const [activeStep, setActiveStep] = useState(null);

  const checkOnboardingStatus = useCallback(() => {
    if (!userProfile) return;

    // Only for brand-new users (fresh accounts) — enforce completion once
    const createdAt = userProfile.created_at ? new Date(userProfile.created_at) : null;
    const NEW_WINDOW_MS = 24 * 60 * 60 * 1000; // consider "new" within first 24 hours
    const isNewProfile = createdAt ? (Date.now() - createdAt.getTime() <= NEW_WINDOW_MS) : false;

    const profileComplete = Boolean(userProfile.username && userProfile.mobile_number && userProfile.is_profile_complete);

    if (isNewProfile && !profileComplete) {
      setActiveStep('profile');
      return;
    }
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