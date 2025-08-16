import { GoogleGenAI, Type } from "@google/genai";
import { Exchange, StockAsset, TickerDetails, TickerNews, PriceDataPoint, TimeRange } from "../types";

export const isApiKeyConfigured = !!process.env.API_KEY;

if (!isApiKeyConfigured) {
    console.error("CRITICAL: Gemini API key is not configured in environment variables. The application will not function.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const getGeminiTextResponse = async (prompt: string, useSearch: boolean = false): Promise<string> => {
     const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            tools: useSearch ? [{ googleSearch: {} }] : undefined,
            temperature: 0.1,
        },
    });
    
    if (response.promptFeedback?.blockReason) {
        throw new Error(`Request was blocked. Reason: ${response.promptFeedback.blockReason}. Message: ${response.promptFeedback.blockReasonMessage || 'No message.'}`);
    }

    const text = response.text;
    if (!text) {
        throw new Error("No text in Gemini response. The API may have returned an empty response or the request was blocked silently.");
    }
    return text;
};

const getGeminiJsonResponse = async <T>(prompt: string, schema: any, useSearch: boolean = false): Promise<T | null> => {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            tools: useSearch ? [{ googleSearch: {} }] : undefined,
            responseMimeType: "application/json",
            responseSchema: schema,
        },
    });
    const jsonText = response.text.trim();
    if (!jsonText) return null;
    return JSON.parse(jsonText) as T;
};

const parseOhlcvHistory = (historyStr: string | null): PriceDataPoint[] => {
    if (!historyStr) return [];
    return historyStr.split(';').map(item => {
        const parts = item.split(':');
        if (parts.length < 6) return null;
        const volume = parseInt(parts[parts.length - 1], 10);
        const close = parseFloat(parts[parts.length - 2]);
        const low = parseFloat(parts[parts.length - 3]);
        const high = parseFloat(parts[parts.length - 4]);
        const open = parseFloat(parts[parts.length - 5]);
        const date = parts.slice(0, parts.length - 5).join(':');

        return (date && !isNaN(open) && !isNaN(high) && !isNaN(low) && !isNaN(close) && !isNaN(volume))
            ? { date: date.trim(), open, high, low, close, volume } : null;
    }).filter((item): item is PriceDataPoint => item !== null);
};


export const fetchFullStockData = async (query: string, exchange: Exchange): Promise<Partial<StockAsset> & { priceHistory?: PriceDataPoint[] } | null> => {
    if (!isApiKeyConfigured) return null;
    const prompt = `Fetch the latest, most up-to-date detailed information for the stock with ticker or company name "${query}" on a ${exchange} exchange using real-time search. Provide the response as a single block of text with key-value pairs separated by ":::". Use "|||" to separate each pair. Keys must be: ticker, name, currentPrice, yearlyDividend, peRatio, forwardPeRatio, fiftyTwoWeekLow, fiftyTwoWeekHigh, companyProfile, marketCap, dividendYield, priceHistory. For companyProfile, provide a brief 2-3 sentence summary. For marketCap, provide a string (e.g., "1.2T"). For priceHistory, provide a semicolon-separated list of date:open:high:low:close:volume for the past 365 days (e.g., 2023-01-01:150:152:149:151:1000000;...). For any unavailable values, use "N/A". Do not add any explanation, markdown, or formatting.`;

    try {
        const text = await getGeminiTextResponse(prompt, true);
        const data = new Map<string, string>();
        text.split('|||').forEach(pair => {
            const parts = pair.split(':::');
            if (parts.length === 2) {
                data.set(parts[0].trim().toLowerCase(), parts[1].trim());
            }
        });

        const getStr = (key: string): string | null => data.get(key) && data.get(key)?.toLowerCase() !== 'n/a' ? data.get(key) ?? null : null;
        const getNum = (key: string): number | null => {
            const val = data.get(key);
            if (!val || val.toLowerCase() === 'n/a') return null;
            const num = parseFloat(val.replace(/,/g, ''));
            return isNaN(num) ? null : num;
        };

        const ticker = getStr("ticker");
        const name = getStr("name");
        const currentPrice = getNum("currentprice");

        if (!ticker || !name || currentPrice === null) {
            console.error("Failed to parse essential fields from response:", text);
            return null;
        }
        
        const priceHistory = parseOhlcvHistory(getStr('pricehistory'));

        return {
            ticker: ticker.toUpperCase(),
            name,
            currentPrice,
            yearlyDividend: getNum("yearlydividend"),
            peRatio: getNum("peratio"),
            forwardPeRatio: getNum("forwardperatio"),
            fiftyTwoWeekLow: getNum("fiftytwoweeklow"),
            fiftyTwoWeekHigh: getNum("fiftytwoweekhigh"),
            companyProfile: getStr("companyprofile") ?? 'No profile available.',
            marketCap: getStr("marketcap"),
            dividendYield: getNum("dividendyield"),
            priceHistory,
        };

    } catch (error) {
        console.error(`Error fetching full data for ${query}:`, error);
        throw new Error(`Failed to fetch data for ${query}.`);
    }
};

