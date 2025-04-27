"use client";

import React, { useState, useEffect, useRef, FormEvent, ChangeEvent } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion } from "framer-motion";
import { Send, Sun, Moon, Bot, FileText } from "lucide-react";

interface Message {
  id: number;
  text: string;
  sender: "user" | "bot" | "typing" | "file";
}

interface APIPart {
  text: string;
}

interface APIContent {
  role: "user" | "model";
  parts: APIPart[];
}

declare global {
  interface Window {
    pdfjsLib: any;
  }
}

const TypingDots: React.FC = () => (
  <div className="flex items-center space-x-1">
    {[0, 0.2, 0.4].map((delay, index) => (
      <motion.span
        key={index}
        className="w-2 h-2 bg-gray-500 dark:bg-gray-300 rounded-full"
        animate={{ y: [0, -4, 0] }}
        transition={{ repeat: Infinity, duration: 0.6, ease: "easeInOut", delay }}
      />
    ))}
  </div>
);

const Chatbot: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>("");
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [pdfContent, setPdfContent] = useState<string>("");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js";
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";
    };
    document.body.appendChild(script);
  }, []);

  // Disable right-click context menu
  useEffect(() => {
    const disableRightClick = (e: MouseEvent) => {
      e.preventDefault();
    };

    document.addEventListener("contextmenu", disableRightClick);

    // Cleanup the event listener on component unmount
    return () => {
      document.removeEventListener("contextmenu", disableRightClick);
    };
  }, []);

  const formatMessagesForAPI = (messages: Message[]): APIContent[] => {
    return messages
      .filter((msg) => msg.sender !== "typing" && msg.sender !== "file")
      .map((msg) => ({
        role: msg.sender === "user" ? "user" : "model",
        parts: [{ text: msg.text }],
      }));
  };

  const handleSend = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() && !pdfContent.trim()) return;

    const newUserMessage: Message = {
      id: Date.now() + Math.random(),
      text: input.trim(),
      sender: "user",
    };

    setMessages((prev) => [
      ...prev,
      newUserMessage,
      { id: Date.now() + Math.random(), text: "", sender: "typing" },
    ]);
    setInput("");

    // Trigger LinkedIn check here
    handleLinkedInRequest(input);

    const fullHistoryForAPI = formatMessagesForAPI([ 
      ...messages, 
      newUserMessage, 
      { id: Date.now() + Math.random(), text: pdfContent, sender: "file" }
    ]);

    if (pdfContent.trim()) {
      fullHistoryForAPI.push({
        role: "user",
        parts: [{ text: pdfContent }],
      });
    }

    try {
      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=AIzaSyBjgD-xKDiuXg3_Fi-3_88jf_nI98rPlVM",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            generationConfig: {
              temperature: 1,
              topP: 0.95,
              topK: 40,
              maxOutputTokens: 8192,
              responseMimeType: "text/plain",
            },
            contents: fullHistoryForAPI,
          }),
        }
      );

      const data = await response.json();
      const botText =
        data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
        "Sorry, I couldn't understand that.";

      const botReply: Message = {
        id: Date.now() + Math.random(),
        text: botText,
        sender: "bot",
      };

      setMessages((prev) => {
        const updated = prev.filter((msg) => msg.sender !== "typing");
        return [...updated, botReply];
      });
    } catch (error) {
      console.error("API Error:", error);
      setMessages((prev) => {
        const updated = prev.filter((msg) => msg.sender !== "typing");
        return [
          ...updated,
          {
            id: Date.now() + Math.random(),
            text: "Something went wrong. Please try again later.",
            sender: "bot",
          },
        ];
      });
    }
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = async () => {
      try {
        const typedArray = new Uint8Array(reader.result as ArrayBuffer);
        const pdf = await window.pdfjsLib.getDocument(typedArray).promise;

        let extractedText = "";

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const content = await page.getTextContent();
          const pageText = content.items.map((item: any) => item.str).join(" ");
          extractedText += pageText + "\n\n";
        }

        console.log("Full PDF Text:", extractedText);
        setPdfContent(extractedText);

        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + Math.random(),
            text: `📄 Uploaded PDF: ${file.name}`,
            sender: "file",
          },
        ]);
      } catch (error) {
        console.error("Error parsing PDF:", error);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  // Add initial greeting message
  useEffect(() => {
    const initialGreetingMessage: Message = {
      id: Date.now(),
      text: "Hi, I am Bidhusekhar, an artificial intelligence chatbot developed by Raunak Das from Kolkata, West Bengal. How can I assist you today?",
      sender: "bot",
    };
    setMessages([initialGreetingMessage]);
  }, []);

  // Handle LinkedIn request
  const handleLinkedInRequest = (text: string) => {
    if (text.toLowerCase().includes("linkedin")) {
      const linkedInMessage: Message = {
        id: Date.now() + Math.random(),
        text: "You can find the developer, Raunak Das's LinkedIn profile here: https://in.linkedin.com/in/raunak-das-681428330",
        sender: "bot",
      };
      setMessages((prev) => [...prev, linkedInMessage]);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gradient-to-br from-sky-100 to-indigo-200 dark:from-gray-900 dark:to-gray-800 transition-colors">
      <Card className="w-full max-w-md rounded-3xl shadow-2xl border-none dark:bg-gray-900">
        <CardContent className="p-0">
          <div className="flex flex-col h-[85vh]">
            {/* Header */}
            <div className="px-6 py-5 flex justify-between items-center bg-white dark:bg-gray-900 rounded-t-3xl border-b border-gray-300 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-600 p-2 rounded-full shadow-lg animate-pulse">
                  <Bot className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-extrabold text-indigo-700 dark:text-white tracking-tight">Bidhusekhar</h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Always here to chat with you</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDarkMode((prev) => !prev)}
                className="text-gray-600 dark:text-gray-300"
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <ScrollArea className="h-full w-full">
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`rounded-2xl px-4 py-3 text-base max-w-[80%] whitespace-pre-line shadow-md mb-4 ${
                      msg.sender === "user"
                        ? "bg-gradient-to-r from-indigo-500 to-indigo-700 text-white self-end ml-auto"
                        : msg.sender === "bot"
                        ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 self-start mr-auto"
                        : msg.sender === "file"
                        ? "bg-yellow-100 dark:bg-yellow-700 text-yellow-900 dark:text-white self-start mr-auto flex items-center gap-2"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 self-start mr-auto italic"
                    }`}
                  >
                    {msg.sender === "typing" ? (
                      <TypingDots />
                    ) : msg.sender === "file" ? (
                      <>
                        <FileText className="w-5 h-5" /> {msg.text}
                      </>
                    ) : (
                      msg.text
                    )}
                  </motion.div>
                ))}
                <div ref={messagesEndRef} />
              </ScrollArea>
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="flex p-4 gap-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-b-3xl">
              <Input
                placeholder="Type something..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="flex-1 border border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:ring-0 shadow-sm bg-white dark:bg-gray-800 dark:text-white"
              />
              <input
                type="file"
                ref={fileInputRef}
                accept="application/pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button type="button" variant="ghost" onClick={triggerFileUpload} className="p-2">
                <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </Button>
              <Button
                type="submit"
                className="gap-1 rounded-full px-4 bg-indigo-600 hover:bg-indigo-700 text-white"
                disabled={!input.trim() && !pdfContent.trim()}
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Chatbot;
