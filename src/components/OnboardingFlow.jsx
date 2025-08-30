import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import ProfileUpdateModal from './ProfileUpdateModal';
import LanguageSelectionModal from './LanguageSelectionModal';
import NotificationPermissionModal from './NotificationPermissionModal';
import DailyStreakModal from './DailyStreakModal';

const OnboardingFlow = () => {
    const { user, userProfile, supabase } = useAuth();
    const [currentStep, setCurrentStep] = useState(null);
    const [streakData, setStreakData] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user && userProfile !== null) {
            checkOnboardingStatus();
        }
    }, [user, userProfile]);

    const checkOnboardingStatus = async () => {
        if (!user || !userProfile) return;

        // Check if this is a new user (no preferred language set)
        if (!userProfile.preferred_language) {
            setCurrentStep('language');
            return;
        }

        // Check if profile is incomplete
        if (!userProfile.is_profile_complete || !userProfile.username || !userProfile.mobile_number) {
            setCurrentStep('profile');
            return;
        }

        // Check if notification permission not set
        if (userProfile.notification_enabled === null) {
            setCurrentStep('notification');
            return;
        }

        // Check daily login streak
        await checkDailyLogin();
    };

    const checkDailyLogin = async () => {
        if (!user) return;

        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('handle_daily_login', {
                user_uuid: user.id
            });

            if (error) throw error;

            if (data && !data.error) {
                setStreakData(data);
                if (data.is_new_login) {
                    setCurrentStep('streak');
                }
            }
        } catch (error) {
            console.error('Daily login check error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLanguageComplete = () => {
        setCurrentStep('profile');
    };

    const handleProfileComplete = () => {
        setCurrentStep('notification');
    };

    const handleNotificationComplete = async () => {
        setCurrentStep(null);
        // Check daily login after onboarding
        await checkDailyLogin();
    };

    const handleStreakComplete = () => {
        setCurrentStep(null);
    };

    // Handle referral processing for new users
    useEffect(() => {
        if (user && userProfile?.is_profile_complete && !userProfile.referred_by) {
            const urlParams = new URLSearchParams(window.location.search);
            const refCode = urlParams.get('ref');
            
            if (refCode && refCode !== userProfile.referral_code) {
                processReferral(refCode);
            }
        }
    }, [user, userProfile]);

    const processReferral = async (referralCode) => {
        try {
            const { data, error } = await supabase.rpc('handle_referral_bonus', {
                referred_user_uuid: user.id,
                referrer_code: referralCode
            });

            if (error) throw error;

            if (data && data.success) {
                // Show success notification or toast
                console.log('Referral processed successfully:', data);
            }
        } catch (error) {
            console.error('Referral processing error:', error);
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p>Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Language Selection Modal */}
            <LanguageSelectionModal
                isOpen={currentStep === 'language'}
                onComplete={handleLanguageComplete}
            />

            {/* Profile Update Modal */}
            <ProfileUpdateModal
                isOpen={currentStep === 'profile'}
                onClose={handleProfileComplete}
                isFirstTime={true}
            />

            {/* Notification Permission Modal */}
            <NotificationPermissionModal
                isOpen={currentStep === 'notification'}
                onComplete={handleNotificationComplete}
            />

            {/* Daily Streak Modal */}
            <DailyStreakModal
                isOpen={currentStep === 'streak'}
                onClose={handleStreakComplete}
                streakData={streakData}
            />
        </>
    );
};

export default OnboardingFlow;