import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Flame, Coins, Calendar, Trophy, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

const DailyStreakModal = ({ isOpen, onClose, streakData }) => {
    const { refreshUserProfile, user } = useAuth();
    const [showConfetti, setShowConfetti] = useState(false);

    useEffect(() => {
        if (isOpen && streakData?.is_new_login) {
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 3000);
        }
    }, [isOpen, streakData]);

    const handleClaim = async () => {
        await refreshUserProfile(user);
        onClose();
    };

    if (!streakData) return null;

    const { streak_day, coins_earned, total_coins, is_new_login } = streakData;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-center">
                        {is_new_login ? 'Daily Login Reward!' : 'Streak Status'}
                    </DialogTitle>
                </DialogHeader>

                <div className="text-center space-y-6">
                    {/* Streak Icon */}
                    <motion.div 
                        className="mx-auto w-20 h-20 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center"
                        animate={showConfetti ? { scale: [1, 1.2, 1] } : {}}
                        transition={{ duration: 0.5, repeat: showConfetti ? 3 : 0 }}
                    >
                        <Flame className="w-10 h-10 text-white" />
                    </motion.div>

                    {/* Streak Day */}
                    <div className="space-y-2">
                        <h2 className="text-3xl font-bold text-gray-800">
                            Day {streak_day}
                        </h2>
                        <p className="text-gray-600">
                            {is_new_login ? 'Congratulations on your login streak!' : 'Keep your streak alive!'}
                        </p>
                    </div>

                    {/* Coins Earned */}
                    {is_new_login && (
                        <motion.div 
                            className="bg-yellow-50 border border-yellow-200 rounded-lg p-4"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.3 }}
                        >
                            <div className="flex items-center justify-center space-x-2">
                                <Coins className="w-6 h-6 text-yellow-600" />
                                <span className="text-2xl font-bold text-yellow-700">
                                    +{coins_earned}
                                </span>
                            </div>
                            <p className="text-sm text-yellow-600 mt-1">Coins Earned</p>
                        </motion.div>
                    )}

                    {/* Total Coins */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="flex items-center justify-center space-x-2">
                            <Trophy className="w-5 h-5 text-blue-600" />
                            <span className="font-semibold text-blue-700">
                                Total Coins: {total_coins}
                            </span>
                        </div>
                    </div>

                    {/* Streak Calendar Preview */}
                    <div className="space-y-3">
                        <h3 className="font-semibold text-gray-700 flex items-center justify-center space-x-2">
                            <Calendar className="w-4 h-4" />
                            <span>This Month's Progress</span>
                        </h3>
                        
                        <div className="grid grid-cols-7 gap-1">
                            {Array.from({ length: 31 }, (_, i) => {
                                const day = i + 1;
                                const today = new Date().getDate();
                                const isToday = day === today;
                                const isCompleted = day <= today && day > (today - streak_day);
                                
                                return (
                                    <div
                                        key={day}
                                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                                            isToday
                                                ? 'bg-orange-500 text-white'
                                                : isCompleted
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-gray-100 text-gray-400'
                                        }`}
                                    >
                                        {day}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Motivational Message */}
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-3">
                        <p className="text-sm text-purple-700">
                            {streak_day === 1 
                                ? "Great start! Come back tomorrow to continue your streak 🚀"
                                : streak_day < 7
                                ? `Amazing! ${7 - streak_day} more days to complete your first week! 💪`
                                : streak_day < 30
                                ? `Incredible streak! You're on fire! 🔥`
                                : "Legendary streak! You're a Quiz Dangal champion! 👑"
                            }
                        </p>
                    </div>

                    {/* Action Button */}
                    <Button 
                        onClick={handleClaim}
                        className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                    >
                        {is_new_login ? 'Claim Reward' : 'Continue'}
                    </Button>

                    {/* Next Day Preview */}
                    {is_new_login && (
                        <p className="text-xs text-gray-500">
                            Tomorrow's reward: {10 + (streak_day * 5)} coins
                        </p>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default DailyStreakModal;