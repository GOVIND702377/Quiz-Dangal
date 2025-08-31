import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Camera, Loader2 } from 'lucide-react';

const ProfileUpdateModal = ({ isOpen, onClose, isFirstTime = false }) => {
    const { user, userProfile, supabase, refreshUserProfile } = useAuth();
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
        if (userProfile) {
            setFormData({
                username: userProfile.username || '',
                mobile_number: userProfile.mobile_number || '',
                avatar_url: userProfile.avatar_url || ''
            });
            setAvatarPreview(userProfile.avatar_url || '');
        }
    }, [userProfile]);

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
            const { data, error } = await supabase
                .from('profiles')
                .select('id')
                .eq('username', username)
                .neq('id', user.id);
            
            if (error) {
                console.error('Username check error:', error);
                return true; // Allow if check fails
            }
            
            return !data || data.length === 0; // true if username is available
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

        const { data } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);

        return data.publicUrl;
    };

    const handleAvatarChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                setErrors({ ...errors, avatar: 'File size must be less than 5MB' });
                return;
            }
            
            setAvatarFile(file);
            const reader = new FileReader();
            reader.onload = (e) => setAvatarPreview(e.target.result);
            reader.readAsDataURL(file);
            
            // Clear avatar error
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
                    avatarUrl = await uploadAvatar(avatarFile);
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

            // Show success message
            alert('Profile updated successfully!');

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
            <DialogContent className="sm:max-w-md" closeButton={!isFirstTime}>
                <DialogHeader>
                    <DialogTitle className="text-center">
                        {isFirstTime ? 'Complete Your Profile' : 'Edit Profile'}
                    </DialogTitle>
                    {isFirstTime && (
                        <p className="text-sm text-gray-600 text-center">
                            Please complete your profile to continue
                        </p>
                    )}
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Avatar Section */}
                    <div className="flex flex-col items-center space-y-2">
                        <div className="relative">
                            <Avatar className="w-20 h-20">
                                <AvatarImage src={avatarPreview} />
                                <AvatarFallback className="text-lg">
                                    {getUserInitials()}
                                </AvatarFallback>
                            </Avatar>
                            <label className="absolute bottom-0 right-0 bg-blue-500 text-white p-1.5 rounded-full cursor-pointer hover:bg-blue-600 transition-colors">
                                <Camera className="w-3 h-3" />
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleAvatarChange}
                                    className="hidden"
                                />
                            </label>
                        </div>
                        <p className="text-xs text-gray-500">Click camera to change photo</p>
                        {errors.avatar && (
                            <p className="text-xs text-red-500">{errors.avatar}</p>
                        )}
                    </div>

                    {/* Username Field */}
                    <div className="space-y-2">
                        <Label htmlFor="username">
                            Username <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="username"
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            placeholder="Enter unique username"
                            className={errors.username ? 'border-red-500' : ''}
                        />
                        {errors.username && (
                            <p className="text-xs text-red-500">{errors.username}</p>
                        )}
                    </div>

                    {/* Mobile Number Field */}
                    <div className="space-y-2">
                        <Label htmlFor="mobile">
                            Mobile Number <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="mobile"
                            type="tel"
                            value={formData.mobile_number}
                            onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })}
                            placeholder="Enter 10-digit mobile number"
                            className={errors.mobile_number ? 'border-red-500' : ''}
                        />
                        {errors.mobile_number && (
                            <p className="text-xs text-red-500">{errors.mobile_number}</p>
                        )}
                    </div>

                    {/* Submit Error */}
                    {errors.submit && (
                        <p className="text-sm text-red-500 text-center">{errors.submit}</p>
                    )}

                    {/* Submit Button */}
                    <Button 
                        type="submit" 
                        className="w-full" 
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