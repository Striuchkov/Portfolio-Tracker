import React, { useState, useEffect, useMemo } from 'react';
import { Exchange, TickerDetails, TickerNews, StockAsset, TickerPriceHistory } from '../types';
import { fetchTickerDetails, fetchTickerNews, generatePriceChartSvg } from '../services/geminiService';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { formatCurrency, formatPercentage } from '../utils/formatting';
import { auth, db } from '../services/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

interface TickerPageProps {
    ticker: string;
    exchange: Exchange;
}

const DataPoint: React.FC<{ label: string; value: string | number | null | undefined, format?: (val: number) => string }> = ({ label, value, format }) => {
    const displayValue = value === null || value === undefined || (typeof value === 'number' && isNaN(value)) ? 'N/A' : (format ? format(value as number) : value);
    return (
        <div className="bg-gray-800 p-4 rounded-lg">
            <div className="text-sm text-gray-400">{label}</div>
            <div className="text-white font-semibold mt-1 text-lg">{displayValue}</div>
        </div>
    );
};

const TickerPage: React.FC<TickerPageProps> = ({ ticker, exchange }) => {
    const [asset, setAsset] = useState<StockAsset | null>(null);
    const [details, setDetails] = useState<TickerDetails | null>(null);
    const [isPortfolioAsset, setIsPortfolioAsset] = useState<boolean>(false);
    const [chartSvg, setChartSvg] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const [news, setNews] = useState<TickerNews[] | null>(null);
    const [isNewsLoading, setIsNewsLoading] = useState<boolean>(false);
    const [newsError, setNewsError] = useState<string | null>(null);

    const loadLiveTickerData = async () => {
        try {
            const fetchedDetails = await fetchTickerDetails(ticker, exchange);
            if (fetchedDetails) {
                setDetails(fetchedDetails);
            } else {
                throw new Error("No data returned from the API.");
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        setAsset(null);
        setDetails(null);
        setChartSvg(null);
        setIsLoading(true);
        setError(null);
        setNews(null);
        setNewsError(null);

        const currentUser = auth.currentUser;
        if (!currentUser) {
            loadLiveTickerData();
            return;
        }

        const q = query(collection(db, 'users', currentUser.uid, 'portfolio'), where('ticker', '==', ticker), where('exchange', '==', exchange));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                setIsPortfolioAsset(true);
                const assetData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as StockAsset;
                setAsset(assetData);
                setIsLoading(false);
            } else {
                setIsPortfolioAsset(false);
                loadLiveTickerData();
            }
        }, (err) => {
            console.error("Firestore snapshot error:", err);
            setError("Failed to check portfolio status.");
            loadLiveTickerData(); // Fallback to live data on error
        });

        return () => unsubscribe();
    }, [ticker, exchange]);

    useEffect(() => {
        const sourceData = isPortfolioAsset ? asset : details;
        if (sourceData && sourceData.priceHistory && sourceData.currentPrice) {
            const history = sourceData.priceHistory as TickerPriceHistory[];
            const liveHistory = [...history];
            const today = new Date().toISOString().split('T')[0];
            
            if (liveHistory.length > 0) {
                const lastPoint = liveHistory[liveHistory.length - 1];
                if (lastPoint.date === today) {
                    lastPoint.close = sourceData.currentPrice;
                } else {
                    liveHistory.push({ date: today, close: sourceData.currentPrice });
                }
            } else {
                 liveHistory.push({ date: today, close: sourceData.currentPrice });
            }

            generatePriceChartSvg(liveHistory, ticker).then(setChartSvg);
        }
    }, [asset, details, isPortfolioAsset, ticker]);

    const displayData = useMemo<TickerDetails | null>(() => {
        if (isPortfolioAsset && asset) {
            return {
                name: asset.name,
                companyProfile: asset.companyProfile,
                marketCap: asset.marketCap,
                peRatio: asset.peRatio,
                dividendYield: asset.dividendYield,
                fiftyTwoWeekLow: asset.fiftyTwoWeekLow,
                fiftyTwoWeekHigh: asset.fiftyTwoWeekHigh,
                priceHistory: asset.priceHistory ?? [],
                dayChange: null, // Not tracked in real-time for portfolio assets to simplify
                dayChangePercent: null,
                currentPrice: asset.currentPrice,
            };
        }
        if (!isPortfolioAsset && details) {
            return details;
        }
        return null;
    }, [isPortfolioAsset, asset, details]);

    const handleLoadNews = async () => {
        setIsNewsLoading(true);
        setNewsError(null);
        try {
            const fetchedNews = await fetchTickerNews(ticker, exchange);
            setNews(fetchedNews ?? []);
        } catch (err: unknown) {
            setNewsError(err instanceof Error ? err.message : "Failed to load news.");
        } finally {
            setIsNewsLoading(false);
        }
    };
    
    const dayChangeColor = useMemo(() => {
        if (!displayData || displayData.dayChange === null) return 'text-gray-400';
        return displayData.dayChange >= 0 ? 'text-positive' : 'text-negative';
    }, [displayData]);


    if (isLoading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
                <SpinnerIcon className="animate-spin h-12 w-12 text-primary" />
                <p className="mt-4 text-lg">Fetching latest data for {ticker}...</p>
            </div>
        );
    }
    
    if (error) {
         return (
            <div className="container mx-auto p-4 md:p-8 text-center">
                 <a href="/#" className="inline-flex items-center gap-2 text-primary hover:underline mb-8">
                    <ArrowLeftIcon className="h-5 w-5" />
                    Back to Portfolio
                </a>
                <div className="bg-gray-800 p-8 rounded-xl max-w-2xl mx-auto">
                    <h2 className="text-2xl font-bold text-negative mb-2">Failed to load data</h2>
                    <p className="text-gray-400">{error}</p>
                </div>
            </div>
        );
    }

    if (!displayData) {
         return (
             <div className="container mx-auto p-4 md:p-8 text-center">
                <a href="/#" className="inline-flex items-center gap-2 text-primary hover:underline mb-8">
                    <ArrowLeftIcon className="h-5 w-5" />
                    Back to Portfolio
                </a>
                <div className="bg-gray-800 p-8 rounded-xl max-w-2xl mx-auto">
                    <h2 className="text-2xl font-bold text-white mb-2">No data available</h2>
                    <p className="text-gray-400">Could not find any details for {ticker} on {exchange}.</p>
                </div>
            </div>
        );
    }

    return (
        <main className="container mx-auto p-4 md:p-8 animate-fade-in">
            <div className="mb-8">
                <a href="/#" className="inline-flex items-center gap-2 text-primary hover:underline transition-colors">
                    <ArrowLeftIcon className="h-5 w-5" />
                    Back to Portfolio
                </a>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Header */}
                     <div className="bg-gray-800/50 p-6 rounded-xl">
                        <h1 className="text-3xl md:text-4xl font-bold text-white">{displayData.name}</h1>
                        <p className="text-lg text-gray-400 mt-1">{ticker} &middot; {exchange}</p>
                        <div className="flex items-end gap-4 mt-4">
                            <p className="text-4xl md:text-5xl font-bold text-white">{formatCurrency(displayData.currentPrice)}</p>
                            {displayData.dayChange !== null && (
                                <div className={`text-xl font-semibold ${dayChangeColor}`}>
                                   <span>{displayData.dayChange > 0 ? '+' : ''}{formatCurrency(displayData.dayChange)}</span>
                                   <span className="ml-2">({displayData.dayChangePercent !== null && displayData.dayChangePercent > 0 ? '+' : ''}{formatPercentage(displayData.dayChangePercent ?? 0)})</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Chart */}
                    <div className="bg-gray-800 p-6 rounded-xl">
                        <h2 className="text-xl font-bold text-white mb-4">Price History (1Y)</h2>
                        <div className="h-[300px] flex items-center justify-center">
                            {chartSvg ? (
                                <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: chartSvg }} />
                            ) : (
                                <div className="text-center">
                                    <SpinnerIcon className="animate-spin h-8 w-8 text-primary mx-auto" />
                                    <p className="text-gray-400 mt-2">Generating price chart...</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Profile */}
                     <div className="bg-gray-800 p-6 rounded-xl">
                         <h2 className="text-xl font-bold text-white mb-4">Company Profile</h2>
                         <p className="text-gray-300 leading-relaxed">{displayData.companyProfile}</p>
                     </div>
                </div>

                {/* Right Column */}
                <div className="lg:col-span-1 space-y-8">
                     {/* Key Metrics */}
                     <div className="bg-gray-800/50 p-6 rounded-xl space-y-4">
                        <h2 className="text-xl font-bold text-white mb-2">Key Metrics</h2>
                        <DataPoint label="Market Cap" value={displayData.marketCap} />
                        <DataPoint label="P/E Ratio" value={displayData.peRatio} />
                        <DataPoint label="Dividend Yield" value={displayData.dividendYield} format={formatPercentage} />
                        <DataPoint label="52-Week High" value={displayData.fiftyTwoWeekHigh} format={formatCurrency} />
                        <DataPoint label="52-Week Low" value={displayData.fiftyTwoWeekLow} format={formatCurrency} />
                    </div>
                    {/* News */}
                    <div className="bg-gray-800 p-6 rounded-xl">
                        <h2 className="text-xl font-bold text-white mb-4">Recent News</h2>
                        {!news && !isNewsLoading && !newsError && (
                            <button
                                onClick={handleLoadNews}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-primary disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                            >
                                Load Recent News
                            </button>
                        )}
                        {isNewsLoading && (
                            <div className="text-center py-4">
                                <SpinnerIcon className="animate-spin h-8 w-8 text-primary mx-auto" />
                                <p className="text-gray-400 mt-2">Fetching news...</p>
                            </div>
                        )}
                        {newsError && (
                            <div className="text-center py-4 text-negative">
                                <p>{newsError}</p>
                                <button onClick={handleLoadNews} className="mt-2 text-sm text-primary hover:underline">Try again</button>
                            </div>
                        )}
                        {news && (
                             <ul className="space-y-4">
                                {news.length > 0 ? news.map((item, index) => (
                                    <li key={index} className="border-b border-gray-700 pb-4 last:border-b-0 last:pb-0">
                                        <a href={item.url ?? '#'} target="_blank" rel="noopener noreferrer" className="font-semibold text-white hover:text-primary transition-colors block">
                                            {item.title}
                                        </a>
                                        <div className="text-xs text-gray-400 mt-1">
                                            <span>{item.source} &middot; {item.publishedAt}</span>
                                        </div>
                                    </li>
                                )) : <p className="text-gray-400">No recent news found.</p>}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
};

export default TickerPage;