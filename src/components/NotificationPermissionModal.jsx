import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Bell, BellOff, Loader2 } from 'lucide-react';

const NotificationPermissionModal = ({ isOpen, onComplete }) => {
    const { user, supabase, refreshUserProfile } = useAuth();
    const [loading, setLoading] = useState(false);

    const requestNotificationPermission = async () => {
        setLoading(true);
        
        try {
            let notificationEnabled = false;
            
            if ('Notification' in window) {
                const permission = await Notification.requestPermission();
                notificationEnabled = permission === 'granted';
                
                if (notificationEnabled) {
                    // Show a test notification
                    new Notification('Quiz Dangal', {
                        body: 'Notifications enabled! You\'ll get updates about new quizzes and rewards.',
                        icon: '/logo.svg'
                    });
                }
            }

            // Update user preference in database
            const { error } = await supabase
                .from('profiles')
                .update({ notification_enabled: notificationEnabled })
                .eq('id', user.id);

            if (error) throw error;

            await refreshUserProfile(user);
            onComplete();
        } catch (error) {
            console.error('Notification permission error:', error);
            // Still complete the flow even if notification fails
            onComplete();
        } finally {
            setLoading(false);
        }
    };

    const skipNotifications = async () => {
        setLoading(true);
        
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ notification_enabled: false })
                .eq('id', user.id);

            if (error) throw error;

            await refreshUserProfile(user);
            onComplete();
        } catch (error) {
            console.error('Skip notification error:', error);
            onComplete();
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={() => {}}>
            <DialogContent className="sm:max-w-md" closeButton={false}>
                <DialogHeader>
                    <DialogTitle className="text-center">
                        Stay Updated with Notifications
                    </DialogTitle>
                </DialogHeader>

                <div className="text-center space-y-4">
                    <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                        <Bell className="w-8 h-8 text-blue-600" />
                    </div>
                    
                    <div className="space-y-2">
                        <h3 className="font-semibold text-lg">Get Notified About:</h3>
                        <ul className="text-sm text-gray-600 space-y-1">
                            <li>• New quiz competitions</li>
                            <li>• Daily login streak reminders</li>
                            <li>• Prize announcements</li>
                            <li>• Leaderboard updates</li>
                        </ul>
                    </div>

                    <div className="space-y-3 pt-4">
                        <Button 
                            onClick={requestNotificationPermission}
                            className="w-full" 
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Enabling...
                                </>
                            ) : (
                                <>
                                    <Bell className="w-4 h-4 mr-2" />
                                    Enable Notifications
                                </>
                            )}
                        </Button>
                        
                        <Button 
                            onClick={skipNotifications}
                            variant="outline" 
                            className="w-full" 
                            disabled={loading}
                        >
                            <BellOff className="w-4 h-4 mr-2" />
                            Skip for Now
                        </Button>
                    </div>

                    <p className="text-xs text-gray-500">
                        You can change this setting later in your profile
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default NotificationPermissionModal;