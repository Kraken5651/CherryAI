"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Cpu, Sparkles, Mic, Settings, MoreVertical, BookOpen, Image as ImageIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

type Message = {
  id: string;
  role: "user" | "model";
  parts: string;
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "model",
      parts: "Hello. I am Cherry, your personal AI assistant. All systems are online. How can I assist you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // TTS playback
  const playAudio = async (text: string) => {
    try {
      const res = await fetch("http://localhost:8000/api/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
    } catch (e) {
      console.error("TTS Error", e);
    }
  };

  // STT recording (MediaRecorder -> FastAPI -> Gemini STT)
  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const formData = new FormData();
        formData.append("file", audioBlob, "recording.webm");

        try {
          // Add a temporary loading indicator to the input box
          const oldInput = input;
          setInput("Listening... (Processing)");
          
          const res = await fetch("http://localhost:8000/api/voice/transcribe", {
            method: "POST",
            body: formData,
          });
          
          if (!res.ok) throw new Error("Transcription failed.");
          const data = await res.json();
          
          if (data.text) {
            setInput(oldInput + (oldInput ? " " : "") + data.text);
          } else {
            setInput(oldInput);
          }
        } catch (error) {
          console.error("Transcription failed", error);
          setInput(input); // revert
        } finally {
          // Stop mic tracks
          stream.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied", err);
      alert("Microphone access is required to use voice commands.");
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { id: Date.now().toString(), role: "user", parts: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("http://localhost:8000/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: input,
          history: messages.map(m => ({ role: m.role, parts: m.parts }))
        }),
      });

      if (!response.ok) throw new Error("Failed to connect to Cherry AI core.");

      const data = await response.json();
      
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "model", parts: data.response },
      ]);
      
      // Auto-play TTS
      playAudio(data.response);
      
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "model", parts: "Error: Connection to Cherry AI core failed. Is the backend running?" },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-dark-900 text-gray-100 overflow-hidden selection:bg-cherry-500/30">
      
      {/* Sidebar - Thin, futuristic */}
      <aside className="w-20 lg:w-64 flex flex-col border-r border-cherry-900/30 bg-dark-800/50 backdrop-blur-xl relative z-10">
        <div className="p-4 flex items-center justify-center lg:justify-start gap-3 border-b border-cherry-900/30 h-16">
          <div className="relative">
            <div className="absolute inset-0 bg-cherry-500 rounded-full blur-md opacity-50 animate-pulse"></div>
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cherry-700 to-cherry-400 relative z-10 flex items-center justify-center">
              <Cpu className="w-4 h-4 text-white" />
            </div>
          </div>
          <span className="hidden lg:block font-bold text-lg tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 text-glow">
            CHERRY
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-2">
          <button className="w-full flex items-center gap-3 p-3 rounded-lg bg-cherry-900/20 text-cherry-400 border border-cherry-500/20 transition-all hover:bg-cherry-900/40">
            <Sparkles className="w-5 h-5 shrink-0" />
            <span className="hidden lg:block text-sm font-medium">New Chat</span>
          </button>
          <Link href="/study" className="w-full flex items-center gap-3 p-3 rounded-lg text-gray-400 hover:text-cherry-400 hover:bg-cherry-900/20 transition-all">
            <BookOpen className="w-5 h-5 shrink-0" />
            <span className="hidden lg:block text-sm font-medium">Study Hub</span>
          </Link>
          <Link href="/gallery" className="w-full flex items-center gap-3 p-3 rounded-lg text-gray-400 hover:text-cherry-400 hover:bg-cherry-900/20 transition-all">
            <ImageIcon className="w-5 h-5 shrink-0" />
            <span className="hidden lg:block text-sm font-medium">Gallery</span>
          </Link>
        </nav>

        <div className="p-4 border-t border-cherry-900/30">
          <button className="w-full flex items-center justify-center lg:justify-start gap-3 p-2 rounded-lg text-gray-400 hover:text-white hover:bg-dark-700 transition-colors">
            <Settings className="w-5 h-5" />
            <span className="hidden lg:block text-sm font-medium">System Core</span>
          </button>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col relative">
        {/* Subtle Background Glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-cherry-900/10 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-cherry-900/10 rounded-full blur-[120px]"></div>
        </div>

        {/* Top Header */}
        <header className="h-16 border-b border-cherry-900/20 flex items-center justify-between px-6 bg-dark-900/80 backdrop-blur-md relative z-10">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cherry-500 shadow-[0_0_8px_rgba(244,63,94,0.8)] animate-pulse"></div>
            <span className="text-sm font-medium text-gray-300">Model: Gemini 2.5 Flash</span>
          </div>
          <button className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-dark-800 transition-colors">
            <MoreVertical className="w-5 h-5" />
          </button>
        </header>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scroll-smooth z-10">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-4 max-w-4xl mx-auto ${
                  msg.role === "user" ? "flex-row-reverse" : "flex-row"
                }`}
              >
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  msg.role === "user" 
                    ? "bg-dark-700 border border-gray-600" 
                    : "bg-cherry-950 border border-cherry-700 box-glow"
                }`}>
                  {msg.role === "user" ? (
                    <User className="w-4 h-4 text-gray-300" />
                  ) : (
                    <Bot className="w-4 h-4 text-cherry-400" />
                  )}
                </div>

                {/* Message Bubble */}
                <div className={`px-5 py-3 rounded-2xl max-w-[85%] leading-relaxed ${
                  msg.role === "user"
                    ? "bg-dark-700 text-gray-100 rounded-tr-sm"
                    : "glass text-gray-200 rounded-tl-sm border-cherry-900/50"
                }`}>
                  <p className="whitespace-pre-wrap">{msg.parts}</p>
                </div>
              </motion.div>
            ))}
            
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-4 max-w-4xl mx-auto flex-row"
              >
                <div className="w-8 h-8 rounded-full bg-cherry-950 border border-cherry-700 box-glow flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-cherry-400" />
                </div>
                <div className="px-5 py-4 rounded-2xl glass rounded-tl-sm flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-cherry-500 animate-bounce" style={{ animationDelay: "0ms" }}></div>
                  <div className="w-2 h-2 rounded-full bg-cherry-500 animate-bounce" style={{ animationDelay: "150ms" }}></div>
                  <div className="w-2 h-2 rounded-full bg-cherry-500 animate-bounce" style={{ animationDelay: "300ms" }}></div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={endOfMessagesRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 sm:p-6 bg-gradient-to-t from-dark-900 via-dark-900/90 to-transparent z-10">
          <div className="max-w-4xl mx-auto relative group">
            {/* Glowing border effect */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-cherry-600/0 via-cherry-600/30 to-cherry-600/0 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition duration-500"></div>
            
            <div className="relative flex items-end gap-2 bg-dark-800/90 backdrop-blur-xl border border-gray-700/50 focus-within:border-cherry-500/50 rounded-2xl p-2 transition-all">
              
              {/* Voice Recording Overlay */}
              {isRecording && (
                <div className="absolute -top-16 left-0 right-0 flex items-center justify-center gap-3 bg-dark-800/90 backdrop-blur-md p-3 rounded-2xl border border-cherry-500/30 box-glow z-20">
                  <div className="flex items-center gap-1">
                    <motion.div animate={{ height: [10, 24, 10] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-1.5 bg-cherry-500 rounded-full" />
                    <motion.div animate={{ height: [10, 32, 10] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-1.5 bg-cherry-500 rounded-full" />
                    <motion.div animate={{ height: [10, 16, 10] }} transition={{ repeat: Infinity, duration: 0.5 }} className="w-1.5 bg-cherry-500 rounded-full" />
                    <motion.div animate={{ height: [10, 28, 10] }} transition={{ repeat: Infinity, duration: 0.7 }} className="w-1.5 bg-cherry-500 rounded-full" />
                  </div>
                  <span className="text-cherry-400 font-medium animate-pulse">Listening... Click Mic to finish</span>
                </div>
              )}
              
              <button 
                onClick={toggleRecording}
                className={`p-3 rounded-xl transition-colors relative z-30 ${
                  isRecording 
                    ? "text-white bg-cherry-600 animate-pulse box-glow" 
                    : "text-gray-400 hover:text-cherry-400 hover:bg-cherry-950/50"
                }`}
              >
                <Mic className="w-5 h-5" />
              </button>
              
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={isRecording}
                placeholder={isRecording ? "Recording your voice..." : "Message Cherry..."}
                className="flex-1 bg-transparent text-gray-100 placeholder-gray-500 resize-none max-h-48 min-h-[44px] py-3 px-2 focus:outline-none disabled:opacity-50"
                rows={1}
              />

              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="p-3 bg-cherry-600 hover:bg-cherry-500 disabled:opacity-50 disabled:hover:bg-cherry-600 text-white rounded-xl transition-all shadow-[0_0_15px_rgba(225,29,72,0.3)] hover:shadow-[0_0_25px_rgba(225,29,72,0.5)]"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <div className="text-center mt-2 text-xs text-gray-500">
              Cherry AI Core can make mistakes. Consider verifying important information.
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
