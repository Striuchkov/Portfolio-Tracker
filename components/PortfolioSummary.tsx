
import React from 'react';
import { PortfolioSummaryData } from '../types';
import { formatCurrency, formatPercentage } from '../utils/formatting';

interface PortfolioSummaryProps {
    summary: PortfolioSummaryData;
}

const SummaryCard: React.FC<{ title: string; value: string; valueColor?: string }> = ({ title, value, valueColor = 'text-white' }) => (
    <div className="bg-gray-800 p-4 rounded-lg flex flex-col items-start">
        <span className="text-sm text-gray-400">{title}</span>
        <span className={`text-2xl font-semibold ${valueColor}`}>{value}</span>
    </div>
);


const PortfolioSummary: React.FC<PortfolioSummaryProps> = ({ summary }) => {
    const gainLossColor = summary.totalGainLoss >= 0 ? 'text-positive' : 'text-negative';
    const returnColor = summary.overallReturn >= 0 ? 'text-positive' : 'text-negative';

    return (
        <div className="bg-gray-800/50 p-6 rounded-xl shadow-2xl backdrop-blur-sm">
             <h2 className="text-xl font-bold mb-4 text-white">Portfolio Overview</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryCard title="Total Value" value={formatCurrency(summary.totalMarketValue)} />
                <SummaryCard title="Total Cost" value={formatCurrency(summary.totalCost)} />
                <SummaryCard title="Total Gain/Loss" value={formatCurrency(summary.totalGainLoss)} valueColor={gainLossColor} />
                <SummaryCard title="Overall Return" value={formatPercentage(summary.overallReturn)} valueColor={returnColor} />
            </div>
        </div>
    );
};

export default PortfolioSummary;
