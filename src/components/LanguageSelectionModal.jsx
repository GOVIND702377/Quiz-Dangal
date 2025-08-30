import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Loader2 } from 'lucide-react';

const languages = [
    { code: 'hindi', name: 'हिंदी', flag: '🇮🇳' },
    { code: 'english', name: 'English', flag: '🇺🇸' },
    { code: 'punjabi', name: 'ਪੰਜਾਬੀ', flag: '🇮🇳' },
    { code: 'gujarati', name: 'ગુજરાતી', flag: '🇮🇳' },
    { code: 'marathi', name: 'मराठी', flag: '🇮🇳' },
    { code: 'bengali', name: 'বাংলা', flag: '🇮🇳' },
    { code: 'tamil', name: 'தமிழ்', flag: '🇮🇳' },
    { code: 'telugu', name: 'తెలుగు', flag: '🇮🇳' }
];

const LanguageSelectionModal = ({ isOpen, onComplete }) => {
    const { user, supabase, refreshUserProfile } = useAuth();
    const [selectedLanguage, setSelectedLanguage] = useState('hindi');
    const [loading, setLoading] = useState(false);

    const handleLanguageSelect = async () => {
        if (!selectedLanguage) return;
        
        setLoading(true);
        
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ preferred_language: selectedLanguage })
                .eq('id', user.id);

            if (error) throw error;

            await refreshUserProfile(user);
            onComplete();
        } catch (error) {
            console.error('Language selection error:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={() => {}}>
            <DialogContent className="sm:max-w-md" closeButton={false}>
                <DialogHeader>
                    <DialogTitle className="text-center">
                        Choose Your Preferred Language
                    </DialogTitle>
                    <p className="text-sm text-gray-600 text-center">
                        Select the language you're most comfortable with
                    </p>
                </DialogHeader>

                <div className="space-y-3">
                    {languages.map((language) => (
                        <button
                            key={language.code}
                            onClick={() => setSelectedLanguage(language.code)}
                            className={`w-full p-3 rounded-lg border-2 transition-all duration-200 flex items-center space-x-3 ${
                                selectedLanguage === language.code
                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                        >
                            <span className="text-2xl">{language.flag}</span>
                            <span className="font-medium text-lg">{language.name}</span>
                            {selectedLanguage === language.code && (
                                <div className="ml-auto w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                                    <div className="w-2 h-2 bg-white rounded-full"></div>
                                </div>
                            )}
                        </button>
                    ))}
                </div>

                <Button 
                    onClick={handleLanguageSelect}
                    className="w-full mt-6" 
                    disabled={loading || !selectedLanguage}
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Saving...
                        </>
                    ) : (
                        'Continue'
                    )}
                </Button>
            </DialogContent>
        </Dialog>
    );
};

export default LanguageSelectionModal;