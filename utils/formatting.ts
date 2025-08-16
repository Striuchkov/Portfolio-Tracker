
export const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
};

export const formatPercentage = (value: number): string => {
    return `${value.toFixed(2)}%`;
};

export const formatNumber = (value: number): string => {
    return new Intl.NumberFormat('en-US').format(value);
};
