import React, { useState } from 'react';
import { ChartPieIcon } from './icons/ChartPieIcon';
import { User } from '../types';
import { auth } from '../services/firebase';
import { signOut } from 'firebase/auth';
import { CogIcon } from './icons/CogIcon';
import { LogoutIcon } from './icons/LogoutIcon';

interface HeaderProps {
    user: User | null;
    onOpenProfile: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onOpenProfile }) => {
    const [dropdownOpen, setDropdownOpen] = useState(false);

    const handleSignOut = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Error signing out: ", error);
        }
    };

    return (
        <header className="bg-gray-800/80 backdrop-blur-sm shadow-lg sticky top-0 z-10">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center">
                        <ChartPieIcon className="h-8 w-8 text-primary" />
                        <h1 className="text-2xl font-bold ml-3 tracking-tight text-white">
                            Mave Portfolio Tracker
                        </h1>
                    </div>
                    {user && (
                        <div className="relative">
                            <button
                                onClick={() => setDropdownOpen(!dropdownOpen)}
                                onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
                                className="flex items-center space-x-2 focus:outline-none rounded-full focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-primary"
                                aria-label="User menu"
                                aria-haspopup="true"
                                aria-expanded={dropdownOpen}
                            >
                                <img
                                    className="h-9 w-9 rounded-full"
                                    src={user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}&background=4F46E5&color=fff`}
                                    alt="User avatar"
                                />
                            </button>
                            {dropdownOpen && (
                                <div
                                    className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-gray-700 ring-1 ring-black ring-opacity-5 focus:outline-none"
                                    role="menu"
                                    aria-orientation="vertical"
                                    aria-labelledby="user-menu-button"
                                >
                                    <div className="px-4 py-3 border-b border-gray-600">
                                        <p className="text-sm font-medium text-white truncate">{user.displayName}</p>
                                        <p className="text-sm text-gray-400 truncate">{user.email}</p>
                                    </div>
                                    <div className="py-1">
                                        <button
                                            onClick={() => { onOpenProfile(); setDropdownOpen(false); }}
                                            className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-gray-600 hover:text-white transition-colors"
                                            role="menuitem"
                                        >
                                            <CogIcon className="h-5 w-5 mr-3 text-gray-400" />
                                            Profile Settings
                                        </button>
                                    </div>
                                    <div className="py-1 border-t border-gray-600">
                                        <button
                                            onClick={handleSignOut}
                                            className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-gray-600 hover:text-white transition-colors"
                                            role="menuitem"
                                        >
                                            <LogoutIcon className="h-5 w-5 mr-3 text-gray-400" />
                                            Sign Out
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;