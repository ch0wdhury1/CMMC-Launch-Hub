
import React, { useState, useEffect, useRef } from 'react';
import { Practice } from '../types';
import {
  X,
  Send,
  Volume2,
  FileQuestion,
  MessageSquare,
  Loader2
} from 'lucide-react';
import {
  getPracticeExplanation,
  getExplanationAudio,
  getArtifactSuggestions,
  startChatStream
} from '../services/geminiService';
import { GenerateContentResponse } from '@google/genai';

interface AssistMePanelProps {
  isOpen: boolean;
  onClose: () => void;
  practice: Practice;
}

type ChatMessage = {
  role: 'user' | 'model';
  text: string;
};

export const AssistMePanel: React.FC<AssistMePanelProps> = ({
  isOpen,
  onClose,
  practice
}) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'artifacts'>('chat');
  const [explanation, setExplanation] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');

  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isToolsLoading, setIsToolsLoading] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);

  const chatContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  };

  useEffect(scrollToBottom, [chatHistory]);

  useEffect(() => {
    if (isOpen) {
      // Reset state when panel is opened for a new practice
      setActiveTab('chat');
      setExplanation('');
      setSuggestions([]);
      setChatHistory([]);
      setUserInput('');
      setIsChatLoading(false);
      setIsToolsLoading(false);
      setIsAudioLoading(false);
    }
  }, [isOpen, practice]);

  /* ============================
     Plain Language Explanation
  ============================= */
  const handleGetExplanation = async () => {
    setIsToolsLoading(true);
    try {
      const result = await getPracticeExplanation(practice);
      setExplanation(result);
    } catch (error) {
      console.error(error);
      setExplanation('Sorry, I could not generate an explanation.');
    } finally {
      setIsToolsLoading(false);
    }
  };

  /* ============================
     Explanation Audio
  ============================= */
  const handlePlayAudio = async () => {
    if (!explanation) return; // Only play if explanation exists

    setIsAudioLoading(true);
    try {
      await getExplanationAudio(explanation);
    } catch (error) {
      console.error('Error playing audio', error);
      alert('Could not play audio.');
    } finally {
      setIsAudioLoading(false);
    }
  };

  /* ============================
     Suggested Artifacts
  ============================= */
  const handleGetSuggestions = async () => {
    setIsToolsLoading(true);
    try {
      const result = await getArtifactSuggestions(practice);
      setSuggestions(result);
    } catch (error) {
      console.error(error);
      setSuggestions(['Sorry, I could not generate suggestions.']);
    } finally {
      setIsToolsLoading(false);
    }
  };

  /* ============================
     Chat (Streaming)
  ============================= */
  const handleSendMessage = async () => {
    if (!userInput.trim() || isChatLoading) return;

    const newUserMessage: ChatMessage = { role: 'user', text: userInput };
    const updatedHistory = [...chatHistory, newUserMessage];
    setChatHistory(updatedHistory);
    setUserInput('');
    setIsChatLoading(true);

    let modelResponse = '';

    // Add placeholder model message at the end
    setChatHistory(prev => [...prev, { role: 'model', text: '' }]);

    try {
      const stream = await startChatStream(practice, updatedHistory, userInput);

      for await (const chunk of stream) {
        const c = chunk as GenerateContentResponse;
        modelResponse += c.text;

        // Update placeholder (last message) as streaming text arrives
        setChatHistory(prev =>
          prev.map((msg, index) =>
            index === prev.length - 1 ? { ...msg, text: modelResponse } : msg
          )
        );
      }
    } catch (error) {
      console.error('Chat error:', error);
      setChatHistory(prev =>
        prev.map((msg, index) =>
          index === prev.length - 1
            ? { ...msg, text: 'Sorry, something went wrong.' }
            : msg
        )
      );
    } finally {
      setIsChatLoading(false);
    }
  };

  if (!isOpen) return null;

  const lastMsg = chatHistory.length > 0 ? chatHistory[chatHistory.length - 1] : null;
  const isShowingTypingBubble =
    isChatLoading && lastMsg && lastMsg.role === 'user';

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out translate-x-0">
      <div className="flex flex-col h-full">
        {/* HEADER */}
        <header className="p-4 bg-gray-800 text-white flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold">AI Assistant</h2>
            <p className="text-sm text-gray-300">{practice.id}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-white"
          >
            <X className="h-6 w-6" />
          </button>
        </header>

        {/* TABS */}
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-3 text-sm font-medium text-center border-b-2 ${
                activeTab === 'chat'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <MessageSquare className="h-5 w-5 mx-auto mb-1" /> Chat
            </button>
            <button
              onClick={() => setActiveTab('artifacts')}
              className={`flex-1 py-3 text-sm font-medium text-center border-b-2 ${
                activeTab === 'artifacts'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FileQuestion className="h-5 w-5 mx-auto mb-1" /> Quick Tools
            </button>
          </nav>
        </div>

        {/* CHAT TAB */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col p-4 overflow-hidden">
            <div
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto space-y-4 pr-2"
            >
              {chatHistory.length === 0 && (
                <div className="text-center text-gray-500 p-4 rounded-lg bg-gray-50">
                  <p className="font-medium">
                    Ask me anything about {practice.id}.
                  </p>
                  <p className="text-xs mt-2">
                    For example: &quot;What kind of evidence would satisfy these
                    objectives?&quot; or &quot;Summarize the key
                    references.&quot;
                  </p>
                </div>
              )}

              {chatHistory.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-xs md:max-w-sm rounded-lg px-4 py-2 ${
                      msg.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-800'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>
                </div>
              ))}

              {isShowingTypingBubble && (
                <div className="flex justify-start">
                  <div className="bg-gray-200 text-gray-800 rounded-lg px-4 py-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                </div>
              )}
            </div>

            {/* CHAT INPUT */}
            <div className="mt-4 flex items-center border-t pt-4">
              <input
                type="text"
                value={userInput}
                onChange={e => setUserInput(e.target.value)}
                onKeyDown={e =>
                  e.key === 'Enter' && !isChatLoading && handleSendMessage()
                }
                placeholder="Type your question..."
                className="flex-1 p-2 border border-gray-300 rounded-l-md focus:ring-purple-500 focus:border-purple-500 bg-white text-black"
                disabled={isChatLoading}
              />
              <button
                onClick={handleSendMessage}
                disabled={isChatLoading}
                className="bg-purple-600 text-white p-2 rounded-r-md hover:bg-purple-700 disabled:bg-purple-300"
              >
                <Send className="h-6 w-6" />
              </button>
            </div>
          </div>
        )}

        {/* QUICK TOOLS TAB */}
        {activeTab === 'artifacts' && (
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="space-y-4">
              {/* EXPLANATION */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold mb-2">
                  Plain Language Explanation
                </h3>
                <div className="flex space-x-2 mb-3">
                  <button
                    onClick={handleGetExplanation}
                    disabled={isToolsLoading}
                    className="flex-1 text-sm py-2 px-3 bg-white border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50"
                  >
                    {isToolsLoading && !explanation
                      ? 'Generating...'
                      : 'Explain It'}
                  </button>
                  <button
                    onClick={handlePlayAudio}
                    disabled={isAudioLoading || !explanation}
                    className="flex items-center justify-center p-2 bg-white border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isAudioLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Volume2 className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {isToolsLoading && !explanation && (
                  <p className="text-sm text-center text-gray-500">
                    Generating...
                  </p>
                )}
                {explanation && (
                  <p className="text-sm text-gray-700">{explanation}</p>
                )}
              </div>

              {/* SUGGESTED ARTIFACTS */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold mb-2">Suggested Artifacts</h3>
                <button
                  onClick={handleGetSuggestions}
                  disabled={isToolsLoading}
                  className="w-full text-sm py-2 px-3 bg-white border border-gray-300 rounded-md hover:bg-gray-100 mb-3 disabled:opacity-50"
                >
                  {isToolsLoading && suggestions.length === 0
                    ? 'Generating...'
                    : 'Get Ideas'}
                </button>
                {isToolsLoading && suggestions.length === 0 && (
                  <p className="text-sm text-center text-gray-500">
                    Generating...
                  </p>
                )}
                {suggestions.length > 0 && (
                  <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
                    {suggestions.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};