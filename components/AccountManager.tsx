import React, { useState } from 'react';
import { Account, AccountType } from '../types';
import { PlusIcon } from './icons/PlusIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';

interface AccountManagerProps {
    accounts: Account[];
    createAccount: (name: string, type: AccountType) => Promise<void>;
    isLoading: boolean;
}

const AccountManager: React.FC<AccountManagerProps> = ({ accounts, createAccount, isLoading }) => {
    const [name, setName] = useState('');
    const [type, setType] = useState<AccountType>(AccountType.TFSA);
    const [formError, setFormError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            setFormError('Account name is required.');
            return;
        }
        setFormError(null);
        await createAccount(name, type);
        setName('');
        setType(AccountType.TFSA);
    };

    return (
        <div className="bg-gray-800 p-6 rounded-xl shadow-2xl mb-8">
            <h2 className="text-xl font-bold text-white">Accounts</h2>
            <ul className="my-4 space-y-2">
                {accounts.length > 0 ? (
                    accounts.map(account => (
                        <li key={account.id} className="bg-gray-700 p-3 rounded-lg flex justify-between items-center">
                            <span className="font-medium text-white">{account.name}</span>
                            <span className="text-xs text-primary bg-primary/20 rounded-full px-2 py-0.5">{account.type}</span>
                        </li>
                    ))
                ) : (
                    <p className="text-gray-400 text-sm">You haven't created any accounts yet.</p>
                )}
            </ul>

            <form onSubmit={handleSubmit} className="space-y-4 border-t border-gray-700 pt-4">
                 <h3 className="text-lg font-semibold text-white">Create New Account</h3>
                <div>
                    <label htmlFor="accountName" className="block text-sm font-medium text-gray-400">Account Name</label>
                    <input
                        type="text"
                        id="accountName"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g., My TFSA"
                        className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm text-white px-3 py-2"
                        disabled={isLoading}
                    />
                </div>
                <div>
                    <label htmlFor="accountType" className="block text-sm font-medium text-gray-400">Account Type</label>
                     <select
                        id="accountType"
                        value={type}
                        onChange={(e) => setType(e.target.value as AccountType)}
                        className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm text-white px-3 py-2"
                        disabled={isLoading}
                    >
                        {Object.values(AccountType).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>

                {formError && <p className="text-negative text-sm">{formError}</p>}
                
                <button
                    type="submit"
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary/80 hover:bg-primary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-primary disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                    disabled={isLoading || !name}
                >
                    {isLoading ? <SpinnerIcon className="animate-spin h-5 w-5" /> : <PlusIcon className="h-5 w-5 mr-2" />}
                    Create Account
                </button>
            </form>
        </div>
    );
};

export default AccountManager;
