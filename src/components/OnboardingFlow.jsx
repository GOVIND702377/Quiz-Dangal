import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import LanguageSelectionModal from '@/components/LanguageSelectionModal';

const OnboardingFlow = () => {
  const { user, userProfile, refreshUserProfile } = useAuth();
  const [activeStep, setActiveStep] = useState(null);

  // FIX: `checkOnboardingStatus` is now defined *before* it is used in `useEffect`.
  // It's also wrapped in `useCallback` to prevent it from changing on every render.
  const checkOnboardingStatus = useCallback(() => {
    if (!userProfile) return;

    // This logic assumes profile completion (name, mobile) is handled elsewhere (as seen in App.jsx)
    // It checks for secondary onboarding steps, like choosing a language.
    if (userProfile.is_profile_complete && userProfile.preferred_language === null) {
      setActiveStep('language');
    } else {
      setActiveStep(null);
    }
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

  if (activeStep === 'language') {
    return <LanguageSelectionModal isOpen={true} onComplete={() => setActiveStep(null)} />;
  }

  return null;
};

export default OnboardingFlow;