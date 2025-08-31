import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

// Simple Modal component for demonstration
const OnboardingModal = ({ title, children, showCloseButton = true, onClose }) => (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md relative animate-in fade-in-90 slide-in-from-bottom-10">
      <h2 className="text-xl font-bold mb-4 text-center">{title}</h2>
      {children}
      {showCloseButton && (
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 transition-colors">
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  </div>
);

// Language Selection Modal
const LanguageSelectionModal = ({ onClose }) => {
  const { user, refreshUserProfile } = useAuth();
  const [selectedLang, setSelectedLang] = useState('hindi');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ preferred_language: selectedLang })
      .eq('id', user.id);
    
    if (!error) {
      await refreshUserProfile(user);
      onClose();
    } else {
      console.error("Failed to save language", error);
    }
    setSaving(false);
  };

  return (
    <OnboardingModal title="Choose Your Language" showCloseButton={false}>
      <div className="space-y-2">
        {['hindi', 'english'].map(lang => (
          <button 
            key={lang}
            onClick={() => setSelectedLang(lang)}
            className={`w-full p-3 rounded-lg border-2 text-left font-medium ${selectedLang === lang ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}`}
          >
            {lang.charAt(0).toUpperCase() + lang.slice(1)}
          </button>
        ))}
      </div>
      <Button onClick={handleSave} disabled={saving} className="w-full mt-4">
        {saving ? 'Saving...' : 'Save and Continue'}
      </Button>
    </OnboardingModal>
  );
};

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
    return <LanguageSelectionModal onClose={() => setActiveStep(null)} />;
  }

  return null;
};

export default OnboardingFlow;