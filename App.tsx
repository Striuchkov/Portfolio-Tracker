import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { auth, db } from './services/firebase';
import * as firebaseAuth from 'firebase/auth';
import { collection, doc, onSnapshot, setDoc, deleteDoc, updateDoc, query, addDoc, where } from 'firebase/firestore';

import Header from './components/Header';
import AccountManager from './components/AccountManager';
import UserProfileModal from './components/UserProfile';
import AddAssetForm from './components/AddAssetForm';
import PortfolioSummary from './components/PortfolioSummary';
import AssetList from './components/AssetList';
import Login from './components/Login';
import { SpinnerIcon } from './components/icons/SpinnerIcon';

import { Asset, PortfolioSummaryData, Exchange, Account, AccountType, UserProfileData, AssetType, Currency, StockAsset, CashAsset } from './types';
import { fetchAssetData, fetchCadToUsdRate } from './services/geminiService';

const App: React.FC = () => {
    const [user, setUser] = useState<firebaseAuth.User | null>(null);
    const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
    const [portfolio, setPortfolio] = useState<Asset[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [userProfile, setUserProfile] = useState<UserProfileData | null>(null);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [cadToUsdRate, setCadToUsdRate] = useState<number | null>(null);

    useEffect(() => {
        const unsubscribe = firebaseAuth.onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setIsAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!user) {
            setPortfolio([]);
            setAccounts([]);
            setUserProfile(null);
            setCadToUsdRate(null);
            return;
        }

        const getRate = async () => {
            const rate = await fetchCadToUsdRate();
             if (rate) {
                setCadToUsdRate(rate);
            } else {
                console.warn("Could not fetch CAD to USD exchange rate. Using 1 as a fallback.");
                setCadToUsdRate(1); 
            }
        };
        getRate();

        const portfolioCollectionRef = collection(db, 'users', user.uid, 'portfolio');
        const qPortfolio = query(portfolioCollectionRef);
        const unsubscribePortfolio = onSnapshot(qPortfolio, (querySnapshot) => {
            const assets = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Asset));
            setPortfolio(assets);
        }, (err) => {
            console.error("Error listening to portfolio:", err);
            setError("Could not load portfolio from the cloud.");
        });
        
        const accountsCollectionRef = collection(db, 'users', user.uid, 'accounts');
        const qAccounts = query(accountsCollectionRef);
        const unsubscribeAccounts = onSnapshot(qAccounts, (querySnapshot) => {
            const accs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
            setAccounts(accs.sort((a, b) => a.name.localeCompare(b.name)));
        }, (err) => {
            console.error("Error listening to accounts:", err);
            setError("Could not load accounts from the cloud.");
        });

        const userDocRef = doc(db, 'users', user.uid);
        const unsubscribeProfile = onSnapshot(userDocRef, (doc) => {
            setUserProfile(doc.exists() ? doc.data() as UserProfileData : {});
        }, (err) => {
             console.error("Error listening to user profile:", err);
             setError("Could not load user profile from the cloud.");
        });

        return () => {
            unsubscribePortfolio();
            unsubscribeAccounts();
            unsubscribeProfile();
        };
    }, [user]);

    const createAccount = useCallback(async (name: string, type: AccountType) => {
        if (!user) return;
        setIsSubmitting(true);
        setError(null);
        try {
            const accountsCollectionRef = collection(db, 'users', user.uid, 'accounts');
            await addDoc(accountsCollectionRef, { name, type });
        } catch (err) {
            console.error("Error creating account:", err);
            setError("Failed to create account.");
        } finally {
            setIsSubmitting(false);
        }
    }, [user]);

    const updateUserProfile = useCallback(async (profileData: UserProfileData) => {
        if (!user) return;
        setIsSubmitting(true);
        setError(null);
        try {
            const userDocRef = doc(db, 'users', user.uid);
            await setDoc(userDocRef, profileData, { merge: true });
            setIsProfileModalOpen(false);
        } catch (err) {
            console.error("Error updating profile:", err);
            setError("Failed to update profile.");
        } finally {
            setIsSubmitting(false);
        }
    }, [user]);

    const addAsset = useCallback(async (query: string, shares: number, avgCost: number, exchange: Exchange, accountId: string) => {
        if (!user) {
            setError("You must be logged in to add an asset.");
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const data = await fetchAssetData(query, exchange);
            if (!data || !data.ticker) {
                throw new Error(`Could not fetch data for "${query}". Please check the company name/ticker and exchange.`);
            }

            const ticker = data.ticker.toUpperCase();
            const existingAsset = portfolio.find(asset => 
                asset.type === AssetType.Stock &&
                asset.ticker === ticker && 
                asset.exchange === exchange &&
                asset.accountId === accountId
            );

            if (existingAsset) {
                throw new Error(`Asset ${ticker} on ${exchange} is already in this account.`);
            }
            
            const newAsset: Omit<StockAsset, 'id'> = {
                type: AssetType.Stock,
                accountId,
                ticker,
                name: data.name,
                shares,
                avgCost,
                exchange,
                currentPrice: data.price,
                yearlyDividend: data.yearlyDividend,
                peRatio: data.peRatio,
                forwardPeRatio: data.forwardPeRatio,
                fiftyTwoWeekLow: data.fiftyTwoWeekLow,
                fiftyTwoWeekHigh: data.fiftyTwoWeekHigh,
            };

            const portfolioCollectionRef = collection(db, 'users', user.uid, 'portfolio');
            await addDoc(portfolioCollectionRef, newAsset);

        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('An unknown error occurred.');
            }
        } finally {
            setIsLoading(false);
        }
    }, [user, portfolio]);

    const addCash = useCallback(async (accountId: string, amount: number, currency: Currency) => {
        if (!user) return;
        setIsSubmitting(true);
        setError(null);
        try {
            const existingCashAsset = portfolio.find(asset =>
                asset.type === AssetType.Cash &&
                asset.accountId === accountId &&
                asset.currency === currency
            ) as CashAsset | undefined;

            if (existingCashAsset) {
                const assetDocRef = doc(db, 'users', user.uid, 'portfolio', existingCashAsset.id);
                await updateDoc(assetDocRef, {
                    amount: existingCashAsset.amount + amount
                });
            } else {
                const newCashAsset: Omit<CashAsset, 'id'> = {
                    accountId,
                    type: AssetType.Cash,
                    amount,
                    currency,
                    name: currency === Currency.USD ? 'US Dollars' : 'Canadian Dollars'
                };
                const portfolioCollectionRef = collection(db, 'users', user.uid, 'portfolio');
                await addDoc(portfolioCollectionRef, newCashAsset);
            }
        } catch (err) {
            console.error("Error adding cash:", err);
            setError("Failed to add cash balance.");
        } finally {
            setIsSubmitting(false);
        }
    }, [user, portfolio]);

    const removeAsset = useCallback(async (id: string) => {
        if (!user) return;
        try {
            const assetDocRef = doc(db, 'users', user.uid, 'portfolio', id);
            await deleteDoc(assetDocRef);
        } catch (err) {
            console.error("Error removing asset:", err);
            setError("Failed to remove asset.");
        }
    }, [user]);
    
    const refreshAsset = useCallback(async (asset: Asset) => {
        if (!user || asset.type !== AssetType.Stock) return;
        setIsLoading(true);
        setError(null);
        try {
            const data = await fetchAssetData(asset.ticker, asset.exchange);
            if (!data) {
                throw new Error(`Could not refresh data for ${asset.ticker}.`);
            }
            
            const assetDocRef = doc(db, 'users', user.uid, 'portfolio', asset.id);
            await updateDoc(assetDocRef, {
                currentPrice: data.price,
                yearlyDividend: data.yearlyDividend,
                peRatio: data.peRatio,
                forwardPeRatio: data.forwardPeRatio,
                fiftyTwoWeekLow: data.fiftyTwoWeekLow,
                fiftyTwoWeekHigh: data.fiftyTwoWeekHigh,
            });

        } catch (err: unknown) {
             if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('An unknown error occurred while refreshing.');
            }
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    const calculateSummary = useCallback((assets: Asset[], rate: number | null): PortfolioSummaryData => {
        const summary: PortfolioSummaryData = {
            totalMarketValue: 0,
            totalCost: 0,
            totalGainLoss: 0,
            dayGainLoss: 0, 
            overallReturn: 0,
        };
        const conversionRate = rate ?? 1;

        assets.forEach(asset => {
            if (asset.type === AssetType.Stock) {
                const rate = asset.exchange === Exchange.CANADA ? conversionRate : 1;
                const marketValue = asset.shares * asset.currentPrice * rate;
                const totalCost = asset.shares * asset.avgCost * rate;
                summary.totalMarketValue += marketValue;
                summary.totalCost += totalCost;
            } else { // CashAsset
                const rate = asset.currency === Currency.CAD ? conversionRate : 1;
                const value = asset.amount * rate;
                summary.totalMarketValue += value;
                summary.totalCost += value;
            }
        });

        summary.totalGainLoss = summary.totalMarketValue - summary.totalCost;
        summary.overallReturn = summary.totalCost === 0 ? 0 : (summary.totalGainLoss / summary.totalCost) * 100;
        return summary;
    }, []);

    const totalPortfolioSummary: PortfolioSummaryData = useMemo(() => calculateSummary(portfolio, cadToUsdRate), [portfolio, cadToUsdRate, calculateSummary]);

    if (isAuthLoading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <SpinnerIcon className="animate-spin h-10 w-10 text-primary" />
            </div>
        );
    }

    if (!user) {
        return <Login />;
    }

    return (
        <div className="min-h-screen bg-gray-900 text-gray-200 font-sans">
            <UserProfileModal 
                isOpen={isProfileModalOpen}
                onClose={() => setIsProfileModalOpen(false)}
                onSave={updateUserProfile}
                userProfile={userProfile}
                isLoading={isSubmitting}
            />
            <Header user={user} onOpenProfile={() => setIsProfileModalOpen(true)} />
            <main className="container mx-auto p-4 md:p-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1">
                        <AccountManager accounts={accounts} createAccount={createAccount} isLoading={isSubmitting} />
                        <AddAssetForm 
                            addAsset={addAsset} 
                            addCash={addCash}
                            isLoading={isLoading || isSubmitting} 
                            accounts={accounts} 
                        />
                        {error && (
                            <div className="mt-4 bg-negative/20 border border-negative text-negative px-4 py-3 rounded-lg relative" role="alert">
                                <strong className="font-bold">Error: </strong>
                                <span className="block sm:inline">{error}</span>
                            </div>
                        )}
                    </div>
                    <div className="lg:col-span-2">
                        <PortfolioSummary summary={totalPortfolioSummary} />
                        <div className="mt-8 space-y-8">
                            {accounts.map(account => {
                                const accountAssets = portfolio.filter(asset => asset.accountId === account.id);
                                const accountSummary = calculateSummary(accountAssets, cadToUsdRate);

                                return (
                                    <div key={account.id} className="bg-gray-800 p-6 rounded-xl shadow-2xl">
                                        <div className="flex justify-between items-center mb-4">
                                            <h2 className="text-2xl font-bold text-white">{account.name}</h2>
                                            <span className="text-sm font-medium text-primary bg-primary/20 rounded-full px-3 py-1">{account.type}</span>
                                        </div>
                                        <PortfolioSummary summary={accountSummary} />
                                        <div className="mt-6">
                                            <AssetList assets={accountAssets} removeAsset={removeAsset} refreshAsset={refreshAsset} />
                                        </div>
                                    </div>
                                );
                            })}
                            {accounts.length === 0 && (
                                <div className="mt-8 bg-gray-800 p-8 rounded-xl text-center shadow-inner">
                                    <h3 className="text-lg font-semibold text-white">No Accounts Found</h3>
                                    <p className="text-gray-400 mt-2">Create an account on the left to start adding assets.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                 <footer className="text-center mt-12 text-gray-400 text-sm">
                    <p>Data provided by Gemini API. Not financial advice.</p>
                    <p>Market data may be delayed.</p>
                </footer>
            </main>
        </div>
    );
};

export default App;