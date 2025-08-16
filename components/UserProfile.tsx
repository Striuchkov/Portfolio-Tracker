import React, { useState, useEffect } from 'react';
import { UserProfileData } from '../types';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { CloseIcon } from './icons/CloseIcon';

interface UserProfileProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (profileData: UserProfileData) => Promise<void>;
    userProfile: UserProfileData | null;
    isLoading: boolean;
}

const UserProfileModal: React.FC<UserProfileProps> = ({ isOpen, onClose, onSave, userProfile, isLoading }) => {
    const [estimatedEarnings, setEstimatedEarnings] = useState<string>('');

    useEffect(() => {
        if (userProfile?.estimatedEarnings) {
            setEstimatedEarnings(String(userProfile.estimatedEarnings));
        } else {
            setEstimatedEarnings('');
        }
    }, [userProfile]);

    if (!isOpen) return null;

    const handleSave = () => {
        const earnings = parseFloat(estimatedEarnings);
        onSave({
            estimatedEarnings: isNaN(earnings) || earnings < 0 ? 0 : earnings,
        });
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center" aria-modal="true" role="dialog">
            <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-md m-4 relative">
                <div className="flex justify-between items-center p-6 border-b border-gray-700">
                    <h2 className="text-xl font-bold text-white">Profile Settings</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors" aria-label="Close modal">
                        <CloseIcon className="h-6 w-6" />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label htmlFor="earnings" className="block text-sm font-medium text-gray-400">Estimated Annual Earnings (USD)</label>
                        <input
                            type="number"
                            id="earnings"
                            value={estimatedEarnings}
                            onChange={(e) => setEstimatedEarnings(e.target.value)}
                            placeholder="e.g., 80000"
                            className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm text-white px-3 py-2"
                            min="0"
                        />
                         <p className="mt-2 text-xs text-gray-400">
                            Used to estimate taxes for RRSP and Margin accounts. This data is stored securely and not shared.
                        </p>
                    </div>
                </div>
                <div className="bg-gray-700/50 px-6 py-4 flex justify-end space-x-3 rounded-b-xl">
                    <button type="button" onClick={onClose} className="py-2 px-4 border border-gray-600 rounded-md shadow-sm text-sm font-medium text-white bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-primary transition-colors">
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isLoading}
                        className="w-24 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-primary disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                    >
                        {isLoading ? <SpinnerIcon className="animate-spin h-5 w-5" /> : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UserProfileModal;
