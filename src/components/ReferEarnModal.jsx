import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Share2, Copy, Users, Gift, Coins, Check } from 'lucide-react';

const ReferEarnModal = ({ isOpen, onClose }) => {
    const { user, userProfile, supabase } = useAuth();
    const [referralStats, setReferralStats] = useState({ total: 0, earnings: 0 });
    const [referralHistory, setReferralHistory] = useState([]);
    const [copied, setCopied] = useState(false);
    const [loading, setLoading] = useState(false);

    const referralCode = userProfile?.referral_code || '';
    const referralLink = `${window.location.origin}?ref=${referralCode}`;

    useEffect(() => {
        if (isOpen && user) {
            fetchReferralData();
        }
    }, [isOpen, user]);

    const fetchReferralData = async () => {
        setLoading(true);
        try {
            // Get referral stats
            const { data: referrals, error: referralError } = await supabase
                .from('referrals')
                .select(`
                    *,
                    referred:profiles!referrals_referred_id_fkey(username, created_at)
                `)
                .eq('referrer_id', user.id)
                .order('created_at', { ascending: false });

            if (referralError) throw referralError;

            const totalReferrals = referrals?.length || 0;
            const totalEarnings = referrals?.reduce((sum, ref) => sum + (ref.coins_awarded || 0), 0) || 0;

            setReferralStats({ total: totalReferrals, earnings: totalEarnings });
            setReferralHistory(referrals || []);
        } catch (error) {
            console.error('Error fetching referral data:', error);
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const shareReferralLink = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Join Quiz Dangal',
                    text: 'Join me on Quiz Dangal and earn coins by playing quizzes! Use my referral code to get started.',
                    url: referralLink
                });
            } catch (error) {
                copyToClipboard(referralLink);
            }
        } else {
            copyToClipboard(referralLink);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center space-x-2">
                        <Gift className="w-5 h-5 text-green-600" />
                        <span>Refer & Earn</span>
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Referral Stats */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                            <div className="flex items-center justify-center space-x-1 mb-1">
                                <Users className="w-4 h-4 text-blue-600" />
                                <span className="text-2xl font-bold text-blue-600">
                                    {referralStats.total}
                                </span>
                            </div>
                            <p className="text-sm text-blue-600">Friends Referred</p>
                        </div>
                        
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                            <div className="flex items-center justify-center space-x-1 mb-1">
                                <Coins className="w-4 h-4 text-yellow-600" />
                                <span className="text-2xl font-bold text-yellow-600">
                                    {referralStats.earnings}
                                </span>
                            </div>
                            <p className="text-sm text-yellow-600">Coins Earned</p>
                        </div>
                    </div>

                    {/* How it Works */}
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                        <h3 className="font-semibold text-green-800 mb-2">How it Works:</h3>
                        <ul className="text-sm text-green-700 space-y-1">
                            <li>• Share your referral link with friends</li>
                            <li>• When they sign up and complete their profile</li>
                            <li>• You earn 50 coins instantly!</li>
                            <li>• No limit on referrals</li>
                        </ul>
                    </div>

                    {/* Referral Code */}
                    <div className="space-y-3">
                        <h3 className="font-semibold text-gray-800">Your Referral Code:</h3>
                        
                        <div className="flex items-center space-x-2">
                            <Input
                                value={referralCode}
                                readOnly
                                className="font-mono text-center text-lg font-bold bg-gray-50"
                            />
                            <Button
                                onClick={() => copyToClipboard(referralCode)}
                                variant="outline"
                                size="sm"
                                className="px-3"
                            >
                                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </Button>
                        </div>
                    </div>

                    {/* Referral Link */}
                    <div className="space-y-3">
                        <h3 className="font-semibold text-gray-800">Your Referral Link:</h3>
                        
                        <div className="flex items-center space-x-2">
                            <Input
                                value={referralLink}
                                readOnly
                                className="text-sm bg-gray-50"
                            />
                            <Button
                                onClick={() => copyToClipboard(referralLink)}
                                variant="outline"
                                size="sm"
                                className="px-3"
                            >
                                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </Button>
                        </div>
                    </div>

                    {/* Share Buttons */}
                    <div className="flex space-x-2">
                        <Button
                            onClick={shareReferralLink}
                            className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                        >
                            <Share2 className="w-4 h-4 mr-2" />
                            Share Link
                        </Button>
                        
                        <Button
                            onClick={() => copyToClipboard(referralLink)}
                            variant="outline"
                            className="flex-1"
                        >
                            {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                            {copied ? 'Copied!' : 'Copy Link'}
                        </Button>
                    </div>

                    {/* Referral History */}
                    {referralHistory.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="font-semibold text-gray-800">Recent Referrals:</h3>
                            
                            <div className="max-h-40 overflow-y-auto space-y-2">
                                {referralHistory.slice(0, 5).map((referral) => (
                                    <div
                                        key={referral.id}
                                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                                    >
                                        <div>
                                            <div className="font-medium text-gray-900">
                                                {referral.referred?.username || 'New User'}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {new Date(referral.created_at).toLocaleDateString()}
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center space-x-1 text-green-600">
                                            <Coins className="w-4 h-4" />
                                            <span className="font-bold">+{referral.coins_awarded}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            {referralHistory.length > 5 && (
                                <p className="text-xs text-gray-500 text-center">
                                    And {referralHistory.length - 5} more referrals...
                                </p>
                            )}
                        </div>
                    )}

                    {/* Empty State */}
                    {referralHistory.length === 0 && !loading && (
                        <div className="text-center py-6 text-gray-500">
                            <Users className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                            <p>No referrals yet</p>
                            <p className="text-sm">Start sharing your link to earn coins!</p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ReferEarnModal;