import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Loader2, Globe } from 'lucide-react';

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
            <DialogContent overlayClassName="!bg-transparent !backdrop-blur-0" className="sm:max-w-md bg-gradient-to-br from-indigo-950/60 via-violet-950/50 to-fuchsia-950/50 border border-indigo-700/60 backdrop-blur-xl text-slate-100" closeButton={false}>
                <DialogHeader>
                    <DialogTitle className="text-center font-extrabold flex items-center justify-center gap-2">
                        <Globe className="w-5 h-5 text-cyan-300" />
                        <span className="bg-gradient-to-r from-sky-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">Choose Your Preferred Language</span>
                    </DialogTitle>
                    <p className="text-sm text-slate-300 text-center">
                        Select the language you're most comfortable with
                    </p>
                </DialogHeader>

                <div className="space-y-3">
                    {languages.map((language) => (
                        <button
                            key={language.code}
                            onClick={() => setSelectedLanguage(language.code)}
                            className={`w-full p-3 rounded-xl border transition-all duration-200 flex items-center gap-3 ${
                                selectedLanguage === language.code
                                    ? 'border-cyan-600/50 bg-cyan-900/30 text-cyan-100'
                                    : 'border-slate-700/60 bg-slate-900/60 hover:bg-slate-800/60'
                            }`}
                        >
                            <span className="text-2xl">{language.flag}</span>
                            <span className="font-medium text-lg">{language.name}</span>
                            {selectedLanguage === language.code && (
                                <div className="ml-auto w-4 h-4 bg-cyan-500 rounded-full flex items-center justify-center">
                                    <div className="w-2 h-2 bg-white rounded-full"></div>
                                </div>
                            )}
                        </button>
                    ))}
                </div>

                <Button 
                    onClick={handleLanguageSelect}
                    className="w-full mt-6 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 hover:opacity-90"
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