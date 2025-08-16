import { GoogleGenAI } from "@google/genai";
import { Exchange } from "../types";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

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

export const fetchCadToUsdRate = async (): Promise<number | null> => {
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