export const fetchBatchPrices = async (assets: Pick<StockAsset, 'ticker' | 'exchange'>[]): Promise<{ ticker: string; exchange: string; price: number }[] | null> => {
    if (!isApiKeyConfigured || assets.length === 0) return null;
    
    const assetList = assets.map(a => `${a.ticker} on ${a.exchange} exchange`).join(', ');
    const prompt = `Fetch the latest stock price for the following assets: ${assetList}. Respond with a list where each item is "TICKER:::EXCHANGE:::PRICE" and items are separated by "|||". Use real-time search for accuracy. Do not add any explanation, markdown, or formatting. The exchange must be one of 'USA' or 'Canada'.`;

    try {
        const text = await getGeminiTextResponse(prompt, true);
        const updates: { ticker: string; exchange: string; price: number }[] = [];
        text.split('|||').forEach(item => {
            const parts = item.split(':::');
            if (parts.length === 3) {
                const ticker = parts[0].trim().toUpperCase();
                const exchange = parts[1].trim();
                const price = parseFloat(parts[2].trim());
                
                const originalAsset = assets.find(a => a.ticker.toUpperCase() === ticker && a.exchange === exchange);
                if (originalAsset && !isNaN(price)) {
                     updates.push({ ticker: originalAsset.ticker, exchange: originalAsset.exchange, price });
                }
            }
        });
        return updates.length > 0 ? updates : null;
    } catch (error) {
        console.error(`Error fetching batch prices:`, error);
        return null;
    }
};

export const fetchStockDetailsForUpdate = async (ticker: string, exchange: Exchange): Promise<Partial<StockAsset> & { priceHistory?: PriceDataPoint[] } | null> => {
    if (!isApiKeyConfigured) return null;

    const prompt = `Fetch the latest key metrics and price history for the stock with ticker symbol "${ticker}" on a ${exchange} exchange using real-time search. Provide the response as a single block of text with key-value pairs separated by ":::". Use "|||" to separate each pair. Keys must be: peRatio, forwardPeRatio, fiftyTwoWeekLow, fiftyTwoWeekHigh, marketCap, dividendYield, yearlyDividend, priceHistory. For priceHistory, provide a semicolon-separated list of date:open:high:low:close:volume for the past 365 days. For any unavailable values, use "N/A".`;

    try {
        const text = await getGeminiTextResponse(prompt, true);
        const data = new Map<string, string>();
        text.split('|||').forEach(pair => {
            const parts = pair.split(':::');
            if (parts.length === 2) {
                data.set(parts[0].trim().toLowerCase(), parts[1].trim());
            }
        });

        const getStr = (key: string): string | null => data.get(key) && data.get(key)?.toLowerCase() !== 'n/a' ? data.get(key) ?? null : null;
        const getNum = (key: string): number | null => {
            const val = data.get(key);
            if (!val || val.toLowerCase() === 'n/a') return null;
            const num = parseFloat(val.replace(/,/g, ''));
            return isNaN(num) ? null : num;
        };
        
        const priceHistory = parseOhlcvHistory(getStr('pricehistory'));

        return {
            peRatio: getNum("peratio"),
            forwardPeRatio: getNum("forwardperatio"),
            fiftyTwoWeekLow: getNum("fiftytwoweeklow"),
            fiftyTwoWeekHigh: getNum("fiftytwoweekhigh"),
            marketCap: getStr("marketcap"),
            dividendYield: getNum("dividendyield"),
            yearlyDividend: getNum("yearlydividend"),
            priceHistory,
        };
    } catch (error) {
        console.error(`Error fetching details for update for ${ticker}:`, error);
        return null;
    }
};


