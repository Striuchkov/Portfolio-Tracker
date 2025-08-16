
import { GoogleGenAI, Type } from "@google/genai";
import { Exchange, StockAsset, TickerDetails, TickerNews, TickerPriceHistory } from "../types";

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
    const text = response.text;
    if (!text) {
        throw new Error("No text in Gemini response.");
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


export const fetchFullStockData = async (query: string, exchange: Exchange): Promise<Partial<StockAsset> & { priceHistory?: TickerPriceHistory[] } | null> => {
    if (!isApiKeyConfigured) return null;
    const prompt = `Fetch the latest, most up-to-date detailed information for the stock with ticker or company name "${query}" on a ${exchange} exchange using real-time search. Provide the response as a single block of text with key-value pairs separated by ":::". Use "|||" to separate each pair. Keys must be: ticker, name, currentPrice, yearlyDividend, peRatio, forwardPeRatio, fiftyTwoWeekLow, fiftyTwoWeekHigh, companyProfile, marketCap, dividendYield, priceHistory. For companyProfile, provide a brief 2-3 sentence summary. For marketCap, provide a string (e.g., "1.2T"). For priceHistory, provide a semicolon-separated list of date:close pairs for the past 365 days (e.g., 2023-01-01:150.00;2023-01-02:151.25;...). For any unavailable values, use "N/A". Do not add any explanation, markdown, or formatting.`;

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
        
        let priceHistory: TickerPriceHistory[] = [];
        const historyStr = getStr('pricehistory');
        if (historyStr) {
            priceHistory = historyStr.split(';').map(item => {
                const [date, closeStr] = item.split(':');
                const close = parseFloat(closeStr);
                return (date && !isNaN(close)) ? { date, close } : null;
            }).filter((item): item is TickerPriceHistory => item !== null);
        }

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

export const fetchStockDetailsForUpdate = async (ticker: string, exchange: Exchange): Promise<Partial<StockAsset> & { priceHistory?: TickerPriceHistory[] } | null> => {
    if (!isApiKeyConfigured) return null;

    const prompt = `Fetch the latest key metrics and price history for the stock with ticker symbol "${ticker}" on a ${exchange} exchange using real-time search. Provide the response as a single block of text with key-value pairs separated by ":::". Use "|||" to separate each pair. Keys must be: peRatio, forwardPeRatio, fiftyTwoWeekLow, fiftyTwoWeekHigh, marketCap, dividendYield, yearlyDividend, priceHistory. For priceHistory, provide a semicolon-separated list of date:close pairs for the past 365 days. For any unavailable values, use "N/A".`;

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

        let priceHistory: TickerPriceHistory[] = [];
        const historyStr = getStr('pricehistory');
        if (historyStr) {
            priceHistory = historyStr.split(';').map(item => {
                const [date, closeStr] = item.split(':');
                const close = parseFloat(closeStr);
                return (date && !isNaN(close)) ? { date, close } : null;
            }).filter((item): item is TickerPriceHistory => item !== null);
        }

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
- For priceHistory, provide a semicolon-separated list of date:close pairs for the past 365 days (e.g., 2023-01-01:150.00;2023-01-02:151.25;...).
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

        let priceHistory: TickerPriceHistory[] = [];
        const historyStr = getStr('priceHistory');
        if (historyStr) {
            priceHistory = historyStr.split(';').map(item => {
                const [date, closeStr] = item.split(':');
                const close = parseFloat(closeStr);
                return (date && !isNaN(close)) ? { date, close } : null;
            }).filter((item): item is TickerPriceHistory => item !== null);
        }

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

export const generatePriceChartSvg = async (priceHistory: TickerPriceHistory[], ticker: string): Promise<string | null> => {
    if (!isApiKeyConfigured || priceHistory.length < 2) return null;

    const dataPoints = priceHistory.map(p => `${p.date},${p.close}`).join(';');
    const latestPrice = priceHistory[priceHistory.length - 1].close;
    const oldestPrice = priceHistory[0].close;
    const trendColor = latestPrice >= oldestPrice ? '#10B981' : '#EF4444';

    const prompt = `
    Generate an SVG for a financial price chart for the ticker ${ticker} with the following specifications:
    - The SVG should be responsive with a viewBox="0 0 400 200". Do not set a fixed width or height.
    - The background should be transparent.
    - The data points are in 'YYYY-MM-DD,close_price' format, separated by semicolons: ${dataPoints}
    - The line color for the price chart must be '${trendColor}'.
    - Add a subtle grid with 4 horizontal lines. Grid lines should be a light gray color like '#2D2D2D'.
    - Do not include any axis labels, titles, or legends inside the SVG. Just the line chart and grid.
    - The line should be smooth (use curves). The line stroke width should be 2.
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