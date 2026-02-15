// src/pages/Profile.tsx
import React, { useState } from 'react';
import { Input, Button, Avatar } from '../components/common';

interface ProfileProps {
  user?: {
    id: string;
    username: string;
    email: string;
    avatar?: string | null;
    bio?: string;
    joinedAt?: Date;
    chatCount?: number;
    friendCount?: number;
  };
  onUpdateProfile?: (data: any) => void;
  onUploadAvatar?: (file: File) => void;
  isLoading?: boolean;
}

const Profile: React.FC<ProfileProps> = ({
  user,
  onUpdateProfile,
  onUploadAvatar,
  isLoading = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');

  const handleSave = () => {
    onUpdateProfile?.({ username, bio });
    setIsEditing(false);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUploadAvatar?.(file);
  };

  return (
    <div className="max-w-4xl mx-auto">
      
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Profile</h1>
        <p className="text-gray-500">Manage your account and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left sidebar - Avatar & Stats */}
        <div className="space-y-6">
          
          {/* Avatar */}
          <div className="p-6 rounded-2xl bg-gray-900/60 border border-gray-800/60">
            <div className="text-center">
              <div className="relative inline-block mb-4">
                <Avatar
                  name={user?.username || 'User'}
                  src={user?.avatar}
                  size="2xl"
                  showStatus={false}
                />
                <label className="absolute bottom-0 right-0 w-10 h-10 rounded-full bg-violet-500 hover:bg-violet-400 flex items-center justify-center cursor-pointer transition-colors shadow-lg">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} />
                </label>
              </div>
              <h2 className="text-xl font-bold text-white mb-1">{user?.username}</h2>
              <p className="text-sm text-gray-500">
                Joined {user?.joinedAt ? new Date(user.joinedAt).toLocaleDateString() : 'Recently'}
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="p-6 rounded-2xl bg-gray-900/60 border border-gray-800/60">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Statistics</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Total Chats</span>
                <span className="text-lg font-bold text-white">{user?.chatCount || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Friends</span>
                <span className="text-lg font-bold text-white">{user?.friendCount || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right content - Edit form */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Account Info */}
          <div className="p-6 rounded-2xl bg-gray-900/60 border border-gray-800/60">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">Account Information</h3>
              {!isEditing && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  Edit Profile
                </Button>
              )}
            </div>

            <div className="space-y-4">
              <Input
                label="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={!isEditing}
              />
              
              <Input
                label="Email"
                value={user?.email || ''}
                disabled
                hint="Email cannot be changed"
              />
              
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Bio
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  disabled={!isEditing}
                  placeholder="Tell others about yourself..."
                  rows={4}
                  className="w-full bg-gray-800/60 border border-gray-700/40 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-violet-500/50 disabled:opacity-60 disabled:cursor-not-allowed resize-none"
                />
              </div>

              {isEditing && (
                <div className="flex gap-3 pt-2">
                  <Button
                    variant="primary"
                    onClick={handleSave}
                    loading={isLoading}
                  >
                    Save Changes
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setUsername(user?.username || '');
                      setBio(user?.bio || '');
                      setIsEditing(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Privacy & Safety */}
          <div className="p-6 rounded-2xl bg-gray-900/60 border border-gray-800/60">
            <h3 className="text-lg font-bold text-white mb-4">Privacy & Safety</h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-gray-400">Show online status</span>
                <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-gray-700 bg-gray-800 text-violet-500" />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-gray-400">Allow friend requests</span>
                <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-gray-700 bg-gray-800 text-violet-500" />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-gray-400">Show in random matching</span>
                <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-gray-700 bg-gray-800 text-violet-500" />
              </label>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="p-6 rounded-2xl bg-red-500/5 border border-red-500/20">
            <h3 className="text-lg font-bold text-red-400 mb-4">Danger Zone</h3>
            <Button variant="danger" size="sm">
              Delete Account
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
