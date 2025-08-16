import React, { useState, useEffect } from 'react';
import { Exchange, Account, Currency } from '../types';
import { PlusIcon } from './icons/PlusIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';

interface AddAssetFormProps {
    addAsset: (ticker: string, shares: number, avgCost: number, exchange: Exchange, accountId: string) => Promise<void>;
    addCash: (accountId: string, amount: number, currency: Currency) => Promise<void>;
    isLoading: boolean;
    accounts: Account[];
}

const AddAssetForm: React.FC<AddAssetFormProps> = ({ addAsset, addCash, isLoading, accounts }) => {
    const [assetType, setAssetType] = useState<'stock' | 'cash'>('stock');

    // Stock state
    const [ticker, setTicker] = useState('');
    const [shares, setShares] = useState('');
    const [avgCost, setAvgCost] = useState('');
    const [exchange, setExchange] = useState<Exchange>(Exchange.USA);
    
    // Cash state
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState<Currency>(Currency.USD);

    // Common state
    const [accountId, setAccountId] = useState<string>('');
    const [formError, setFormError] = useState<string | null>(null);

    useEffect(() => {
        if (!accountId && accounts.length > 0) {
            setAccountId(accounts[0].id);
        }
    }, [accounts, accountId]);
    
    const resetForms = () => {
        setTicker('');
        setShares('');
        setAvgCost('');
        setAmount('');
        setFormError(null);
    };

    const handleTypeChange = (type: 'stock' | 'cash') => {
        setAssetType(type);
        resetForms();
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);

        if (!accountId) {
            setFormError('Please select an account.');
            return;
        }

        if (assetType === 'stock') {
            const sharesNum = parseFloat(shares);
            const avgCostNum = parseFloat(avgCost);

            if (!ticker.trim() || isNaN(sharesNum) || sharesNum <= 0 || isNaN(avgCostNum) || avgCostNum < 0) {
                setFormError('Please fill in all fields with valid numbers.');
                return;
            }
            addAsset(ticker, sharesNum, avgCostNum, exchange, accountId).then(resetForms);
        } else { // cash
            const amountNum = parseFloat(amount);
            if (isNaN(amountNum) || amountNum <= 0) {
                setFormError('Please enter a valid, positive amount.');
                return;
            }
            addCash(accountId, amountNum, currency).then(resetForms);
        }
    };

    const TabButton: React.FC<{ active: boolean, onClick: () => void, children: React.ReactNode }> = ({ active, onClick, children }) => (
        <button
            type="button"
            onClick={onClick}
            className={`w-full py-2.5 text-sm font-medium leading-5 rounded-lg focus:outline-none transition-all duration-200 ease-in-out
                ${active ? 'bg-primary text-white shadow' : 'text-gray-300 hover:bg-gray-700/50'}`}
        >
            {children}
        </button>
    );

    return (
        <div className="bg-gray-800 p-6 rounded-xl shadow-2xl">
            <h2 className="text-xl font-bold mb-4 text-white">Add to Portfolio</h2>
            
            <div className="mb-4 p-1 flex space-x-1 bg-gray-700 rounded-xl">
                <TabButton active={assetType === 'stock'} onClick={() => handleTypeChange('stock')}>Stock / ETF</TabButton>
                <TabButton active={assetType === 'cash'} onClick={() => handleTypeChange('cash')}>Cash</TabButton>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                 <div>
                    <label htmlFor="account" className="block text-sm font-medium text-gray-400">Account</label>
                    <select
                        id="account"
                        value={accountId}
                        onChange={(e) => setAccountId(e.target.value)}
                        className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm text-white px-3 py-2 disabled:bg-gray-700/50 disabled:cursor-not-allowed"
                        disabled={isLoading || accounts.length === 0}
                    >
                        {accounts.length === 0 ? (
                            <option>Create an account first</option>
                        ) : (
                            accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)
                        )}
                    </select>
                </div>

                {assetType === 'stock' ? (
                    <>
                        <div>
                            <label htmlFor="ticker" className="block text-sm font-medium text-gray-400">Ticker or Company Name</label>
                            <input
                                type="text"
                                id="ticker"
                                value={ticker}
                                onChange={(e) => setTicker(e.target.value)}
                                placeholder="e.g., AAPL, Apple Inc, VFV.TO"
                                className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm text-white px-3 py-2"
                                disabled={isLoading}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="shares" className="block text-sm font-medium text-gray-400">Shares</label>
                                <input
                                    type="number"
                                    id="shares"
                                    value={shares}
                                    onChange={(e) => setShares(e.target.value)}
                                    placeholder="e.g., 10"
                                    className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm text-white px-3 py-2"
                                    disabled={isLoading}
                                    min="0"
                                    step="any"
                                />
                            </div>
                            <div>
                                <label htmlFor="avgCost" className="block text-sm font-medium text-gray-400">Average Cost</label>
                                <input
                                    type="number"
                                    id="avgCost"
                                    value={avgCost}
                                    onChange={(e) => setAvgCost(e.target.value)}
                                    placeholder="e.g., 150.75"
                                    className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm text-white px-3 py-2"
                                    disabled={isLoading}
                                    min="0"
                                    step="any"
                                />
                            </div>
                        </div>
                        <div>
                            <span className="block text-sm font-medium text-gray-400">Exchange</span>
                            <div className="mt-2 flex space-x-4">
                                {(Object.values(Exchange)).map((ex) => (
                                    <label key={ex} className="flex items-center">
                                        <input
                                            type="radio"
                                            name="exchange"
                                            value={ex}
                                            checked={exchange === ex}
                                            onChange={() => setExchange(ex)}
                                            className="h-4 w-4 text-primary bg-gray-700 border-gray-600 focus:ring-primary"
                                            disabled={isLoading}
                                        />
                                        <span className="ml-2 text-sm text-gray-300">{ex}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </>
                ) : ( // Cash form
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="amount" className="block text-sm font-medium text-gray-400">Amount</label>
                            <input
                                type="number"
                                id="amount"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="e.g., 1000"
                                className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm text-white px-3 py-2"
                                disabled={isLoading}
                                min="0"
                                step="any"
                            />
                        </div>
                         <div>
                            <label htmlFor="currency" className="block text-sm font-medium text-gray-400">Currency</label>
                            <select
                                id="currency"
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value as Currency)}
                                className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm text-white px-3 py-2"
                                disabled={isLoading}
                            >
                                {Object.values(Currency).map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                )}


                {formError && <p className="text-negative text-sm">{formError}</p>}

                <button
                    type="submit"
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-primary disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                    disabled={isLoading || accounts.length === 0}
                >
                    {isLoading ? <SpinnerIcon className="animate-spin h-5 w-5" /> : <PlusIcon className="h-5 w-5 mr-2" />}
                    {isLoading ? (assetType === 'stock' ? 'Fetching...' : 'Submitting...') : 'Add to Portfolio'}
                </button>
            </form>
        </div>
    );
};

export default AddAssetForm;