import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Camera, Loader2 } from 'lucide-react';

const ProfileUpdateModal = ({ isOpen, onClose, isFirstTime = false }) => {
    const { user, userProfile, supabase, refreshUserProfile } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        username: '',
        mobile_number: '',
        avatar_url: ''
    });
    const [errors, setErrors] = useState({});
    const [avatarFile, setAvatarFile] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState('');

    useEffect(() => {
        let cancelled = false;

        const extractPathFromUrl = (url) => {
            if (!url) return '';
            try {
                // If already a relative path like "<userId>/<file>"
                if (!/^https?:\/\//i.test(url)) return url.replace(/^\/+/, '');
                // Try to extract after bucket name in Supabase public/signed URLs
                const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/avatars\/(.+)$/);
                if (m && m[1]) return decodeURIComponent(m[1]);
                // Not a known Supabase storage URL; return as-is so we can display it directly
                return url;
            } catch {
                return url;
            }
        };

        const resolvePreviewUrl = async (raw) => {
            const pathOrUrl = extractPathFromUrl(raw);
            // If this looks like an absolute non-Supabase URL, use directly
            if (/^https?:\/\//i.test(pathOrUrl) && !/\/storage\/v1\/object\//.test(pathOrUrl)) {
                return pathOrUrl;
            }
            // Otherwise, assume it's a storage path under the 'avatars' bucket
            try {
                const pub = supabase?.storage?.from('avatars')?.getPublicUrl(pathOrUrl);
                const publicUrl = pub?.data?.publicUrl;
                if (publicUrl) return publicUrl;
            } catch (e) { /* public url resolution fail */ }
            try {
                const { data, error } = await supabase.storage.from('avatars').createSignedUrl(pathOrUrl, 60 * 60);
                if (error) throw error;
                return data?.signedUrl || '';
            } catch (e) {
                console.warn('Avatar preview fetch failed:', e);
                return '';
            }
        };

        const init = async () => {
            if (!userProfile) return;
            setFormData({
                username: userProfile.username || '',
                mobile_number: userProfile.mobile_number || '',
                avatar_url: userProfile.avatar_url || ''
            });
            if (userProfile.avatar_url && supabase) {
                const url = await resolvePreviewUrl(userProfile.avatar_url);
                if (!cancelled) setAvatarPreview(url);
            } else {
                setAvatarPreview('');
            }
        };

        init();
        return () => { cancelled = true; };
    }, [userProfile, supabase]);

    const validateForm = () => {
        const newErrors = {};
        
        if (!formData.username.trim()) {
            newErrors.username = 'Username is required';
        } else if (formData.username.length < 3) {
            newErrors.username = 'Username must be at least 3 characters';
        } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
            newErrors.username = 'Username can only contain letters, numbers, and underscores';
        }
        
        if (!formData.mobile_number.trim()) {
            newErrors.mobile_number = 'Mobile number is required';
        } else if (!/^[6-9]\d{9}$/.test(formData.mobile_number)) {
            newErrors.mobile_number = 'Please enter a valid 10-digit mobile number';
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const checkUsernameAvailability = async (username) => {
        if (!username || username === userProfile?.username) return true;
        
        try {
            const { data, error } = await supabase.rpc('is_username_available', {
                p_username: username,
                p_exclude: user.id,
            });

            if (error) {
                console.error('Username check error:', error);
                return true; // Allow if check fails
            }

            return Boolean(data);
        } catch (error) {
            console.error('Username availability check failed:', error);
            return true; // Allow if check fails
        }
    };

    const uploadAvatar = async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, file, { upsert: true });

        if (uploadError) throw uploadError;

        // Prefer public URL if bucket is public; otherwise fall back to signed URL
        try {
            const pub = supabase.storage.from('avatars').getPublicUrl(filePath);
            if (pub?.data?.publicUrl) {
                return { path: filePath, previewUrl: pub.data.publicUrl };
            }
    } catch (e) { /* public url fetch fail */ }
        const { data, error: signedError } = await supabase.storage
            .from('avatars')
            .createSignedUrl(filePath, 60 * 60);
        if (signedError) throw signedError;
        return { path: filePath, previewUrl: data?.signedUrl || '' };
    };

    const handleAvatarChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                setErrors({ ...errors, avatar: 'File size must be less than 5MB' });
                return;
            }
            if (!file.type.startsWith('image/')) {
                setErrors({ ...errors, avatar: 'Only image files are allowed' });
                return;
            }
            setAvatarFile(file);
            const reader = new FileReader();
            reader.onload = (ev) => setAvatarPreview(ev.target.result);
            reader.readAsDataURL(file);
            const newErrors = { ...errors };
            delete newErrors.avatar;
            setErrors(newErrors);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!validateForm()) return;
        
        setLoading(true);
        
        try {
            // Check username availability
            const isUsernameAvailable = await checkUsernameAvailability(formData.username);
            if (!isUsernameAvailable) {
                setErrors({ username: 'Username is already taken' });
                setLoading(false);
                return;
            }

            let avatarUrl = formData.avatar_url;
            
            // Upload avatar if new file selected
            if (avatarFile) {
                try {
                    const uploaded = await uploadAvatar(avatarFile);
                    avatarUrl = uploaded.path; // store relative path in DB
                    if (uploaded.previewUrl) setAvatarPreview(uploaded.previewUrl);
                } catch (avatarError) {
                    console.error('Avatar upload failed:', avatarError);
                    // Continue without avatar update
                }
            }

            // Update profile
            const updateData = {
                username: formData.username.trim(),
                mobile_number: formData.mobile_number.trim(),
                avatar_url: avatarUrl,
                is_profile_complete: true
            };

            const { error } = await supabase
                .from('profiles')
                .update(updateData)
                .eq('id', user.id);

            if (error) throw error;

            // Show success toast
            toast({ title: 'Profile updated', description: 'Your profile has been saved successfully.' });

            // Refresh profile data
            await refreshUserProfile(user);
            
            onClose();
        } catch (error) {
            console.error('Profile update error:', error);
            setErrors({ submit: error.message || 'Failed to update profile' });
        } finally {
            setLoading(false);
        }
    };

    const getUserInitials = () => {
        const name = userProfile?.full_name || userProfile?.username || user?.email || '';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    return (
        <Dialog open={isOpen} onOpenChange={!isFirstTime ? onClose : undefined}>
            <DialogContent
                className="sm:max-w-md app-surface border border-white/10 bg-slate-900/60"
                overlayClassName="bg-black/60 backdrop-blur-sm"
                closeButton={!isFirstTime}
            >
                <DialogHeader>
                    <DialogTitle className="text-center heading-gradient text-2xl font-extrabold">
                        {isFirstTime ? 'Complete Your Profile' : 'Edit Profile'}
                    </DialogTitle>
                    {isFirstTime && (
                        <p className="text-sm text-white/70 text-center">
                            Please complete your profile to continue
                        </p>
                    )}
                </DialogHeader>

                <div className="subtle-divider my-2" />

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Avatar Section */}
                    <div className="flex flex-col items-center space-y-2">
                        <div className="relative">
                            <Avatar className="w-20 h-20 ring-1 ring-white/15 shadow-md">
                                <AvatarImage src={avatarPreview} />
                                <AvatarFallback className="text-lg bg-slate-800 text-white">
                                    {getUserInitials()}
                                </AvatarFallback>
                            </Avatar>
                            <label className="absolute bottom-0 right-0 bg-slate-900/80 border border-white/10 text-white p-1.5 rounded-full cursor-pointer hover:bg-slate-900/90 shadow transition-colors">
                                <Camera className="w-3 h-3" />
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleAvatarChange}
                                    className="hidden"
                                />
                            </label>
                        </div>
                        <p className="text-xs text-white/60">Click camera to change photo</p>
                        {errors.avatar && (
                            <p className="text-xs text-red-400">{errors.avatar}</p>
                        )}
                    </div>

                    {/* Username Field */}
                    <div className="space-y-2">
                        <Label htmlFor="username" className="text-white/90">
                            Username <span className="text-red-400">*</span>
                        </Label>
                        <Input
                            id="username"
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            placeholder="Enter unique username"
                            className={`bg-slate-900/60 border-white/10 text-white placeholder:text-white/50 ${errors.username ? 'border-red-500' : ''}`}
                        />
                        {errors.username && (
                            <p className="text-xs text-red-400">{errors.username}</p>
                        )}
                    </div>

                    {/* Mobile Number Field */}
                    <div className="space-y-2">
                        <Label htmlFor="mobile" className="text-white/90">
                            Mobile Number <span className="text-red-400">*</span>
                        </Label>
                        <Input
                            id="mobile"
                            type="tel"
                            value={formData.mobile_number}
                            onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })}
                            placeholder="Enter 10-digit mobile number"
                            className={`bg-slate-900/60 border-white/10 text-white placeholder:text-white/50 ${errors.mobile_number ? 'border-red-500' : ''}`}
                        />
                        {errors.mobile_number && (
                            <p className="text-xs text-red-400">{errors.mobile_number}</p>
                        )}
                    </div>

                    {/* Submit Error */}
                    {errors.submit && (
                        <p className="text-sm text-red-400 text-center">{errors.submit}</p>
                    )}

                    {/* Submit Button */}
                    <Button
                        type="submit"
                        className="w-full"
                        variant="brand"
                        size="lg"
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                {isFirstTime ? 'Completing Profile...' : 'Updating Profile...'}
                            </>
                        ) : (
                            isFirstTime ? 'Complete Profile' : 'Update Profile'
                        )}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default ProfileUpdateModal;