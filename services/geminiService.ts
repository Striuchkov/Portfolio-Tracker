
import { GoogleGenAI, Type } from "@google/genai";
import { Exchange, TickerDetails, TickerNews, TickerPriceHistory } from "../types";

export const isApiKeyConfigured = !!process.env.API_KEY;

if (!isApiKeyConfigured) {
    console.error("CRITICAL: Gemini API key is not configured in environment variables. The application will not function.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

interface StockData {
    ticker: string;
    name: string;
    price: number;
    yearlyDividend: number | null;
    peRatio: number | null;
    forwardPeRatio: number | null;
    fiftyTwoWeekLow: number | null;
    fiftyTwoWeekHigh: number | null;
}

const parseGeminiStockResponse = (responseText: string): StockData | null => {
    try {
        const getValue = (key: string): string | null => {
            const regex = new RegExp(`${key}:\\s*([^,\\n]*)`, 'i');
            const match = responseText.match(regex);
            return match && match[1] ? match[1].trim() : null;
        };

        const getNumericValue = (key: string): number | null => {
            const value = getValue(key);
            if (!value || value.toLowerCase() === 'n/a') {
                return null;
            }
            const numeric = parseFloat(value.replace(/,/g, ''));
            return isNaN(numeric) ? null : numeric;
        };

        const ticker = getValue("TICKER");
        const name = getValue("NAME");
        const price = getNumericValue("PRICE");

        if (!ticker || !name || price === null) {
            console.error("Failed to parse essential fields (TICKER, NAME or PRICE) from response:", responseText);
            return null;
        }

        return {
            ticker,
            name,
            price,
            yearlyDividend: getNumericValue("YEARLY_DIVIDEND"),
            peRatio: getNumericValue("PE_RATIO"),
            forwardPeRatio: getNumericValue("FORWARD_PE"),
            fiftyTwoWeekLow: getNumericValue("52_WEEK_LOW"),
            fiftyTwoWeekHigh: getNumericValue("52_WEEK_HIGH"),
        };
    } catch (error) {
        console.error("Error parsing Gemini response:", error);
        return null;
    }
};

export const fetchAssetData = async (query: string, exchange: Exchange): Promise<StockData | null> => {
    if (!isApiKeyConfigured) return null;
    const prompt = `Fetch the latest stock data for the company or ticker symbol "${query}" listed on a ${exchange} exchange. Provide the response as a single line of comma-separated key-value pairs in the format: "TICKER: [Ticker Symbol], NAME: [Full Company Name], PRICE: [Latest Price], YEARLY_DIVIDEND: [Annual Dividend per Share], PE_RATIO: [Current P/E Ratio], FORWARD_PE: [Forward P/E Ratio], 52_WEEK_LOW: [52-week Low Price], 52_WEEK_HIGH: [52-week High Price]". For any unavailable data, use "N/A" for the value. Do not include currency symbols, thousands separators in numbers, or any other text, explanation or line breaks.`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                temperature: 0.1,
            },
        });
        
        const text = response.text;
        if (!text) {
            console.error("No text in Gemini response for query:", query);
            return null;
        }

        return parseGeminiStockResponse(text);
    } catch (error) {
        console.error(`Error fetching data for ${query} from Gemini API:`, error);
        throw new Error(`Failed to fetch data for ${query}. The API might be temporarily unavailable.`);
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
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                temperature: 0.1,
            },
        });

        const text = response.text;
        if (!text) {
            console.error("No text in Gemini response for ticker details:", ticker);
            return null;
        }

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
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
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
                },
            },
        });
        const jsonText = response.text.trim();
        return JSON.parse(jsonText) as TickerNews[];
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
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                temperature: 0.1,
            },
        });
        const text = response.text;
        if (!text) return null;
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
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                temperature: 0,
            },
        });

        const text = response.text;
        if (!text) return null;

        const rate = parseFloat(text);
        return isNaN(rate) ? null : rate;
    } catch (error) {
        console.error("Error fetching CAD to USD rate:", error);
        return null;
    }
};