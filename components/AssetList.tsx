import React, { useState } from 'react';
import { Asset, AssetType } from '../types';
import { TrashIcon } from './icons/TrashIcon';
import { RefreshIcon } from './icons/RefreshIcon';
import { formatCurrency, formatPercentage, formatNumber } from '../utils/formatting';

interface AssetListProps {
    assets: Asset[];
    removeAsset: (id: string) => void;
    refreshAsset: (asset: Asset) => void;
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


const StockAssetItem: React.FC<{ asset: Extract<Asset, {type: AssetType.Stock}>, removeAsset: (id: string) => void, refreshAsset: (asset: Asset) => void }> = ({ asset, removeAsset, refreshAsset }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const marketValue = asset.shares * asset.currentPrice;
    const totalCost = asset.shares * asset.avgCost;
    const gainLoss = marketValue - totalCost;
    const gainLossPercent = totalCost === 0 ? 0 : (gainLoss / totalCost) * 100;

    const gainLossColor = gainLoss >= 0 ? 'text-positive' : 'text-negative';

    return (
        <>
            <tr className="border-b border-gray-700 hover:bg-gray-700/50 transition-colors cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                <td className="p-4 align-top">
                    <div className="flex items-center">
                        <ChevronDownIcon className={`h-5 w-5 text-gray-400 mr-3 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        <div>
                            <div className="font-bold text-white">{asset.ticker}</div>
                            <div className="text-sm text-gray-400 truncate max-w-[200px]">{asset.name}</div>
                            <div className="text-xs text-primary bg-primary/20 rounded-full px-2 py-0.5 inline-block mt-1">{asset.exchange}</div>
                        </div>
                    </div>
                </td>
                <td className="p-4 text-right align-top">{formatCurrency(asset.currentPrice)}</td>
                <td className="p-4 text-right align-top">{formatNumber(asset.shares)}</td>
                <td className="p-4 text-right align-top">{formatCurrency(marketValue)}</td>
                <td className={`p-4 text-right align-top font-semibold ${gainLossColor}`}>
                    <div>{formatCurrency(gainLoss)}</div>
                    <div className="text-sm">{formatPercentage(gainLossPercent)}</div>
                </td>
                <td className="p-4 align-top">
                    <div className="flex items-center justify-end space-x-2">
                        <button onClick={(e) => { e.stopPropagation(); refreshAsset(asset); }} className="p-2 text-gray-400 hover:text-white transition-colors" aria-label="Refresh asset">
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
                    <td colSpan={6} className="p-4 border-b border-gray-700">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-y-4 gap-x-2 text-sm">
                             <DataPoint label="Avg. Cost" value={asset.avgCost} format={formatCurrency} />
                             <DataPoint label="52-Wk High" value={asset.fiftyTwoWeekHigh} format={formatCurrency} />
                             <DataPoint label="52-Wk Low" value={asset.fiftyTwoWeekLow} format={formatCurrency} />
                             <DataPoint label="P/E Ratio" value={asset.peRatio} />
                             <DataPoint label="Forward P/E" value={asset.forwardPeRatio} />
                             <DataPoint label="Annual Dividend" value={asset.yearlyDividend && asset.yearlyDividend > 0 ? asset.yearlyDividend : null} format={formatCurrency} />
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
};

const CashAssetItem: React.FC<{ asset: Extract<Asset, {type: AssetType.Cash}>, removeAsset: (id: string) => void }> = ({ asset, removeAsset }) => {
    return (
        <tr className="border-b border-gray-700 hover:bg-gray-700/50 transition-colors">
            <td className="p-4 align-top">
                <div className="font-bold text-white">{asset.name}</div>
                <div className="text-sm text-gray-400">{asset.currency}</div>
            </td>
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

const AssetList: React.FC<AssetListProps> = ({ assets, removeAsset, refreshAsset }) => {
    if (assets.length === 0) {
        return (
            <div className="bg-gray-800 p-8 rounded-xl text-center shadow-inner">
                <h3 className="text-lg font-semibold text-white">This account is empty.</h3>
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
                            <th scope="col" className="p-4 text-right">Price</th>
                            <th scope="col" className="p-4 text-right">Shares/Amount</th>
                            <th scope="col" className="p-4 text-right">Market Value</th>
                            <th scope="col" className="p-4 text-right">Total Gain/Loss</th>
                            <th scope="col" className="p-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedAssets.map(asset => {
                            if (asset.type === AssetType.Stock) {
                                return <StockAssetItem key={asset.id} asset={asset} removeAsset={removeAsset} refreshAsset={refreshAsset} />;
                            } else {
                                return <CashAssetItem key={asset.id} asset={asset} removeAsset={removeAsset} />;
                            }
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AssetList;