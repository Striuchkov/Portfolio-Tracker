import React, { useState } from 'react';
import { auth, googleProvider, facebookProvider } from '../services/firebase';
import { signInWithPopup, createUserWithEmailAndPassword, updateProfile, signInWithEmailAndPassword } from 'firebase/auth';
import { ChartPieIcon } from './icons/ChartPieIcon';
import { GoogleIcon } from './icons/GoogleIcon';
import { MetaIcon } from './icons/MetaIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';

const Login: React.FC = () => {
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAuthAction = async (action: Promise<any>) => {
        setIsLoading(true);
        setError(null);
        try {
            await action;
        } catch (err: any) {
            console.error("Auth Error:", err);
            let message = "Failed to authenticate. Please try again.";
            if (err.code) {
                switch (err.code) {
                    case 'auth/user-not-found':
                    case 'auth/wrong-password':
                        message = 'Invalid email or password.';
                        break;
                    case 'auth/email-already-in-use':
                        message = 'An account already exists with this email address.';
                        break;
                    case 'auth/weak-password':
                        message = 'Password should be at least 6 characters.';
                        break;
                    case 'auth/account-exists-with-different-credential':
                        message = 'An account already exists with this email. Try signing in with the original method.';
                        break;
                    default:
                        message = err.message;
                }
            }
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSignIn = () => {
        handleAuthAction(signInWithPopup(auth, googleProvider));
    };
    
    const handleMetaSignIn = () => {
        handleAuthAction(signInWithPopup(auth, facebookProvider));
    };

    const handleEmailPasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSignUp) {
            if (!displayName.trim()) {
                setError("Display name is required for sign up.");
                return;
            }
            const signUpAction = createUserWithEmailAndPassword(auth, email, password)
                .then(userCredential => {
                    if (userCredential.user) {
                        return updateProfile(userCredential.user, { displayName });
                    }
                });
            handleAuthAction(signUpAction);
        } else {
            handleAuthAction(signInWithEmailAndPassword(auth, email, password));
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md mx-auto text-center">
                <div className="flex items-center justify-center mb-6">
                    <ChartPieIcon className="h-12 w-12 text-primary" />
                    <h1 className="text-4xl font-bold ml-4 tracking-tight text-white">
                        Gemini Portfolio Tracker
                    </h1>
                </div>
                <p className="text-gray-400 mb-8">
                    {isSignUp ? "Create an account to track your portfolio." : "Sign in to track your stock and ETF portfolio in real-time."}
                </p>

                <div className="bg-gray-800 p-8 rounded-xl shadow-2xl">
                    <form onSubmit={handleEmailPasswordSubmit} className="space-y-4">
                        {isSignUp && (
                             <div>
                                <label htmlFor="displayName" className="sr-only">Display Name</label>
                                <input
                                    id="displayName"
                                    name="displayName"
                                    type="text"
                                    autoComplete="name"
                                    required
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    className="block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm text-white px-3 py-2"
                                    placeholder="Display Name"
                                    disabled={isLoading}
                                />
                            </div>
                        )}
                        <div>
                             <label htmlFor="email-address" className="sr-only">Email address</label>
                             <input
                                id="email-address"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm text-white px-3 py-2"
                                placeholder="Email address"
                                disabled={isLoading}
                            />
                        </div>
                         <div>
                            <label htmlFor="password" className="sr-only">Password</label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete={isSignUp ? "new-password" : "current-password"}
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm text-white px-3 py-2"
                                placeholder="Password"
                                disabled={isLoading}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-primary disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                        >
                             {isLoading ? <SpinnerIcon className="animate-spin h-5 w-5" /> : (isSignUp ? 'Create Account' : 'Sign In')}
                        </button>
                    </form>

                     <div className="mt-4 text-sm text-center">
                        <button onClick={() => { setIsSignUp(!isSignUp); setError(null); }} className="font-medium text-indigo-400 hover:text-indigo-300">
                            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                        </button>
                    </div>

                    <div className="mt-6">
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-600" />
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-gray-800 text-gray-400">OR</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="mt-6 grid grid-cols-1 gap-3">
                         <button
                            onClick={handleGoogleSignIn}
                            disabled={isLoading}
                            className="w-full flex items-center justify-center px-4 py-3 border border-gray-600 text-base font-medium rounded-md text-white bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-primary disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                        >
                            <GoogleIcon className="h-6 w-6 mr-3" />
                            Continue with Google
                        </button>
                         <button
                            onClick={handleMetaSignIn}
                            disabled={isLoading}
                            className="w-full flex items-center justify-center px-4 py-3 border border-gray-600 text-base font-medium rounded-md text-white bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-primary disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                        >
                            <MetaIcon className="h-6 w-6 mr-3" />
                            Continue with Meta
                        </button>
                    </div>

                    {error && <p className="mt-4 text-sm text-negative text-center">{error}</p>}
                </div>

                <footer className="text-center mt-12 text-gray-400 text-sm">
                    <p>Securely powered by Google, Meta, and Firebase Authentication.</p>
                </footer>
            </div>
        </div>
    );
};

export default Login;