export const fetchTickerDetails = async (ticker: string, exchange: Exchange): Promise<TickerDetails | null> => {
    if (!isApiKeyConfigured) return null;

    const prompt = `Fetch the latest, most up-to-date detailed information for the stock with ticker symbol "${ticker}" on a ${exchange} exchange using real-time search. Provide the response as a single block of text with key-value pairs separated by ":::". Use "|||" to separate each pair. Keys must be: name, companyProfile, currentPrice, dayChange, dayChangePercent, marketCap, peRatio, dividendYield, fiftyTwoWeekLow, fiftyTwoWeekHigh, and priceHistory.
- companyProfile should be a brief 2-3 sentence summary.
- marketCap should be a string (e.g., "1.2T", "250B", "50M").
- For priceHistory, provide a semicolon-separated list of date:open:high:low:close:volume pairs for the past 365 days (e.g., 2023-01-01:150:152:149:151:1000000;...).
- For any unavailable values, use "N/A".
- Do not add any explanation, markdown, or formatting.`;

    try {
        const text = await getGeminiTextResponse(prompt, true);
        
        const data = new Map<string, string>();
        text.split('|||').forEach(pair => {
            const parts = pair.split(':::');
            if (parts.length === 2) {
                data.set(parts[0].trim(), parts[1].trim());
            }
        });

        const getStr = (key: string): string | null => data.get(key) && data.get(key)?.toLowerCase() !== 'n/a' ? data.get(key) ?? null : null;
        const getNum = (key: string): number | null => {
            const val = data.get(key);
            if (!val || val.toLowerCase() === 'n/a') return null;
            const num = parseFloat(val);
            return isNaN(num) ? null : num;
        };

        const priceHistory = parseOhlcvHistory(getStr('priceHistory'));

        return {
            name: getStr('name') ?? 'N/A',
            companyProfile: getStr('companyProfile') ?? 'No profile available.',
            marketCap: getStr('marketCap'),
            peRatio: getNum('peRatio'),
            dividendYield: getNum('dividendYield'),
            fiftyTwoWeekLow: getNum('fiftyTwoWeekLow'),
            fiftyTwoWeekHigh: getNum('fiftyTwoWeekHigh'),
            dayChange: getNum('dayChange'),
            dayChangePercent: getNum('dayChangePercent'),
            currentPrice: getNum('currentPrice') ?? 0,
            priceHistory,
        };

    } catch (error) {
        console.error(`Error fetching ticker details for ${ticker} from Gemini API:`, error);
        throw new Error(`Failed to fetch details for ${ticker}. The API might be temporarily unavailable or the format changed.`);
    }
};

export const fetchTickerNews = async (ticker: string, exchange: Exchange): Promise<TickerNews[] | null> => {
    if (!isApiKeyConfigured) return null;
    const prompt = `Fetch the 5 most recent and relevant news articles for the stock with ticker "${ticker}" on a ${exchange} exchange.`;

    try {
        return await getGeminiJsonResponse(prompt, {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    source: { type: Type.STRING },
                    url: { type: Type.STRING },
                    publishedAt: { type: Type.STRING, description: "e.g. 2 hours ago, 2024-07-28" },
                },
                required: ["title", "source", "url", "publishedAt"],
            },
        });
    } catch (error) {
        console.error(`Error fetching news for ${ticker}:`, error);
        throw new Error(`Failed to fetch news for ${ticker}.`);
    }
};

