
import React, { useState } from 'react';
import { Asset, AssetType, StockAsset, Account } from '../types';
import { TrashIcon } from './icons/TrashIcon';
import { RefreshIcon } from './icons/RefreshIcon';
import { formatCurrency, formatPercentage, formatNumber } from '../utils/formatting';

interface AssetListProps {
    assets: Asset[];
    removeAsset: (id: string) => void;
    refreshAssetDetails: (asset: Asset) => void;
    accounts: Account[];
    showAccountColumn: boolean;
}

const ChevronDownIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
);

const DataPoint: React.FC<{ label: string; value: string | number | null | undefined, format?: (val: number) => string }> = ({ label, value, format }) => {
    const displayValue = value === null || value === undefined || (typeof value === 'number' && isNaN(value)) ? 'N/A' : (format ? format(value as number) : value);
    return (
        <div>
            <div className="text-gray-400 text-xs uppercase tracking-wider">{label}</div>
            <div className="text-white font-medium mt-1">{displayValue}</div>
        </div>
    );
};


const StockAssetItem: React.FC<{ asset: StockAsset, removeAsset: (id: string) => void, refreshAssetDetails: (asset: Asset) => void, showAccountColumn: boolean, accountName?: string }> = ({ asset, removeAsset, refreshAssetDetails, showAccountColumn, accountName }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const marketValue = asset.shares * asset.currentPrice;
    const totalCost = asset.shares * asset.avgCost;
    const gainLoss = marketValue - totalCost;
    const gainLossPercent = totalCost === 0 ? 0 : (gainLoss / totalCost) * 100;

    const gainLossColor = gainLoss >= 0 ? 'text-positive' : 'text-negative';

    return (
        <>
            <tr className="border-b border-gray-700 hover:bg-gray-700/50 transition-colors">
                <td className="p-4 align-top">
                    <div className="flex items-center">
                        <button onClick={() => setIsExpanded(!isExpanded)} className="flex-shrink-0" aria-label="Expand row">
                            <ChevronDownIcon className={`h-5 w-5 text-gray-400 mr-3 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                        <div>
                             <a href={`#/ticker/${encodeURIComponent(asset.ticker)}/${encodeURIComponent(asset.exchange)}`} className="font-bold text-white hover:text-primary transition-colors">{asset.ticker}</a>
                            <div className="text-sm text-gray-400 truncate max-w-[200px]">{asset.name}</div>
                            <div className="text-xs text-primary bg-primary/20 rounded-full px-2 py-0.5 inline-block mt-1">{asset.exchange}</div>
                        </div>
                    </div>
                </td>
                {showAccountColumn && <td className="p-4 align-top">{accountName || 'N/A'}</td>}
                <td className="p-4 text-right align-top">{formatCurrency(asset.currentPrice)}</td>
                <td className="p-4 text-right align-top">{formatNumber(asset.shares)}</td>
                <td className="p-4 text-right align-top">{formatCurrency(marketValue)}</td>
                <td className={`p-4 text-right align-top font-semibold ${gainLossColor}`}>
                    <div>{formatCurrency(gainLoss)}</div>
                    <div className="text-sm">{formatPercentage(gainLossPercent)}</div>
                </td>
                <td className="p-4 align-top">
                    <div className="flex items-center justify-end space-x-2">
                        <button onClick={(e) => { e.stopPropagation(); refreshAssetDetails(asset); }} className="p-2 text-gray-400 hover:text-white transition-colors" aria-label="Refresh asset metrics">
                            <RefreshIcon className="h-5 w-5" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); removeAsset(asset.id); }} className="p-2 text-gray-400 hover:text-negative transition-colors" aria-label="Remove asset">
                            <TrashIcon className="h-5 w-5" />
                        </button>
                    </div>
                </td>
            </tr>
            {isExpanded && (
                <tr className="bg-gray-800/50">
                    <td colSpan={showAccountColumn ? 7 : 6} className="p-4 border-b border-gray-700">
                         <div className="space-y-4">
                            <p className="text-gray-300 text-sm leading-relaxed">{asset.companyProfile}</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-y-4 gap-x-2 text-sm pt-4 border-t border-gray-700/50">
                                 <DataPoint label="Avg. Cost" value={asset.avgCost} format={formatCurrency} />
                                 <DataPoint label="Market Cap" value={asset.marketCap} />
                                 <DataPoint label="P/E Ratio" value={asset.peRatio} />
                                 <DataPoint label="Forward P/E" value={asset.forwardPeRatio} />
                                 <DataPoint label="52-Wk High" value={asset.fiftyTwoWeekHigh} format={formatCurrency} />
                                 <DataPoint label="52-Wk Low" value={asset.fiftyTwoWeekLow} format={formatCurrency} />
                                 <DataPoint label="Div. Yield" value={asset.dividendYield ? asset.dividendYield : null} format={formatPercentage} />
                                 <DataPoint label="Annual Div" value={asset.yearlyDividend && asset.yearlyDividend > 0 ? asset.yearlyDividend : null} format={formatCurrency} />
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
};

const CashAssetItem: React.FC<{ asset: Extract<Asset, {type: AssetType.Cash}>, removeAsset: (id: string) => void, showAccountColumn: boolean, accountName?: string }> = ({ asset, removeAsset, showAccountColumn, accountName }) => {
    return (
        <tr className="border-b border-gray-700 hover:bg-gray-700/50 transition-colors">
            <td className="p-4 align-top">
                <div className="font-bold text-white">{asset.name}</div>
                <div className="text-sm text-gray-400">{asset.currency}</div>
            </td>
             {showAccountColumn && <td className="p-4 align-top">{accountName || 'N/A'}</td>}
            <td className="p-4 text-right align-top text-gray-500">N/A</td>
            <td className="p-4 text-right align-top">{formatNumber(asset.amount)}</td>
            <td className="p-4 text-right align-top">{formatCurrency(asset.amount)}</td>
            <td className="p-4 text-right align-top text-gray-500">N/A</td>
            <td className="p-4 align-top">
                <div className="flex items-center justify-end">
                    <button onClick={(e) => { e.stopPropagation(); removeAsset(asset.id); }} className="p-2 text-gray-400 hover:text-negative transition-colors" aria-label="Remove cash">
                        <TrashIcon className="h-5 w-5" />
                    </button>
                </div>
            </td>
        </tr>
    );
};

const AssetList: React.FC<AssetListProps> = ({ assets, removeAsset, refreshAssetDetails, accounts, showAccountColumn }) => {
    if (assets.length === 0) {
        return (
            <div className="bg-gray-800 p-8 rounded-xl text-center shadow-inner">
                <h3 className="text-lg font-semibold text-white">This view is empty.</h3>
                <p className="text-gray-400 mt-2">Add a new stock or cash balance to get started.</p>
            </div>
        );
    }

    const sortedAssets = [...assets].sort((a, b) => {
        if (a.type === AssetType.Cash && b.type !== AssetType.Cash) return 1;
        if (a.type !== AssetType.Cash && b.type === AssetType.Cash) return -1;
        if (a.type === AssetType.Stock && b.type === AssetType.Stock) {
            return a.ticker.localeCompare(b.ticker);
        }
        return 0;
    });
    
    return (
        <div className="bg-gray-800 rounded-xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-300">
                    <thead className="text-xs text-gray-400 uppercase bg-gray-700/50">
                        <tr>
                            <th scope="col" className="p-4">Asset</th>
                            {showAccountColumn && <th scope="col" className="p-4">Account</th>}
                            <th scope="col" className="p-4 text-right">Price</th>
                            <th scope="col" className="p-4 text-right">Shares/Amount</th>
                            <th scope="col" className="p-4 text-right">Market Value</th>
                            <th scope="col" className="p-4 text-right">Total Gain/Loss</th>
                            <th scope="col" className="p-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedAssets.map(asset => {
                            const accountName = accounts.find(acc => acc.id === asset.accountId)?.name;
                            if (asset.type === AssetType.Stock) {
                                return <StockAssetItem key={asset.id} asset={asset} removeAsset={removeAsset} refreshAssetDetails={refreshAssetDetails} showAccountColumn={showAccountColumn} accountName={accountName} />;
                            } else {
                                return <CashAssetItem key={asset.id} asset={asset} removeAsset={removeAsset} showAccountColumn={showAccountColumn} accountName={accountName} />;
                            }
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AssetList;
