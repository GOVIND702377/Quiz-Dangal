import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Bell, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from 'react-router-dom';

const NotificationBell = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.rpc('fetch_my_unread_notifications');
      if (error) {
        console.error('Error fetching notifications:', error);
        return;
      }
      setNotifications(data || []);
      setUnreadCount(data?.length || 0);
    } catch (e) {
      console.error(e);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(() => {
      fetchNotifications();
    }, 60000); // Poll every 60 seconds

    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleOpenChange = async (isOpen) => {
    if (isOpen && notifications.length > 0) {
      const notificationIds = notifications.map(n => n.id);
      try {
        await supabase.rpc('mark_notifications_as_read', { notification_ids: notificationIds });
        setUnreadCount(0);
        setTimeout(fetchNotifications, 2000);
      } catch (error) {
        console.error('Failed to mark notifications as read:', error);
      }
    }
  };

  const handleNotificationClick = (url) => {
    if (url) {
      navigate(url);
    }
  };

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          {unreadCount > 0 ? <BellRing className="h-5 w-5 text-yellow-500" /> : <Bell className="h-5 w-5" />}
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80" align="end">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length > 0 ? (
          notifications.map(n => (
            <DropdownMenuItem key={n.notification_id} onSelect={() => handleNotificationClick(n.reference_url)} className="flex flex-col items-start gap-1 cursor-pointer">
              <p className="font-semibold">{n.title}</p>
              <p className="text-sm text-gray-600">{n.message}</p>
              <p className="text-xs text-gray-400">{new Date(n.created_at).toLocaleString()}</p>
            </DropdownMenuItem>
          ))
        ) : (
          <DropdownMenuItem disabled>No new notifications</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationBell;
