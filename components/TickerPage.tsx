import React, { useState, useEffect, useMemo } from 'react';
import { Exchange, TickerDetails, TickerNews, StockAsset, PriceDataPoint, TimeRange } from '../types';
import { fetchTickerDetails, fetchTickerNews, generateCandlestickChartSvg, fetchPriceHistory } from '../services/geminiService';
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

    // Chart-specific state
    const [timeRange, setTimeRange] = useState<TimeRange>('1Y');
    const [currentChartHistory, setCurrentChartHistory] = useState<PriceDataPoint[] | null>(null);
    const [isChartLoading, setIsChartLoading] = useState<boolean>(false);


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

    // Main data loading effect, runs when ticker/exchange changes
    useEffect(() => {
        // Reset all state for the new ticker
        setAsset(null);
        setDetails(null);
        setChartSvg(null);
        setCurrentChartHistory(null);
        setTimeRange('1Y');
        setIsLoading(true);
        setError(null);
        setNews(null);
        setNewsError(null);
        setIsNewsLoading(false);
        setIsChartLoading(true);

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

    // Effect for fetching price history based on the selected time range
    useEffect(() => {
        const sourceData = isPortfolioAsset ? asset : details;
        if (!sourceData) return;

        const fetchHistory = async () => {
            setIsChartLoading(true);
            setChartSvg(null);
            try {
                if (timeRange === '1Y' && sourceData.priceHistory && sourceData.priceHistory.length > 0) {
                    setCurrentChartHistory(sourceData.priceHistory);
                } else {
                    const history = await fetchPriceHistory(ticker, exchange, timeRange);
                    setCurrentChartHistory(history ?? []);
                }
            } catch (err: any) {
                setError(err.message); // Show error on the page
                setCurrentChartHistory(null);
            } finally {
                setIsChartLoading(false);
            }
        };

        fetchHistory();
    }, [timeRange, asset, details]);


    // Effect for generating the SVG chart when its data changes
    useEffect(() => {
        if (isChartLoading) return;
        
        const sourceData = isPortfolioAsset ? asset : details;
        if (currentChartHistory && currentChartHistory.length > 0 && sourceData) {
            let historyForSvg = JSON.parse(JSON.stringify(currentChartHistory)); // Deep copy to prevent state mutation

            // For portfolio assets on daily charts, update the latest candle with the live price
            if (isPortfolioAsset && asset && timeRange !== '1D' && historyForSvg.length > 0) {
                const today = new Date().toISOString().split('T')[0];
                const lastPoint = historyForSvg[historyForSvg.length - 1];

                // If the last data point is from today, update it
                if (lastPoint && (lastPoint.date === today || new Date(lastPoint.date) < new Date(today))) {
                     if(lastPoint.date !== today) {
                        // If last point is old, add a new one for today using yesterday's close as O, H, L
                        historyForSvg.push({
                            date: today,
                            open: lastPoint.close,
                            high: Math.max(lastPoint.close, asset.currentPrice),
                            low: Math.min(lastPoint.close, asset.currentPrice),
                            close: asset.currentPrice,
                            volume: 0 // We don't have live volume
                        });
                    } else {
                        // It is today, so update it
                        lastPoint.close = asset.currentPrice;
                        lastPoint.high = Math.max(lastPoint.high, asset.currentPrice);
                        lastPoint.low = Math.min(lastPoint.low, asset.currentPrice);
                    }
                }
            }
            
            generateCandlestickChartSvg(historyForSvg, ticker).then(setChartSvg);
        } else {
             setChartSvg(null);
        }
    }, [currentChartHistory, isChartLoading, ticker, asset, details, isPortfolioAsset, timeRange]);


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
                dayChange: null,
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
        if (!details || details.dayChange === null) return 'text-gray-400';
        return details.dayChange >= 0 ? 'text-positive' : 'text-negative';
    }, [details]);

    const TimeRangeSelector: React.FC = () => {
        const ranges: TimeRange[] = ['1D', '5D', '1M', '1Y', '5Y', '10Y'];
        return (
            <div className="flex space-x-1 bg-gray-700/50 p-1 rounded-lg">
                {ranges.map(range => (
                    <button
                        key={range}
                        onClick={() => setTimeRange(range)}
                        disabled={isChartLoading}
                        className={`w-full py-2 px-3 text-xs font-bold rounded-md focus:outline-none transition-all duration-200 ease-in-out
                            ${timeRange === range ? 'bg-primary text-white shadow' : 'text-gray-300 hover:bg-gray-600/50 disabled:text-gray-500 disabled:hover:bg-transparent'}
                        `}
                    >
                        {range}
                    </button>
                ))}
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
                <SpinnerIcon className="animate-spin h-12 w-12 text-primary" />
                <p className="mt-4 text-lg">Fetching latest data for {ticker}...</p>
            </div>
        );
    }
    
    if (error && !displayData) { // Only show full-page error if we have no data at all
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

    const currentPriceData = isPortfolioAsset && asset ? asset : details;

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
                            <p className="text-4xl md:text-5xl font-bold text-white">{formatCurrency(currentPriceData.currentPrice)}</p>
                            {!isPortfolioAsset && details && details.dayChange !== null && (
                                <div className={`text-xl font-semibold ${dayChangeColor}`}>
                                   <span>{details.dayChange > 0 ? '+' : ''}{formatCurrency(details.dayChange)}</span>
                                   <span className="ml-2">({details.dayChangePercent !== null && details.dayChangePercent > 0 ? '+' : ''}{formatPercentage(details.dayChangePercent ?? 0)})</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Chart */}
                    <div className="bg-gray-800 p-6 rounded-xl">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-4">
                             <h2 className="text-xl font-bold text-white">Price History</h2>
                             <TimeRangeSelector />
                        </div>
                        <div className="h-[400px] flex items-center justify-center">
                            {isChartLoading ? (
                                <div className="text-center">
                                    <SpinnerIcon className="animate-spin h-8 w-8 text-primary mx-auto" />
                                    <p className="text-gray-400 mt-2">Loading chart data...</p>
                                </div>
                            ) : chartSvg ? (
                                <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: chartSvg }} />
                            ) : (
                                <div className="text-center text-gray-400">
                                    <p>{error ? error : 'No price history available for this range.'}</p>
                                    {error && <button onClick={() => setTimeRange(t => t)} className="mt-2 text-sm text-primary hover:underline">Try again</button>}
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
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-primary disabled:bg-gray-600 disabled: