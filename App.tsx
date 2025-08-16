import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { auth, db } from './services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, onSnapshot, setDoc, deleteDoc, updateDoc, query, addDoc, where, writeBatch } from 'firebase/firestore';

import Header from './components/Header';
import AccountManager from './components/AccountManager';
import UserProfileModal from './components/UserProfile';
import AddAssetForm from './components/AddAssetForm';
import PortfolioSummary from './components/PortfolioSummary';
import AssetList from './components/AssetList';
import Login from './components/Login';
import TickerPage from './components/TickerPage';
import { SpinnerIcon } from './components/icons/SpinnerIcon';

import { User, Asset, PortfolioSummaryData, Exchange, Account, AccountType, UserProfileData, AssetType, Currency, StockAsset, CashAsset } from './types';
import { isApiKeyConfigured, fetchFullStockData, fetchCadToUsdRate, fetchBatchPrices, fetchStockDetailsForUpdate } from './services/geminiService';

const WarningIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
);

const App: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
    const [portfolio, setPortfolio] = useState<Asset[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [userProfile, setUserProfile] = useState<UserProfileData | null>(null);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [cadToUsdRate, setCadToUsdRate] = useState<number | null>(null);
    const [route, setRoute] = useState(window.location.hash);
    const portfolioLoaded = useRef(false);

    useEffect(() => {
        const handleHashChange = () => {
            setRoute(window.location.hash);
        };
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    useEffect(() => {
        if (!isApiKeyConfigured) return;
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setIsAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const refreshAssetDetails = useCallback(async (asset: Asset) => {
        if (!user || asset.type !== AssetType.Stock) return;
        setIsLoading(true);
        setError(null);
        try {
            const details = await fetchStockDetailsForUpdate(asset.ticker, asset.exchange);
            if (!details) {
                throw new Error(`Could not refresh details for ${asset.ticker}.`);
            }
            const assetDocRef = doc(db, 'users', user.uid, 'portfolio', asset.id);
            await updateDoc(assetDocRef, {
                ...details,
                lastMetricsUpdate: Date.now(),
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

    const checkAndRefreshDetails = useCallback(async (assets: StockAsset[]) => {
        const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
        const assetsToUpdate = assets.filter(asset => !asset.lastMetricsUpdate || asset.lastMetricsUpdate < twentyFourHoursAgo);

        if (assetsToUpdate.length > 0) {
            console.log(`Found ${assetsToUpdate.length} assets with stale details. Updating in background...`);
            for (const asset of assetsToUpdate) {
                try {
                    await refreshAssetDetails(asset);
                } catch (e) {
                    console.error(`Failed to background-refresh details for ${asset.ticker}`, e);
                }
                await new Promise(resolve => setTimeout(resolve, 1000)); // Stagger API calls
            }
            console.log("Background detail update complete.");
        }
    }, [user, refreshAssetDetails]);
    
    useEffect(() => {
        if (!user || !isApiKeyConfigured) {
            setPortfolio([]);
            setAccounts([]);
            setUserProfile(null);
            setCadToUsdRate(null);
            portfolioLoaded.current = false;
            if (!isApiKeyConfigured) setIsAuthLoading(false);
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
             if (!portfolioLoaded.current && assets.length > 0) {
                const stockAssets = assets.filter(a => a.type === AssetType.Stock) as StockAsset[];
                if (stockAssets.length > 0) {
                    checkAndRefreshDetails(stockAssets);
                }
                portfolioLoaded.current = true;
            }
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
    }, [user, checkAndRefreshDetails]);

    // Effect for periodic price updates
    useEffect(() => {
        if (!user || portfolio.length === 0) {
            return;
        }

        const stockAssets = portfolio.filter(asset => asset.type === AssetType.Stock) as StockAsset[];
        if (stockAssets.length === 0) return;

        const intervalId = setInterval(async () => {
            console.log("Fetching batch price updates...");
            try {
                const priceUpdates = await fetchBatchPrices(stockAssets);
                if (priceUpdates && priceUpdates.length > 0) {
                    const batch = writeBatch(db);
                    priceUpdates.forEach(update => {
                        const assetToUpdate = stockAssets.find(a => a.ticker === update.ticker && a.exchange === update.exchange);
                        if (assetToUpdate) {
                            const docRef = doc(db, 'users', user.uid, 'portfolio', assetToUpdate.id);
                            batch.update(docRef, {
                                currentPrice: update.price,
                                lastPriceUpdate: Date.now(),
                            });
                        }
                    });
                    await batch.commit();
                    console.log(`Successfully updated prices for ${priceUpdates.length} assets.`);
                }
            } catch (e) {
                console.error("Failed to batch update prices:", e);
            }
        }, 60000); // 1 minute

        return () => clearInterval(intervalId);
    }, [user, portfolio]);


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
            const data = await fetchFullStockData(query, exchange);
            if (!data || !data.ticker || !data.currentPrice) {
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
                name: data.name ?? 'Unknown Name',
                shares,
                avgCost,
                exchange,
                currentPrice: data.currentPrice,
                yearlyDividend: data.yearlyDividend ?? null,
                peRatio: data.peRatio ?? null,
                forwardPeRatio: data.forwardPeRatio ?? null,
                fiftyTwoWeekLow: data.fiftyTwoWeekLow ?? null,
                fiftyTwoWeekHigh: data.fiftyTwoWeekHigh ?? null,
                companyProfile: data.companyProfile ?? 'No profile available.',
                marketCap: data.marketCap ?? null,
                dividendYield: data.dividendYield ?? null,
                priceHistory: data.priceHistory ?? [],
                lastPriceUpdate: Date.now(),
                lastMetricsUpdate: Date.now(),
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

    const renderContent = () => {
        if (route.startsWith('#/ticker/')) {
            const [, , ticker, exchange] = route.split('/');
            if (ticker && exchange) {
                // Decode URI components in case ticker contains special characters
                return <TickerPage ticker={decodeURIComponent(ticker)} exchange={decodeURIComponent(exchange) as Exchange} />;
            }
        }

        // Default to portfolio view
        return (
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
                                            <AssetList assets={accountAssets} removeAsset={removeAsset} refreshAssetDetails={refreshAssetDetails} />
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
        );
    };

    if (!isApiKeyConfigured) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
                <div className="bg-gray-800 border border-negative rounded-xl shadow-2xl w-full max-w-lg text-center p-8">
                    <WarningIcon className="h-16 w-16 text-negative mx-auto" />
                    <h1 className="mt-4 text-2xl font-bold text-white">Configuration Error</h1>
                    <p className="mt-2 text-gray-400">
                        The Gemini API key has not been configured. Please ensure the API key is correctly set up in the application's environment for the portfolio tracker to function.
                    </p>
                </div>
            </div>
        );
    }

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
            {renderContent()}
        </div>
    );
};

export default App;