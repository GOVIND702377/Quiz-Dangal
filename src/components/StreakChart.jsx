import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Flame, Calendar } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const StreakChart = () => {
    const { user, supabase, userProfile } = useAuth();
    const [streakData, setStreakData] = useState([]);
    const [showChart, setShowChart] = useState(false);
    const [loading, setLoading] = useState(false);

    const fetchStreakData = async () => {
        if (!user) return;
        
        setLoading(true);
        try {
            const currentMonth = new Date().getMonth() + 1;
            const currentYear = new Date().getFullYear();
            
            const { data, error } = await supabase
                .from('daily_streaks')
                .select('login_date, streak_day, coins_earned')
                .eq('user_id', user.id)
                .gte('login_date', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
                .lt('login_date', `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`)
                .order('login_date', { ascending: true });

            if (error) throw error;
            setStreakData(data || []);
        } catch (error) {
            console.error('Error fetching streak data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (showChart) {
            fetchStreakData();
        }
    }, [showChart, user]);

    const getDaysInCurrentMonth = () => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    };

    const isDateCompleted = (day) => {
        const currentDate = new Date();
        const checkDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        const dateString = checkDate.toISOString().split('T')[0];
        
        return streakData.some(streak => streak.login_date === dateString);
    };

    const getStreakInfo = (day) => {
        const currentDate = new Date();
        const checkDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        const dateString = checkDate.toISOString().split('T')[0];
        
        return streakData.find(streak => streak.login_date === dateString);
    };

    const currentStreak = userProfile?.current_streak || 0;
    const maxStreak = userProfile?.max_streak || 0;

    return (
        <>
            {/* Header Icon */}
            <button
                onClick={() => setShowChart(true)}
                className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
                title="View Streak Chart"
            >
                <Flame className={`w-6 h-6 ${currentStreak > 0 ? 'text-orange-500' : 'text-gray-400'}`} />
                {currentStreak > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                        {currentStreak}
                    </span>
                )}
            </button>

            {/* Streak Chart Modal */}
            <Dialog open={showChart} onOpenChange={setShowChart}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center space-x-2">
                            <Calendar className="w-5 h-5" />
                            <span>Monthly Streak Chart</span>
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Streak Stats */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                                <div className="flex items-center justify-center space-x-1">
                                    <Flame className="w-4 h-4 text-orange-500" />
                                    <span className="text-2xl font-bold text-orange-600">{currentStreak}</span>
                                </div>
                                <p className="text-sm text-orange-600">Current Streak</p>
                            </div>
                            
                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
                                <div className="text-2xl font-bold text-purple-600">{maxStreak}</div>
                                <p className="text-sm text-purple-600">Best Streak</p>
                            </div>
                        </div>

                        {/* Calendar Grid */}
                        <div className="space-y-2">
                            <h3 className="font-semibold text-gray-700">
                                {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                            </h3>
                            
                            {/* Days of Week Header */}
                            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-500 mb-2">
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                    <div key={day} className="py-1">{day}</div>
                                ))}
                            </div>
                            
                            {/* Calendar Days */}
                            <div className="grid grid-cols-7 gap-1">
                                {/* Empty cells for days before month starts */}
                                {Array.from({ length: new Date(new Date().getFullYear(), new Date().getMonth(), 1).getDay() }, (_, i) => (
                                    <div key={`empty-${i}`} className="w-8 h-8"></div>
                                ))}
                                
                                {/* Days of the month */}
                                {Array.from({ length: getDaysInCurrentMonth() }, (_, i) => {
                                    const day = i + 1;
                                    const today = new Date().getDate();
                                    const isToday = day === today;
                                    const isCompleted = isDateCompleted(day);
                                    const streakInfo = getStreakInfo(day);
                                    const isFuture = day > today;
                                    
                                    return (
                                        <div
                                            key={day}
                                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium relative group cursor-pointer ${
                                                isToday
                                                    ? 'bg-blue-500 text-white ring-2 ring-blue-300'
                                                    : isCompleted
                                                    ? 'bg-green-500 text-white'
                                                    : isFuture
                                                    ? 'bg-gray-100 text-gray-300'
                                                    : 'bg-red-100 text-red-500'
                                            }`}
                                            title={
                                                isCompleted 
                                                    ? `Day ${day}: +${streakInfo?.coins_earned || 0} coins (Streak Day ${streakInfo?.streak_day || 0})`
                                                    : isFuture
                                                    ? `Day ${day}: Future`
                                                    : `Day ${day}: Missed`
                                            }
                                        >
                                            {day}
                                            
                                            {/* Tooltip */}
                                            {streakInfo && (
                                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                                    +{streakInfo.coins_earned} coins
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Legend */}
                        <div className="flex justify-center space-x-4 text-xs">
                            <div className="flex items-center space-x-1">
                                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                <span>Completed</span>
                            </div>
                            <div className="flex items-center space-x-1">
                                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                <span>Today</span>
                            </div>
                            <div className="flex items-center space-x-1">
                                <div className="w-3 h-3 bg-red-100 rounded-full"></div>
                                <span>Missed</span>
                            </div>
                            <div className="flex items-center space-x-1">
                                <div className="w-3 h-3 bg-gray-100 rounded-full"></div>
                                <span>Future</span>
                            </div>
                        </div>

                        {/* Monthly Stats */}
                        <div className="bg-gray-50 rounded-lg p-3">
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div>
                                    <div className="font-bold text-lg">{streakData.length}</div>
                                    <div className="text-xs text-gray-600">Days Logged</div>
                                </div>
                                <div>
                                    <div className="font-bold text-lg">
                                        {streakData.reduce((sum, day) => sum + (day.coins_earned || 0), 0)}
                                    </div>
                                    <div className="text-xs text-gray-600">Coins Earned</div>
                                </div>
                                <div>
                                    <div className="font-bold text-lg">
                                        {Math.round((streakData.length / new Date().getDate()) * 100)}%
                                    </div>
                                    <div className="text-xs text-gray-600">Completion</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default StreakChart;