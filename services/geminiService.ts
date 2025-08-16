import { GoogleGenAI, Type } from "@google/genai";
import { Exchange, TickerDetails, TickerPriceHistory } from "../types";

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
        console.log("Parsing response:", responseText);

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

    const prompt = `Fetch detailed information for the stock with ticker symbol "${ticker}" on a ${exchange} exchange. Provide the following data points:
- Full company name
- A brief company profile (2-3 sentences)
- Current stock price
- Today's price change absolute value
- Today's price change percentage
- Market capitalization (e.g., "1.2T", "250B", "50M")
- Price-to-Earnings (P/E) ratio
- Dividend yield percentage
- 52-week low price
- 52-week high price
- 5 recent news headlines, each with its source, a direct URL, and a relative published date (e.g., "2h ago", "Yesterday", "3d ago").
- Daily closing prices for the past 365 days.
`;

    const schema = {
        type: Type.OBJECT,
        properties: {
            name: { type: Type.STRING },
            companyProfile: { type: Type.STRING },
            currentPrice: { type: Type.NUMBER },
            dayChange: { type: Type.NUMBER, nullable: true },
            dayChangePercent: { type: Type.NUMBER, nullable: true },
            marketCap: { type: Type.STRING, nullable: true },
            peRatio: { type: Type.NUMBER, nullable: true },
            dividendYield: { type: Type.NUMBER, nullable: true },
            fiftyTwoWeekLow: { type: Type.NUMBER, nullable: true },
            fiftyTwoWeekHigh: { type: Type.NUMBER, nullable: true },
            news: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        source: { type: Type.STRING },
                        url: { type: Type.STRING, nullable: true },
                        publishedAt: { type: Type.STRING },
                    }
                }
            },
            priceHistory: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        date: { type: Type.STRING, description: "Date in YYYY-MM-DD format" },
                        close: { type: Type.NUMBER }
                    }
                }
            },
        }
    };

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: schema,
            },
        });

        const text = response.text;
        if (!text) {
            console.error("No text in Gemini response for ticker details:", ticker);
            return null;
        }
        return JSON.parse(text) as TickerDetails;

    } catch (error) {
        console.error(`Error fetching ticker details for ${ticker} from Gemini API:`, error);
        throw new Error(`Failed to fetch details for ${ticker}.`);
    }
};

export const generatePriceChartSvg = async (priceHistory: TickerPriceHistory[], ticker: string): Promise<string | null> => {
    if (!isApiKeyConfigured || priceHistory.length < 2) return null;
    
    const prompt = `Generate an SVG line chart for the stock price history of ${ticker}.
The data represents the closing price for the last 365 days.
Data: ${JSON.stringify(priceHistory.map(p => p.close))}
The SVG element should have width="100%" and height="300".
The background should be transparent. Do not add a <rect> for the background.
The line should be stroked with a linear gradient. The gradient ID should be "priceGradient". The gradient should go from #4F46E5 (at the start of the timeline) to #10B981 (at the end).
The stroke width of the line should be 2.
Add a subtle, light gray (e.g., #4B5563) dashed grid with 4 horizontal lines in the background.
Do not include any axes, labels, text, or circles on the data points. Only the gradient definition, the grid lines, and the price path.
The SVG path should be scaled to fit the entire viewbox of the SVG.`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });

        const text = response.text;
        if (!text) {
            console.error("No text in Gemini response for price chart SVG for:", ticker);
            return null;
        }
        
        // Gemini might wrap the SVG in markdown, so we extract it.
        const svgMatch = text.match(/<svg.*?>.*?<\/svg>/s);
        return svgMatch ? svgMatch[0] : text;

    } catch (error) {
        console.error(`Error generating chart for ${ticker} from Gemini API:`, error);
        return null;
    }
}

export const fetchCadToUsdRate = async (): Promise<number | null> => {
    if (!isApiKeyConfigured) return null;
    const prompt = "What is the current exchange rate for converting Canadian Dollars (CAD) to US Dollars (USD)? Provide only the numeric value.";
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
        if (!text) {
            console.error("No text in Gemini response for CAD to USD rate.");
            return null;
        }
        const rate = parseFloat(text.trim());
        return isNaN(rate) ? null : rate;

    } catch (error) {
        console.error(`Error fetching CAD to USD rate from Gemini API:`, error);
        return null;
    }
};
