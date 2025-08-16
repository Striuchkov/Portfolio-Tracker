import React, { useState, useEffect, useMemo } from 'react';
import { Exchange, TickerDetails } from '../types';
import { fetchTickerDetails, generatePriceChartSvg } from '../services/geminiService';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { formatCurrency, formatPercentage } from '../utils/formatting';

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
    const [details, setDetails] = useState<TickerDetails | null>(null);
    const [chartSvg, setChartSvg] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadTickerData = async () => {
            setIsLoading(true);
            setError(null);
            setDetails(null);
            setChartSvg(null);

            try {
                const fetchedDetails = await fetchTickerDetails(ticker, exchange);
                if (fetchedDetails) {
                    setDetails(fetchedDetails);
                    // Don't wait for the chart to show the page
                    generatePriceChartSvg(fetchedDetails.priceHistory, ticker).then(setChartSvg);
                } else {
                    throw new Error("No data returned from the API.");
                }
            } catch (err: unknown) {
                if (err instanceof Error) {
                    setError(err.message);
                } else {
                    setError("An unknown error occurred.");
                }
            } finally {
                setIsLoading(false);
            }
        };

        loadTickerData();
    }, [ticker, exchange]);

    const dayChangeColor = useMemo(() => {
        if (!details || details.dayChange === null) return 'text-gray-400';
        return details.dayChange >= 0 ? 'text-positive' : 'text-negative';
    }, [details]);

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

    if (!details) {
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
                        <h1 className="text-3xl md:text-4xl font-bold text-white">{details.name}</h1>
                        <p className="text-lg text-gray-400 mt-1">{ticker} &middot; {exchange}</p>
                        <div className="flex items-end gap-4 mt-4">
                            <p className="text-4xl md:text-5xl font-bold text-white">{formatCurrency(details.currentPrice)}</p>
                            <div className={`text-xl font-semibold ${dayChangeColor}`}>
                               <span>{details.dayChange !== null && details.dayChange > 0 ? '+' : ''}{formatCurrency(details.dayChange ?? 0)}</span>
                               <span className="ml-2">({details.dayChangePercent !== null && details.dayChangePercent > 0 ? '+' : ''}{formatPercentage(details.dayChangePercent ?? 0)})</span>
                            </div>
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
                         <p className="text-gray-300 leading-relaxed">{details.companyProfile}</p>
                     </div>
                </div>

                {/* Right Column */}
                <div className="lg:col-span-1 space-y-8">
                     {/* Key Metrics */}
                     <div className="bg-gray-800/50 p-6 rounded-xl space-y-4">
                        <h2 className="text-xl font-bold text-white mb-2">Key Metrics</h2>
                        <DataPoint label="Market Cap" value={details.marketCap} />
                        <DataPoint label="P/E Ratio" value={details.peRatio} />
                        <DataPoint label="Dividend Yield" value={details.dividendYield} format={formatPercentage} />
                        <DataPoint label="52-Week High" value={details.fiftyTwoWeekHigh} format={formatCurrency} />
                        <DataPoint label="52-Week Low" value={details.fiftyTwoWeekLow} format={formatCurrency} />
                    </div>
                    {/* News */}
                    <div className="bg-gray-800 p-6 rounded-xl">
                        <h2 className="text-xl font-bold text-white mb-4">Recent News</h2>
                        <ul className="space-y-4">
                            {details.news.slice(0, 5).map((item, index) => (
                                <li key={index} className="border-b border-gray-700 pb-4 last:border-b-0 last:pb-0">
                                    <a href={item.url ?? '#'} target="_blank" rel="noopener noreferrer" className="font-semibold text-white hover:text-primary transition-colors block">
                                        {item.title}
                                    </a>
                                    <div className="text-xs text-gray-400 mt-1">
                                        <span>{item.source} &middot; {item.publishedAt}</span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default TickerPage;

