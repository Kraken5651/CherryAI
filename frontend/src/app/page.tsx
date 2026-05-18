"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Cpu, Sparkles, Mic, Settings, MoreVertical, BookOpen, Image as ImageIcon, Paperclip, X, Paintbrush, Type, RotateCw, Download, FileText, FolderEdit } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

type Message = {
  id: string;
  role: "user" | "model";
  parts: string;
  imageUrl?: string;
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

  // File Upload and Editing states
  const [selectedFile, setSelectedFile] = useState<{
    original_name: string;
    temp_filename: string;
    file_type: "image" | "pdf";
    text: string;
    url: string;
  } | null>(null);
  
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Modals state
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [showSavedEditsModal, setShowSavedEditsModal] = useState(false);
  
  // Image Editor canvas states
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawColor, setDrawColor] = useState("#f43f5e"); // Cherry Red
  const [brushSize, setBrushSize] = useState(5);
  const [editTool, setEditTool] = useState<"draw" | "text" | "none">("draw");
  const [textToAdd, setTextToAdd] = useState("");
  const [imageRotation, setImageRotation] = useState(0);
  const [imageFilter, setImageFilter] = useState<"none" | "grayscale" | "sepia" | "invert" | "blur">("none");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState("");
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  // Text / PDF Editor states
  const [documentText, setDocumentText] = useState("");
  const [editedFilesList, setEditedFilesList] = useState<any[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

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

  // File Upload Handler
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const res = await fetch("http://localhost:8000/api/chat/upload", {
        method: "POST",
        body: formData
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      
      setSelectedFile({
        original_name: data.original_name,
        temp_filename: data.temp_filename,
        file_type: data.file_type,
        text: data.text,
        url: data.url
      });
    } catch (err) {
      console.error(err);
      alert("Failed to upload file to backend core.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Canvas Drawing Logic
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (editTool !== "draw" || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };
  
  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || editTool !== "draw" || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.strokeStyle = drawColor;
    
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  
  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (editTool !== "text" || !textToAdd || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.font = `${brushSize * 3}px Outfit, Inter, sans-serif`;
    ctx.fillStyle = drawColor;
    ctx.fillText(textToAdd, x, y);
    
    setTextToAdd("");
    setEditTool("none");
  };

  const applyFilter = (filterType: typeof imageFilter) => {
    setImageFilter(filterType);
    const canvas = canvasRef.current;
    if (!canvas || !selectedFile) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      
      if (filterType === "grayscale") ctx.filter = "grayscale(100%)";
      else if (filterType === "sepia") ctx.filter = "sepia(100%)";
      else if (filterType === "invert") ctx.filter = "invert(100%)";
      else if (filterType === "blur") ctx.filter = "blur(4px)";
      else ctx.filter = "none";
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    };
    img.src = `http://localhost:8000/api/chat/temp/${selectedFile.temp_filename}`;
  };

  const handleRotate = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return;
    tempCtx.drawImage(canvas, 0, 0);
    
    canvas.width = tempCanvas.height;
    canvas.height = tempCanvas.width;
    
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((90 * Math.PI) / 180);
    ctx.drawImage(tempCanvas, -tempCanvas.width / 2, -tempCanvas.height / 2);
  };

  // Document AI Assist
  const handleAiDocumentAssist = async (action: string) => {
    setIsAiProcessing(true);
    let prompt = "";
    if (action === "summarize") {
      prompt = `Summarize the following document content clearly and concisely, highlighting key takeaways. Return the summary in markdown format:\n\n${documentText}`;
    } else if (action === "improve") {
      prompt = `Rewrite the following text to make it highly professional, clear, and well-structured. Return ONLY the rewritten text without any chat-like prefix or suffix:\n\n${documentText}`;
    } else if (action === "translate") {
      prompt = `Translate the following text to Spanish, maintaining its format and tone. Return ONLY the translated text without any other remarks:\n\n${documentText}`;
    }
    
    try {
      const response = await fetch("http://localhost:8000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt, history: [] })
      });
      const data = await response.json();
      if (action === "improve" || action === "translate") {
        setDocumentText(data.response);
      } else {
        alert(`AI Document Summary:\n\n${data.response}`);
      }
    } catch (e) {
      console.error(e);
      alert("AI Processing failed");
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleSaveTextDocument = async () => {
    if (!selectedFile) return;
    const originalNameWithoutExt = selectedFile.original_name.replace(/\.[^/.]+$/, "");
    const newFilename = `edited_${originalNameWithoutExt}.txt`;
    const blob = new Blob([documentText], { type: "text/plain;charset=utf-8" });
    
    const formData = new FormData();
    formData.append("file", blob, newFilename);
    formData.append("original_name", newFilename);
    formData.append("file_type", "pdf");
    
    try {
      const res = await fetch("http://localhost:8000/api/chat/save-edited", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      
      const downloadUrl = `http://localhost:8000${data.url}`;
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = newFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "model",
          parts: `I have compiled and saved your edited document as **"${newFilename}"**! It is downloaded locally and saved under Saved Edits in your workspace vault.`,
        }
      ]);
      
      fetchEditedFiles();
      setShowTextEditor(false);
      setSelectedFile(null);
    } catch (e) {
      console.error(e);
      alert("Failed to save document");
    }
  };

  const fetchEditedFiles = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/chat/edited-files");
      if (res.ok) {
        const data = await res.json();
        setEditedFilesList(data);
      }
    } catch (e) {
      console.error("Error fetching edited files", e);
    }
  };

  // Mount hook for fetched edits and canvas load
  useEffect(() => {
    fetchEditedFiles();
  }, []);

  useEffect(() => {
    if (showImageEditor && selectedFile && selectedFile.file_type === "image") {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        
        const maxW = window.innerWidth * 0.6;
        const maxH = window.innerHeight * 0.6;
        let w = img.width;
        let h = img.height;
        
        if (w > maxW) {
          h = (maxW / w) * h;
          w = maxW;
        }
        if (h > maxH) {
          w = (maxH / h) * w;
          h = maxH;
        }
        
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);
      };
      img.src = `http://localhost:8000/api/chat/temp/${selectedFile.temp_filename}`;
    }
  }, [showImageEditor, selectedFile]);

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
        { 
          id: (Date.now() + 1).toString(), 
          role: "model", 
          parts: data.response,
          imageUrl: data.imageUrl
        },
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
          <button
            onClick={() => setShowSavedEditsModal(true)}
            className="w-full flex items-center gap-3 p-3 rounded-lg text-gray-400 hover:text-cherry-400 hover:bg-cherry-900/20 transition-all text-left"
          >
            <FolderEdit className="w-5 h-5 shrink-0" />
            <span className="hidden lg:block text-sm font-medium">Saved Edits</span>
          </button>
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
                  
                  {msg.imageUrl && (
                    <div className="mt-4 relative rounded-xl overflow-hidden border border-cherry-500/20 shadow-[0_0_20px_rgba(244,63,94,0.15)] group max-w-sm sm:max-w-md">
                      <img 
                        src={msg.imageUrl.startsWith("http") ? msg.imageUrl : `http://localhost:8000${msg.imageUrl}`} 
                        alt={msg.parts || "Generated image"} 
                        className="w-full h-auto object-cover rounded-xl transition-all duration-500 group-hover:scale-[1.03]"
                        loading="lazy"
                      />
                      {/* Interactive overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-dark-900/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-between p-3">
                        <span className="text-xs text-white/95 font-medium truncate max-w-[70%]">
                          {msg.parts.split("\"")[1] || "Generated Asset"}
                        </span>
                        <a 
                          href={msg.imageUrl.startsWith("http") ? msg.imageUrl : `http://localhost:8000${msg.imageUrl}`} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="px-2.5 py-1 bg-cherry-600 hover:bg-cherry-500 text-[11px] font-semibold text-white rounded-md transition-all shadow-[0_0_8px_rgba(244,63,94,0.4)]"
                        >
                          View Full
                        </a>
                      </div>
                    </div>
                  )}
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
            
        <div className="relative flex flex-col gap-2 bg-dark-800/90 backdrop-blur-xl border border-gray-700/50 focus-within:border-cherry-500/50 rounded-2xl p-2 transition-all">
          
          {/* Selected File Attachment Card */}
          {selectedFile && (
            <div className="flex items-center justify-between p-3 bg-dark-900/80 rounded-xl border border-cherry-500/20 shadow-md animate-fade-in relative z-20 w-full">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-cherry-950/50 border border-cherry-700/30 flex items-center justify-center">
                  {selectedFile.file_type === "image" ? (
                    <ImageIcon className="w-5 h-5 text-cherry-400" />
                  ) : (
                    <FileText className="w-5 h-5 text-cherry-400" />
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-gray-200 truncate max-w-[180px] sm:max-w-[360px]">
                    {selectedFile.original_name}
                  </h4>
                  <p className="text-[9px] text-gray-400 uppercase tracking-wider font-bold">
                    {selectedFile.file_type} File
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (selectedFile.file_type === "image") {
                      setShowImageEditor(true);
                    } else {
                      setDocumentText(selectedFile.text);
                      setShowTextEditor(true);
                    }
                  }}
                  className="px-3 py-1.5 bg-cherry-600/20 hover:bg-cherry-600 text-cherry-400 hover:text-white text-xs font-medium rounded-lg border border-cherry-500/30 transition-all flex items-center gap-1 shadow-[0_0_10px_rgba(244,63,94,0.1)]"
                >
                  <Paintbrush className="w-3.5 h-3.5" />
                  <span>Edit File</span>
                </button>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="p-1.5 text-gray-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <div className="flex items-end gap-2 w-full">
          
          {/* Invisible file input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".pdf, image/*"
            className="hidden"
          />

          {/* Attach File Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="p-3 text-gray-400 hover:text-cherry-400 hover:bg-cherry-950/50 rounded-xl transition-colors relative z-30"
          >
            <Paperclip className="w-5 h-5" />
          </button>

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
            </div>
            <div className="text-center mt-2 text-xs text-gray-500">
              Cherry AI Core can make mistakes. Consider verifying important information.
            </div>
          </div>
        </div>

      </main>

      {/* 🎨 Dynamic Image Canvas Editor Modal */}
      {showImageEditor && selectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark-950/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="w-full max-w-4xl bg-dark-900 border border-cherry-500/30 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[85vh]">
            
            <div className="px-6 py-4 border-b border-cherry-950/40 bg-dark-950/50 flex items-center justify-between">
               <div className="flex items-center gap-2">
                 <Paintbrush className="w-5 h-5 text-cherry-400" />
                 <h3 className="font-bold text-lg text-white">Edit Image: {selectedFile.original_name}</h3>
               </div>
               <button 
                 onClick={() => setShowImageEditor(false)}
                 className="p-2 text-gray-400 hover:text-white hover:bg-dark-800 rounded-full transition-colors"
               >
                 <X className="w-5 h-5" />
               </button>
            </div>
            
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-dark-950">
               <div className="flex-1 flex items-center justify-center p-6 overflow-auto border-r border-cherry-950/20 relative">
                 <canvas 
                   ref={canvasRef}
                   onMouseDown={startDrawing}
                   onMouseMove={draw}
                   onMouseUp={stopDrawing}
                   onMouseLeave={stopDrawing}
                   onClick={handleCanvasClick}
                   className="bg-dark-900 rounded-lg shadow-xl cursor-crosshair border border-gray-800 max-w-full max-h-full"
                 />
               </div>
               
               <div className="w-full md:w-80 p-6 flex flex-col gap-5 bg-dark-900 overflow-y-auto border-t md:border-t-0 border-cherry-950/20">
                 <div>
                   <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Editor Tools</h4>
                   <div className="grid grid-cols-2 gap-2">
                     <button
                       onClick={() => setEditTool("draw")}
                       className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all border flex items-center justify-center gap-1.5 ${
                         editTool === "draw"
                           ? "bg-cherry-600 text-white border-cherry-500 shadow-md shadow-cherry-500/20"
                           : "bg-dark-800 text-gray-300 border-gray-700 hover:bg-dark-700"
                       }`}
                     >
                       <Paintbrush className="w-3.5 h-3.5" />
                       Draw
                     </button>
                     <button
                       onClick={() => setEditTool("text")}
                       className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all border flex items-center justify-center gap-1.5 ${
                         editTool === "text"
                           ? "bg-cherry-600 text-white border-cherry-500 shadow-md shadow-cherry-500/20"
                           : "bg-dark-800 text-gray-300 border-gray-700 hover:bg-dark-700"
                       }`}
                     >
                       <Type className="w-3.5 h-3.5" />
                       Add Text
                     </button>
                   </div>
                 </div>

                 {editTool !== "none" && (
                   <div>
                     <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Color Palette</h4>
                     <div className="flex gap-2 flex-wrap">
                       {["#f43f5e", "#3b82f6", "#10b981", "#eab308", "#ffffff", "#000000"].map((c) => (
                         <button
                           key={c}
                           onClick={() => setDrawColor(c)}
                           style={{ backgroundColor: c }}
                           className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                             drawColor === c ? "border-cherry-400 scale-105" : "border-gray-800"
                           }`}
                         />
                       ))}
                     </div>
                   </div>
                 )}

                 <div>
                   <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                     {editTool === "draw" ? "Brush Size" : "Text Size"} ({brushSize}px)
                   </h4>
                   <input 
                     type="range" 
                     min="1" 
                     max="50" 
                     value={brushSize} 
                     onChange={(e) => setBrushSize(parseInt(e.target.value))}
                     className="w-full h-1.5 bg-dark-800 rounded-lg appearance-none cursor-pointer accent-cherry-500"
                   />
                 </div>

                 {editTool === "text" && (
                   <div>
                     <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Text Content</h4>
                     <input 
                       type="text" 
                       placeholder="Type text and click on canvas..." 
                       value={textToAdd}
                       onChange={(e) => setTextToAdd(e.target.value)}
                       className="w-full bg-dark-800 border border-gray-700 focus:border-cherry-500 focus:outline-none rounded-lg p-2.5 text-xs text-gray-100"
                     />
                   </div>
                 )}

                 <div>
                   <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Filters</h4>
                   <div className="grid grid-cols-2 gap-1.5">
                     {["none", "grayscale", "sepia", "invert", "blur"].map((f) => (
                       <button
                         key={f}
                         onClick={() => applyFilter(f as any)}
                         className={`py-1.5 px-2 rounded-md text-[10px] uppercase font-bold border transition-colors ${
                           imageFilter === f
                             ? "bg-cherry-900/30 text-cherry-400 border-cherry-500/50"
                             : "bg-dark-800 text-gray-400 border-gray-800 hover:bg-dark-700"
                         }`}
                       >
                         {f}
                       </button>
                     ))}
                   </div>
                 </div>

                 <div>
                   <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Transform</h4>
                   <button
                     onClick={handleRotate}
                     className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-dark-800 hover:bg-dark-700 border border-gray-700 text-gray-300 flex items-center justify-center gap-1.5"
                   >
                     <RotateCw className="w-3.5 h-3.5" />
                     Rotate 90°
                   </button>
                 </div>
                 
                 <div className="border-t border-cherry-950/20 pt-4 mt-auto">
                   <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1">
                     <Sparkles className="w-3.5 h-3.5 text-cherry-400" />
                     AI Creative Suggestion
                   </h4>
                   <textarea
                     placeholder="Ask Gemini for annotations or creative suggestions..."
                     value={aiPrompt}
                     onChange={(e) => setAiPrompt(e.target.value)}
                     className="w-full bg-dark-800 border border-gray-700 focus:border-cherry-500 focus:outline-none rounded-lg p-2.5 text-xs text-gray-100 resize-none h-16 mb-2"
                   />
                   <button
                     onClick={async () => {
                       if (!aiPrompt.trim()) return;
                       setIsAiProcessing(true);
                       try {
                         const res = await fetch("http://localhost:8000/api/chat", {
                           method: "POST",
                           headers: { "Content-Type": "application/json" },
                           body: JSON.stringify({
                             message: `Give me 3 creative drawing suggestions or annotations for this: ${aiPrompt}`,
                             history: []
                           })
                         });
                         const data = await res.json();
                         setAiSuggestions(data.response);
                       } catch (e) {
                         console.error(e);
                       } finally {
                         setIsAiProcessing(false);
                       }
                     }}
                     disabled={isAiProcessing || !aiPrompt.trim()}
                     className="w-full py-1.5 bg-cherry-600 hover:bg-cherry-500 disabled:opacity-50 text-xs font-bold text-white rounded-lg transition-colors flex items-center justify-center gap-1 shadow-md shadow-cherry-500/25"
                   >
                     {isAiProcessing ? "Analyzing..." : "Ask Cherry AI"}
                   </button>
                   {aiSuggestions && (
                     <div className="mt-2.5 p-2 bg-dark-950 rounded-lg text-[10px] leading-relaxed text-gray-300 border border-cherry-900/25 max-h-32 overflow-y-auto">
                       {aiSuggestions}
                     </div>
                   )}
                 </div>

               </div>
             </div>
             
             <div className="px-6 py-4 border-t border-cherry-950/40 bg-dark-950/50 flex items-center justify-between">
               <button
                 onClick={() => setShowImageEditor(false)}
                 className="px-4 py-2 bg-dark-800 hover:bg-dark-700 text-gray-300 text-sm font-semibold rounded-xl border border-gray-700 transition-colors"
               >
                 Cancel
               </button>
               
               <button
                 onClick={async () => {
                   const canvas = canvasRef.current;
                   if (!canvas || !selectedFile) return;
                   
                   canvas.toBlob(async (blob) => {
                     if (!blob) return;
                     const formData = new FormData();
                     formData.append("file", blob, selectedFile.original_name);
                     formData.append("original_name", `edited_${selectedFile.original_name}`);
                     formData.append("file_type", "image");
                     
                     try {
                       const res = await fetch("http://localhost:8000/api/chat/save-edited", {
                         method: "POST",
                         body: formData
                       });
                       if (!res.ok) throw new Error("Save failed");
                       const data = await res.json();
                       
                       const downloadUrl = `http://localhost:8000${data.url}`;
                       const link = document.createElement("a");
                       link.href = downloadUrl;
                       link.download = `edited_${selectedFile.original_name}`;
                       document.body.appendChild(link);
                       link.click();
                       document.body.removeChild(link);
                       
                       setMessages((prev) => [
                         ...prev,
                         {
                           id: Date.now().toString(),
                           role: "model",
                           parts: `I have compiled, saved, and downloaded your edited image **"edited_${selectedFile.original_name}"**! It has also been saved to your System Vault.`,
                           imageUrl: data.url
                         }
                       ]);
                       
                       fetchEditedFiles();
                       setShowImageEditor(false);
                       setSelectedFile(null);
                     } catch (e) {
                       console.error(e);
                       alert("Failed to save edited image");
                     }
                   }, "image/jpeg", 0.95);
                 }}
                 className="px-5 py-2.5 bg-cherry-600 hover:bg-cherry-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-cherry-500/20 flex items-center gap-1.5 transition-all"
               >
                 <Download className="w-4 h-4" />
                 Save & Download
               </button>
             </div>
             
           </div>
         </div>
       )}

       {/* 📝 Document Text Editor Modal (for PDFs) */}
       {showTextEditor && selectedFile && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark-950/80 backdrop-blur-md p-4 animate-fade-in">
           <div className="w-full max-w-4xl bg-dark-900 border border-cherry-500/30 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[85vh]">
             
             <div className="px-6 py-4 border-b border-cherry-950/40 bg-dark-950/50 flex items-center justify-between">
               <div className="flex items-center gap-2">
                 <FileText className="w-5 h-5 text-cherry-400" />
                 <h3 className="font-bold text-lg text-white">Edit Document Text: {selectedFile.original_name}</h3>
               </div>
               <button 
                 onClick={() => setShowTextEditor(false)}
                 className="p-2 text-gray-400 hover:text-white hover:bg-dark-800 rounded-full transition-colors"
               >
                 <X className="w-5 h-5" />
               </button>
             </div>
             
             <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-dark-950">
               <div className="flex-1 p-6 overflow-hidden flex flex-col border-r border-cherry-950/20">
                 <textarea
                   value={documentText}
                   onChange={(e) => setDocumentText(e.target.value)}
                   className="flex-1 w-full bg-dark-900 border border-gray-800 focus:border-cherry-500 focus:outline-none rounded-xl p-4 text-sm text-gray-100 resize-none font-mono leading-relaxed"
                 />
               </div>
               
               <div className="w-full md:w-80 p-6 flex flex-col gap-5 bg-dark-900 overflow-y-auto">
                 <div>
                   <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1">
                     <Sparkles className="w-3.5 h-3.5 text-cherry-400" />
                     AI Assistant Actions
                   </h4>
                   <p className="text-[10px] text-gray-400 mb-4 leading-relaxed">
                     Use Cherry AI to analyze, improve, or manipulate your document text instantly.
                   </p>
                   
                   <div className="flex flex-col gap-2">
                     <button
                       onClick={() => handleAiDocumentAssist("summarize")}
                       disabled={isAiProcessing || !documentText.trim()}
                       className="py-2.5 px-3 bg-dark-800 hover:bg-dark-700 text-xs font-semibold text-gray-200 border border-gray-700 hover:border-cherry-500/50 rounded-xl transition-all flex items-center gap-2"
                     >
                       <Sparkles className="w-3.5 h-3.5 text-cherry-400" />
                       Summarize Document
                     </button>
                     <button
                       onClick={() => handleAiDocumentAssist("improve")}
                       disabled={isAiProcessing || !documentText.trim()}
                       className="py-2.5 px-3 bg-dark-800 hover:bg-dark-700 text-xs font-semibold text-gray-200 border border-gray-700 hover:border-cherry-500/50 rounded-xl transition-all flex items-center gap-2"
                     >
                       <Sparkles className="w-3.5 h-3.5 text-cherry-400" />
                       Make Tone Professional
                     </button>
                     <button
                       onClick={() => handleAiDocumentAssist("translate")}
                       disabled={isAiProcessing || !documentText.trim()}
                       className="py-2.5 px-3 bg-dark-800 hover:bg-dark-700 text-xs font-semibold text-gray-200 border border-gray-700 hover:border-cherry-500/50 rounded-xl transition-all flex items-center gap-2"
                     >
                       <Sparkles className="w-3.5 h-3.5 text-cherry-400" />
                       Translate to Spanish
                     </button>
                   </div>
                 </div>
                 
                 {isAiProcessing && (
                   <div className="p-4 bg-dark-950 rounded-xl border border-cherry-500/20 text-center animate-pulse">
                     <span className="text-xs text-cherry-400 font-semibold">AI is processing document core...</span>
                   </div>
                 )}
               </div>
             </div>
             
             <div className="px-6 py-4 border-t border-cherry-950/40 bg-dark-950/50 flex items-center justify-between">
               <button
                 onClick={() => setShowTextEditor(false)}
                 className="px-4 py-2 bg-dark-800 hover:bg-dark-700 text-gray-300 text-sm font-semibold rounded-xl border border-gray-700 transition-colors"
               >
                 Cancel
               </button>
               
               <button
                 onClick={handleSaveTextDocument}
                 disabled={!documentText.trim()}
                 className="px-5 py-2.5 bg-cherry-600 hover:bg-cherry-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-cherry-500/20 flex items-center gap-1.5 transition-all"
               >
                 <Download className="w-4 h-4" />
                 Save & Export
               </button>
             </div>
             
           </div>
         </div>
       )}

       {/* 📁 Saved Edits Vault Modal */}
       {showSavedEditsModal && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark-950/80 backdrop-blur-md p-4 animate-fade-in">
           <div className="w-full max-w-2xl bg-dark-900 border border-cherry-500/30 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[70vh]">
             
             <div className="px-6 py-4 border-b border-cherry-950/40 bg-dark-950/50 flex items-center justify-between">
               <div className="flex items-center gap-2">
                 <FolderEdit className="w-5 h-5 text-cherry-400" />
                 <h3 className="font-bold text-lg text-white">System Vault: Saved Edits</h3>
               </div>
               <button 
                 onClick={() => setShowSavedEditsModal(false)}
                 className="p-2 text-gray-400 hover:text-white hover:bg-dark-800 rounded-full transition-colors"
               >
                 <X className="w-5 h-5" />
               </button>
             </div>
             
             <div className="flex-1 p-6 overflow-y-auto space-y-3 bg-dark-950">
               {editedFilesList.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-500">
                   <FolderEdit className="w-12 h-12 text-gray-700 mb-3 animate-pulse" />
                   <p className="text-sm font-medium">No saved files in the vault yet.</p>
                   <p className="text-xs text-gray-600 mt-1">Upload a PDF or image in chat and edit it to save records.</p>
                 </div>
               ) : (
                 editedFilesList.map((file) => (
                   <div 
                     key={file.id} 
                     className="flex items-center justify-between p-4 bg-dark-900 border border-gray-800 hover:border-cherry-500/30 rounded-2xl hover:shadow-[0_0_15px_rgba(244,63,94,0.05)] transition-all animate-fade-in"
                   >
                     <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-xl bg-cherry-950/45 border border-cherry-900/20 flex items-center justify-center shrink-0">
                         {file.file_type === "image" ? (
                           <ImageIcon className="w-5 h-5 text-cherry-400" />
                         ) : (
                           <FileText className="w-5 h-5 text-cherry-400" />
                         )}
                       </div>
                       <div>
                         <h4 className="text-xs font-semibold text-gray-200 truncate max-w-[200px] sm:max-w-[320px]">
                           {file.original_name}
                         </h4>
                         <p className="text-[9px] text-gray-400">
                           Saved: {new Date(file.created_at).toLocaleDateString()}
                         </p>
                       </div>
                     </div>
                     
                     <a
                       href={`http://localhost:8000${file.url}`}
                       download={file.original_name}
                       className="px-3.5 py-2 bg-cherry-600 hover:bg-cherry-500 text-white text-xs font-bold rounded-xl transition-all shadow-[0_0_10px_rgba(244,63,94,0.2)] flex items-center gap-1"
                     >
                       <Download className="w-3.5 h-3.5" />
                       Download
                     </a>
                   </div>
                 ))
               )}
             </div>
             
             <div className="px-6 py-4 border-t border-cherry-950/40 bg-dark-950/50 flex justify-end">
               <button
                 onClick={() => setShowSavedEditsModal(false)}
                 className="px-5 py-2.5 bg-dark-800 hover:bg-dark-700 text-gray-300 text-xs font-bold rounded-xl border border-gray-700 transition-colors"
               >
                 Close Vault
               </button>
             </div>
             
           </div>
         </div>
       )}
     </div>
   );
 }
