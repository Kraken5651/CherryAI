"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Image as ImageIcon, Sparkles, ArrowLeft, Heart, 
  Trash2, Download, Loader2, Search, Filter 
} from "lucide-react";
import Link from "next/link";

const API = "http://localhost:8000/api/gallery";

type ImageRecord = {
  id: number;
  prompt: string;
  filename: string;
  is_favorite: boolean;
  url: string;
};

export default function GalleryPage() {
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [filter, setFilter] = useState<"all" | "favorites">("all");
  const [search, setSearch] = useState("");

  const fetchImages = async () => {
    try {
      const res = await fetch(API);
      const data = await res.json();
      setImages(data);
    } catch (e) {
      console.error("Failed to fetch gallery:", e);
    }
  };

  useEffect(() => {
    fetchImages();
  }, []);

  const generateImage = async () => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);
    try {
      const res = await fetch(`${API}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) throw new Error("Failed to generate");
      const newImg = await res.json();
      setImages([newImg, ...images]);
      setPrompt("");
    } catch (e) {
      alert("Error generating image.");
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleFavorite = async (id: number) => {
    try {
      const res = await fetch(`${API}/${id}/favorite`, { method: "PUT" });
      const { is_favorite } = await res.json();
      setImages(images.map(img => img.id === id ? { ...img, is_favorite } : img));
    } catch (e) {
      console.error("Failed to toggle favorite", e);
    }
  };

  const deleteImage = async (id: number) => {
    if (!confirm("Delete this image?")) return;
    try {
      await fetch(`${API}/${id}`, { method: "DELETE" });
      setImages(images.filter(img => img.id !== id));
    } catch (e) {
      console.error("Failed to delete", e);
    }
  };

  const downloadImage = async (url: string, filename: string) => {
    try {
      const res = await fetch(`http://localhost:8000${url}`);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
    } catch (e) {
      console.error("Failed to download", e);
    }
  };

  const filteredImages = images.filter(img => {
    if (filter === "favorites" && !img.is_favorite) return false;
    if (search && !img.prompt.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-screen bg-dark-900 text-gray-100 overflow-hidden">
      {/* Header */}
      <header className="h-16 border-b border-cherry-900/30 bg-dark-800/80 backdrop-blur-md flex items-center px-4 shrink-0 z-10 gap-4">
        <Link href="/" className="p-2 rounded-lg hover:bg-dark-700 transition-colors text-gray-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-cherry-400" />
          <h1 className="font-bold text-lg tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">
            Image Gallery
          </h1>
        </div>
      </header>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Background Glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[20%] left-[20%] w-[40%] h-[40%] bg-cherry-900/5 rounded-full blur-[120px]" />
        </div>

        {/* Top Controls */}
        <div className="p-6 shrink-0 z-10 space-y-6 max-w-7xl mx-auto w-full">
          {/* Generation Input */}
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-cherry-600/0 via-cherry-600/30 to-cherry-600/0 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition duration-500"></div>
            <div className="relative flex items-center gap-2 bg-dark-800/90 backdrop-blur-xl border border-gray-700/50 focus-within:border-cherry-500/50 rounded-2xl p-2 transition-all shadow-lg">
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && generateImage()}
                placeholder="Describe an image to generate..."
                className="flex-1 bg-transparent text-gray-100 placeholder-gray-500 px-4 py-2 focus:outline-none"
              />
              <button
                onClick={generateImage}
                disabled={isGenerating || !prompt.trim()}
                className="flex items-center gap-2 px-6 py-3 bg-cherry-600 hover:bg-cherry-500 disabled:opacity-50 text-white rounded-xl transition-all shadow-[0_0_15px_rgba(225,29,72,0.3)] hover:shadow-[0_0_25px_rgba(225,29,72,0.5)]"
              >
                {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                Generate
              </button>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row items-center gap-4 justify-between">
            <div className="flex items-center gap-2 bg-dark-800/80 p-1 rounded-xl border border-gray-700/30">
              <button
                onClick={() => setFilter("all")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filter === "all" ? "bg-cherry-600 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                All Images
              </button>
              <button
                onClick={() => setFilter("favorites")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filter === "favorites" ? "bg-cherry-600 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                <Heart className="w-4 h-4" /> Favorites
              </button>
            </div>
            
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search prompts..."
                className="w-full bg-dark-800/80 border border-gray-700/30 rounded-xl pl-9 pr-4 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cherry-500/50 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Gallery Grid */}
        <div className="flex-1 overflow-y-auto p-6 pt-0 z-10">
          {filteredImages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 opacity-50">
              <ImageIcon className="w-12 h-12 text-gray-500 mb-4" />
              <p>No images found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto w-full pb-10">
              <AnimatePresence>
                {filteredImages.map((img) => (
                  <motion.div
                    key={img.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="group relative aspect-square rounded-2xl overflow-hidden bg-dark-800 border border-cherry-900/30"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`http://localhost:8000${img.url}`}
                      alt={img.prompt}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                    
                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-dark-900 via-dark-900/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                      <p className="text-white text-sm font-medium line-clamp-3 mb-4 drop-shadow-md">
                        {img.prompt}
                      </p>
                      
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => toggleFavorite(img.id)}
                          className={`p-2 rounded-lg backdrop-blur-md transition-all ${
                            img.is_favorite 
                              ? "bg-cherry-500/20 text-cherry-400 border border-cherry-500/30" 
                              : "bg-dark-800/50 text-gray-300 hover:bg-dark-700 border border-transparent"
                          }`}
                        >
                          <Heart className={`w-4 h-4 ${img.is_favorite ? "fill-current" : ""}`} />
                        </button>
                        <button
                          onClick={() => downloadImage(img.url, img.filename)}
                          className="p-2 rounded-lg bg-dark-800/50 text-gray-300 hover:bg-dark-700 backdrop-blur-md transition-colors"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteImage(img.id)}
                          className="p-2 rounded-lg bg-red-900/50 text-red-300 hover:bg-red-800 backdrop-blur-md transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