export const fetchPriceHistory = async (ticker: string, exchange: Exchange, range: TimeRange): Promise<PriceDataPoint[] | null> => {
    if (!isApiKeyConfigured) return null;

    let promptRangeText = '';
    let promptIntervalText = 'daily OHLCV (open, high, low, close, volume) data';
    let responseFormat = `a semicolon-separated list of records. Each record must be in the format: 'date:open:high:low:close:volume'. Example: '2023-01-01:150:152:149:151:1000000'`;
    let useSearch = false;

    switch (range) {
        case '1D':
            promptRangeText = 'for today';
            promptIntervalText = 'intraday OHLCV data at 15-minute intervals';
            responseFormat = `a semicolon-separated list of records. Each record must be in the format: 'time:open:high:low:close:volume'. Example: '09:30:00:150:151:149.5:150.5:50000'`;
            useSearch = true; // Intraday data MUST use search to be accurate and available.
            break;
        case '5D':
            promptRangeText = 'for the last 5 trading days';
            promptIntervalText = 'daily OHLCV data';
            useSearch = true; // Use search for recent daily data
            break;
        case '1M':
            promptRangeText = 'for the last 1 month';
            break;
        case '1Y':
            promptRangeText = 'for the last 1 year';
            break;
        case '5Y':
            promptRangeText = 'for the last 5 years';
            break;
        case '10Y':
            promptRangeText = 'for the last 10 years';
            break;
    }

    const prompt = `Provide the historical price data for the stock with ticker "${ticker}" on a ${exchange} exchange ${promptRangeText}.
Data should include ${promptIntervalText}.
The response MUST be a single block of text containing ${responseFormat}.
Do not add any explanation, markdown, or other formatting.`;

    try {
        const text = await getGeminiTextResponse(prompt, useSearch);
        if (!text || text.trim() === '') return [];
        
        return parseOhlcvHistory(text);

    } catch (error) {
        console.error(`Error fetching ${range} price history for ${ticker}:`, error);
        throw new Error(`Failed to fetch ${range} price history for ${ticker}.`);
    }
};

export const generateCandlestickChartSvg = async (priceHistory: PriceDataPoint[], ticker: string): Promise<string | null> => {
    if (!isApiKeyConfigured || priceHistory.length < 1) return null;

    const dataPoints = priceHistory.map(p => `${p.date},${p.open},${p.high},${p.low},${p.close},${p.volume}`).join(';');
    
    const prompt = `
    Generate an SVG for a financial candlestick chart for the ticker ${ticker} with volume bars, with the following specifications:
    - The SVG must be responsive with a viewBox="0 0 400 300". Do not set fixed width or height.
    - The background must be transparent.
    - The data points are in 'date_or_time,open,high,low,close,volume' format, separated by semicolons: ${dataPoints}
    - The chart area should be split: top 70% for candlesticks, bottom 25% for volume bars, with a 5% gap in between.
    - Candlesticks:
      - If close >= open, the candle body should be filled with green ('#10B981').
      - If close < open, the candle body should be filled with red ('#EF4444').
      - Wicks (the lines for high/low) should be the same color as the candle body.
    - Volume Bars:
      - Bars should be positioned directly below their corresponding candlestick.
      - The color of the volume bar must match the color of its corresponding candlestick (green for up days, red for down days).
      - The height of each volume bar should be proportional to its volume relative to the maximum volume in the dataset.
    - Grid:
      - Add a subtle grid with 4 horizontal lines in the candlestick chart area.
      - Grid lines should be a light gray color like '#2D2D2D'.
    - Do not include any axis labels, titles, or legends inside the SVG.
    - The SVG must be a single block of valid XML, starting with <svg> and ending with </svg>. Do not include any other text or markdown formatting.
    `;

    try {
        const text = await getGeminiTextResponse(prompt);
        const svgMatch = text.match(/<svg.*?>[\s\S]*?<\/svg>/);
        return svgMatch ? svgMatch[0] : null;

    } catch (error) {
        console.error(`Error generating chart SVG for ${ticker}:`, error);
        return null;
    }
};

export const fetchCadToUsdRate = async (): Promise<number | null> => {
    if (!isApiKeyConfigured) return null;
    const prompt = `What is the current exchange rate for 1 Canadian Dollar (CAD) to US Dollars (USD)? Provide only the numeric value, for example: 0.75`;

    try {
        const text = await getGeminiTextResponse(prompt, true);
        const rate = parseFloat(text);
        return isNaN(rate) ? null : rate;
    } catch (error) {
        console.error("Error fetching CAD to USD rate:", error);
        return null;
    }
};