
import React, { useState, useEffect, useCallback } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { staticNews } from '../data/news/staticNews';
import { Loader2, RefreshCcw, AlertTriangle } from 'lucide-react';

interface NewsItem {
  headline: string;
  summary: string;
  url: string;
}

export const NewsUpdates: React.FC = () => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNews = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const prompt = `Fetch the most recent CMMC-related news from ONLY reputable .gov domains, such as defense.gov, acquisition.gov, dodcio.defense.gov, etc. Return 3–6 items in JSON with fields: - headline - summary (2–3 sentences) - url (must be a working .gov link) ONLY include news from the last 90 days. Do NOT fabricate URLs — verify they exist.`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              news: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    headline: { type: Type.STRING },
                    summary: { type: Type.STRING },
                    url: { type: Type.STRING },
                  },
                  required: ["headline", "summary", "url"],
                }
              }
            },
            required: ["news"],
          }
        }
      });
      
      const jsonText = response.text;
      if (!jsonText) {
          throw new Error("Empty response from AI.");
      }
      
      const result = JSON.parse(jsonText);
      
      if (result && Array.isArray(result.news)) {
        setNews(result.news);
      } else {
        throw new Error("Invalid JSON structure received from AI.");
      }
    } catch (e) {
      console.error("Failed to fetch fresh news:", e);
      setError("Unable to fetch fresh news — showing archived updates.");
      setNews(staticNews);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-white p-6 rounded-lg shadow-md border flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Latest CMMC News</h1>
          <p className="text-gray-600 mt-1">Verified .gov Sources</p>
        </div>
        <button
          onClick={fetchNews}
          disabled={isLoading}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-wait"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
          ) : (
            <RefreshCcw className="h-5 w-5 mr-2" />
          )}
          {isLoading ? 'Refreshing...' : 'Refresh News'}
        </button>
      </div>
      
      {error && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-lg flex items-center">
          <AlertTriangle className="h-5 w-5 mr-3" />
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
          <p className="mt-2 text-gray-500">Fetching latest updates...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {news.map((item, index) => (
            <div key={index} className="bg-white shadow-md rounded-lg p-6 border border-gray-200">
              <h3 className="font-bold text-lg text-gray-800 mb-2">{item.headline}</h3>
              <p className="text-sm text-gray-600 mb-4">{item.summary}</p>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 transition-colors"
              >
                Read Full Article
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
