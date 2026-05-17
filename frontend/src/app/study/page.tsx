"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, FileText, Brain, BookOpen, HelpCircle,
  Sparkles, ArrowLeft, Trash2, Loader2, ChevronRight,
  CheckCircle2, XCircle, RotateCcw
} from "lucide-react";
import Link from "next/link";

const API = "http://localhost:8000/api/study";

type Document = {
  id: string;
  filename: string;
  char_count: number;
  page_count: number | null;
};

type Flashcard = { front: string; back: string };
type QuizItem = { question: string; options: string[]; correct: number; explanation: string };

export default function StudyHub() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"ask" | "summary" | "flashcards" | "quiz">("ask");
  const fileRef = useRef<HTMLInputElement>(null);

  // Results
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [summary, setSummary] = useState("");
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());
  const [quiz, setQuiz] = useState<QuizItem[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // Upload
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API}/upload`, { method: "POST", body: formData });
      if (!res.ok) throw new Error((await res.json()).detail);
      const data = await res.json();
      setDocuments((prev) => [...prev, data]);
    } catch (err: any) {
      alert("Upload failed: " + err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const deleteDoc = async (id: string) => {
    await fetch(`${API}/documents/${id}`, { method: "DELETE" });
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    if (selectedDoc?.id === id) setSelectedDoc(null);
  };

  // Study Actions
  const askQuestion = async () => {
    if (!selectedDoc || !question.trim()) return;
    setLoading(true);
    setAnswer("");
    try {
      const res = await fetch(`${API}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc_id: selectedDoc.id, question }),
      });
      const data = await res.json();
      setAnswer(data.answer);
    } catch { setAnswer("Error getting answer."); }
    finally { setLoading(false); }
  };

  const getSummary = async () => {
    if (!selectedDoc) return;
    setLoading(true);
    setSummary("");
    try {
      const res = await fetch(`${API}/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc_id: selectedDoc.id }),
      });
      const data = await res.json();
      setSummary(data.summary);
    } catch { setSummary("Error generating summary."); }
    finally { setLoading(false); }
  };

  const getFlashcards = async () => {
    if (!selectedDoc) return;
    setLoading(true);
    setFlashcards([]);
    setFlippedCards(new Set());
    try {
      const res = await fetch(`${API}/flashcards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc_id: selectedDoc.id, count: 10 }),
      });
      const data = await res.json();
      setFlashcards(data.flashcards);
    } catch { alert("Error generating flashcards."); }
    finally { setLoading(false); }
  };

  const getQuiz = async () => {
    if (!selectedDoc) return;
    setLoading(true);
    setQuiz([]);
    setSelectedAnswers({});
    setQuizSubmitted(false);
    try {
      const res = await fetch(`${API}/quiz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc_id: selectedDoc.id, count: 5 }),
      });
      const data = await res.json();
      setQuiz(data.quiz);
    } catch { alert("Error generating quiz."); }
    finally { setLoading(false); }
  };

  const toggleFlip = (i: number) => {
    setFlippedCards((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const quizScore = quizSubmitted
    ? quiz.filter((q, i) => selectedAnswers[i] === q.correct).length
    : 0;

  // ── RENDER ─────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-dark-900 text-gray-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-80 flex flex-col border-r border-cherry-900/30 bg-dark-800/50 backdrop-blur-xl">
        {/* Header */}
        <div className="p-4 flex items-center gap-3 border-b border-cherry-900/30 h-16">
          <Link href="/" className="p-2 rounded-lg hover:bg-dark-700 transition-colors text-gray-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <BookOpen className="w-5 h-5 text-cherry-400" />
          <span className="font-bold text-lg tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">
            Study Hub
          </span>
        </div>

        {/* Upload */}
        <div className="p-4 border-b border-cherry-900/30">
          <label className="flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-cherry-500/30 hover:border-cherry-500/60 hover:bg-cherry-950/20 cursor-pointer transition-all">
            {uploading ? (
              <Loader2 className="w-5 h-5 text-cherry-400 animate-spin" />
            ) : (
              <Upload className="w-5 h-5 text-cherry-400" />
            )}
            <span className="text-sm font-medium text-cherry-400">
              {uploading ? "Processing..." : "Upload Document"}
            </span>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.pptx,.ppt,.txt,.md"
              onChange={handleUpload}
              className="hidden"
            />
          </label>
          <p className="text-xs text-gray-500 mt-2 text-center">PDF, PPT, TXT, MD</p>
        </div>

        {/* Document List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {documents.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-8">No documents uploaded yet</p>
          )}
          {documents.map((doc) => (
            <div
              key={doc.id}
              onClick={() => setSelectedDoc(doc)}
              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all group ${
                selectedDoc?.id === doc.id
                  ? "bg-cherry-900/30 border border-cherry-500/30"
                  : "hover:bg-dark-700/50"
              }`}
            >
              <FileText className="w-5 h-5 text-cherry-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.filename}</p>
                <p className="text-xs text-gray-500">
                  {doc.page_count ? `${doc.page_count} pages` : `${Math.round(doc.char_count / 1000)}k chars`}
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); deleteDoc(doc.id); }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-900/30 text-gray-500 hover:text-red-400 transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Background Glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-20%] right-[-10%] w-[40%] h-[40%] bg-cherry-900/10 rounded-full blur-[120px]" />
        </div>

        {!selectedDoc ? (
          /* Empty State */
          <div className="flex-1 flex flex-col items-center justify-center gap-4 z-10">
            <div className="w-20 h-20 rounded-full bg-cherry-950/50 border border-cherry-500/20 flex items-center justify-center box-glow">
              <Brain className="w-10 h-10 text-cherry-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">Study Hub</h2>
            <p className="text-gray-400 max-w-md text-center">
              Upload a PDF, PPT, or text file to get started. Cherry can summarize it,
              answer questions, generate flashcards, and create quizzes.
            </p>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex items-center gap-1 p-4 border-b border-cherry-900/20 z-10 bg-dark-900/80 backdrop-blur-md">
              <span className="text-sm text-gray-400 mr-4 truncate max-w-[200px]">
                📄 {selectedDoc.filename}
              </span>
              {(["ask", "summary", "flashcards", "quiz"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab
                      ? "bg-cherry-600 text-white shadow-[0_0_15px_rgba(225,29,72,0.3)]"
                      : "text-gray-400 hover:text-white hover:bg-dark-700"
                  }`}
                >
                  {tab === "ask" ? "Ask Questions" : tab === "summary" ? "Summarize" : tab === "flashcards" ? "Flashcards" : "Quiz"}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-6 z-10">
              <AnimatePresence mode="wait">
                {/* ASK TAB */}
                {activeTab === "ask" && (
                  <motion.div key="ask" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="max-w-3xl mx-auto space-y-4">
                    <div className="flex gap-2">
                      <input
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && askQuestion()}
                        placeholder="Ask anything about this document..."
                        className="flex-1 bg-dark-800 border border-gray-700/50 rounded-xl px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-cherry-500/50"
                      />
                      <button
                        onClick={askQuestion}
                        disabled={loading || !question.trim()}
                        className="px-6 py-3 bg-cherry-600 hover:bg-cherry-500 disabled:opacity-50 text-white rounded-xl transition-all"
                      >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <HelpCircle className="w-5 h-5" />}
                      </button>
                    </div>
                    {answer && (
                      <div className="glass p-5 rounded-2xl whitespace-pre-wrap leading-relaxed text-gray-200">{answer}</div>
                    )}
                  </motion.div>
                )}

                {/* SUMMARY TAB */}
                {activeTab === "summary" && (
                  <motion.div key="summary" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="max-w-3xl mx-auto space-y-4">
                    {!summary && (
                      <button
                        onClick={getSummary}
                        disabled={loading}
                        className="flex items-center gap-2 px-6 py-3 bg-cherry-600 hover:bg-cherry-500 disabled:opacity-50 text-white rounded-xl transition-all mx-auto"
                      >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                        Generate Summary
                      </button>
                    )}
                    {summary && (
                      <div className="glass p-6 rounded-2xl whitespace-pre-wrap leading-relaxed text-gray-200">{summary}</div>
                    )}
                  </motion.div>
                )}

                {/* FLASHCARDS TAB */}
                {activeTab === "flashcards" && (
                  <motion.div key="flashcards" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="max-w-4xl mx-auto space-y-4">
                    {flashcards.length === 0 && (
                      <button
                        onClick={getFlashcards}
                        disabled={loading}
                        className="flex items-center gap-2 px-6 py-3 bg-cherry-600 hover:bg-cherry-500 disabled:opacity-50 text-white rounded-xl transition-all mx-auto"
                      >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Brain className="w-5 h-5" />}
                        Generate Flashcards
                      </button>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {flashcards.map((card, i) => (
                        <div
                          key={i}
                          onClick={() => toggleFlip(i)}
                          className="glass p-5 rounded-2xl cursor-pointer hover:border-cherry-500/40 transition-all min-h-[140px] flex flex-col justify-center"
                        >
                          <p className="text-xs text-cherry-400 mb-2 font-medium">
                            {flippedCards.has(i) ? "ANSWER" : "QUESTION"} · #{i + 1}
                          </p>
                          <p className="text-gray-200 leading-relaxed">
                            {flippedCards.has(i) ? card.back : card.front}
                          </p>
                          <p className="text-xs text-gray-500 mt-3">Click to flip</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* QUIZ TAB */}
                {activeTab === "quiz" && (
                  <motion.div key="quiz" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="max-w-3xl mx-auto space-y-6">
                    {quiz.length === 0 && (
                      <button
                        onClick={getQuiz}
                        disabled={loading}
                        className="flex items-center gap-2 px-6 py-3 bg-cherry-600 hover:bg-cherry-500 disabled:opacity-50 text-white rounded-xl transition-all mx-auto"
                      >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <HelpCircle className="w-5 h-5" />}
                        Generate Quiz
                      </button>
                    )}
                    {quiz.map((q, qi) => (
                      <div key={qi} className="glass p-5 rounded-2xl space-y-3">
                        <p className="font-medium text-gray-100">Q{qi + 1}. {q.question}</p>
                        <div className="space-y-2">
                          {q.options.map((opt, oi) => {
                            const isSelected = selectedAnswers[qi] === oi;
                            const isCorrect = q.correct === oi;
                            let optionClass = "border-gray-700/50 hover:border-cherry-500/50";
                            if (quizSubmitted) {
                              if (isCorrect) optionClass = "border-green-500/50 bg-green-900/20";
                              else if (isSelected && !isCorrect) optionClass = "border-red-500/50 bg-red-900/20";
                            } else if (isSelected) {
                              optionClass = "border-cherry-500/50 bg-cherry-900/20";
                            }
                            return (
                              <button
                                key={oi}
                                disabled={quizSubmitted}
                                onClick={() => setSelectedAnswers((p) => ({ ...p, [qi]: oi }))}
                                className={`w-full text-left p-3 rounded-xl border transition-all flex items-center gap-3 ${optionClass}`}
                              >
                                {quizSubmitted && isCorrect && <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />}
                                {quizSubmitted && isSelected && !isCorrect && <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
                                <span className="text-sm text-gray-200">{opt}</span>
                              </button>
                            );
                          })}
                        </div>
                        {quizSubmitted && q.explanation && (
                          <p className="text-sm text-gray-400 mt-2 italic">💡 {q.explanation}</p>
                        )}
                      </div>
                    ))}
                    {quiz.length > 0 && !quizSubmitted && (
                      <button
                        onClick={() => setQuizSubmitted(true)}
                        disabled={Object.keys(selectedAnswers).length < quiz.length}
                        className="flex items-center gap-2 px-6 py-3 bg-cherry-600 hover:bg-cherry-500 disabled:opacity-50 text-white rounded-xl transition-all mx-auto"
                      >
                        Submit Quiz
                      </button>
                    )}
                    {quizSubmitted && (
                      <div className="text-center space-y-3">
                        <p className="text-xl font-bold text-white">
                          Score: {quizScore}/{quiz.length} ({Math.round((quizScore / quiz.length) * 100)}%)
                        </p>
                        <button
                          onClick={getQuiz}
                          className="flex items-center gap-2 px-4 py-2 text-sm bg-dark-700 hover:bg-dark-800 text-gray-300 rounded-xl mx-auto transition-all"
                        >
                          <RotateCcw className="w-4 h-4" /> Retry Quiz
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
