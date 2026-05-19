/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar, Clock, Plus, Trash2, Edit3, Save,
  Sparkles, ArrowLeft, Bell, FileText,
  Compass, Gamepad2, Loader2, Wand2, Code,
  PenTool, Check, Copy, Download, Trash, X
} from "lucide-react";
import Link from "next/link";

const API_BASE = "http://localhost:8000/api/productivity";
const CHAT_API = "http://localhost:8000/api/chat";

type Note = {
  id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
};

type Reminder = {
  id: number;
  title: string;
  reminder_time: string;
  is_completed: boolean;
};

type PlannerTask = {
  id: number;
  title: string;
  date: string;
  time_slot: string | null;
  is_completed: boolean;
};

export default function ProductivityHub() {
  const [activeTab, setActiveTab] = useState<"planner" | "notes" | "reminders" | "creator" | "gamedev">("planner");
  const [loading, setLoading] = useState(false);

  // ── DAILY PLANNER STATES ─────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [plannerTasks, setPlannerTasks] = useState<PlannerTask[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskTime, setNewTaskTime] = useState("");

  // ── NOTES STATES ─────────────────────────────────────────────
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [aiNoteSuggestion, setAiNoteSuggestion] = useState("");

  // ── REMINDERS STATES ─────────────────────────────────────────
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [newReminderTitle, setNewReminderTitle] = useState("");
  const [newReminderTime, setNewReminderTime] = useState("");

  // ── CREATOR & GAME DEV STATES ────────────────────────────────
  const [specializedInput, setSpecializedInput] = useState("");
  const [specializedOutput, setSpecializedOutput] = useState("");
  const [activePreset, setActivePreset] = useState<string>("");
  const [isCopying, setIsCopying] = useState(false);

  // ── API INTEGRATION ──────────────────────────────────────────

  const fetchPlannerTasks = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/planner?date=${selectedDate}`);
      if (res.ok) {
        const data = await res.json();
        setPlannerTasks(data);
      }
    } catch (e) {
      console.error("Error fetching planner tasks:", e);
    }
  }, [selectedDate]);

  const addPlannerTask = async () => {
    if (!newTaskTitle.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/planner`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          date: selectedDate,
          time_slot: newTaskTime || null,
        }),
      });
      if (res.ok) {
        setNewTaskTitle("");
        setNewTaskTime("");
        fetchPlannerTasks();
      }
    } catch (e) {
      console.error("Error adding task:", e);
    }
  };

  const togglePlannerTask = async (task: PlannerTask) => {
    try {
      await fetch(`${API_BASE}/planner/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_completed: !task.is_completed }),
      });
      fetchPlannerTasks();
    } catch (e) {
      console.error("Error toggling task:", e);
    }
  };

  const deletePlannerTask = async (id: number) => {
    try {
      await fetch(`${API_BASE}/planner/${id}`, { method: "DELETE" });
      fetchPlannerTasks();
    } catch (e) {
      console.error("Error deleting task:", e);
    }
  };

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/notes`);
      if (res.ok) {
        const data = await res.json();
        setNotes(data);
      }
    } catch (e) {
      console.error("Error fetching notes:", e);
    }
  }, []);

  const handleSelectNote = (note: Note) => {
    setSelectedNote(note);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setIsEditingNote(false);
    setAiNoteSuggestion("");
  };

  const handleCreateNewNote = () => {
    setSelectedNote(null);
    setNoteTitle("Untitled Note");
    setNoteContent("");
    setIsEditingNote(true);
    setAiNoteSuggestion("");
  };

  const saveNote = async () => {
    if (!noteTitle.trim()) return;
    try {
      let res;
      if (selectedNote) {
        // Update Note
        res = await fetch(`${API_BASE}/notes/${selectedNote.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: noteTitle, content: noteContent }),
        });
      } else {
        // Create Note
        res = await fetch(`${API_BASE}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: noteTitle, content: noteContent }),
        });
      }
      if (res.ok) {
        const saved = await res.json();
        setIsEditingNote(false);
        fetchNotes();
        setSelectedNote(saved);
      }
    } catch (e) {
      console.error("Error saving note:", e);
    }
  };

  const deleteNote = async (id: number) => {
    if (!confirm("Are you sure you want to delete this note?")) return;
    try {
      const res = await fetch(`${API_BASE}/notes/${id}`, { method: "DELETE" });
      if (res.ok) {
        setSelectedNote(null);
        setNoteTitle("");
        setNoteContent("");
        fetchNotes();
      }
    } catch (e) {
      console.error("Error deleting note:", e);
    }
  };

  const handleAiNoteAssist = async (action: string) => {
    if (!noteContent.trim()) return;
    setLoading(true);
    setAiNoteSuggestion("");

    let prompt = "";
    if (action === "summarize") {
      prompt = `Summarize the following note clearly and concisely, using bullet points:\n\n${noteContent}`;
    } else if (action === "outline") {
      prompt = `Generate a structured hierarchical outline based on this note content:\n\n${noteContent}`;
    } else if (action === "improve") {
      prompt = `Rewrite the following note to improve grammar, flow, and professional tone. Keep the core information intact:\n\n${noteContent}`;
    } else if (action === "actions") {
      prompt = `Identify any actionable tasks or checklists from the following note content:\n\n${noteContent}`;
    }

    try {
      const res = await fetch(CHAT_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt, history: [] }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiNoteSuggestion(data.response);
      }
    } catch (e) {
      console.error("AI assistant error:", e);
      setAiNoteSuggestion("Connection to Cherry AI core failed.");
    } finally {
      setLoading(false);
    }
  };

  const fetchReminders = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/reminders`);
      if (res.ok) {
        const data = await res.json();
        setReminders(data);
      }
    } catch (e) {
      console.error("Error fetching reminders:", e);
    }
  }, []);

  const addReminder = async () => {
    if (!newReminderTitle.trim() || !newReminderTime) return;
    try {
      const res = await fetch(`${API_BASE}/reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newReminderTitle.trim(),
          reminder_time: new Date(newReminderTime).toISOString(),
        }),
      });
      if (res.ok) {
        setNewReminderTitle("");
        setNewReminderTime("");
        fetchReminders();
      }
    } catch (e) {
      console.error("Error adding reminder:", e);
    }
  };

  const toggleReminder = async (reminder: Reminder) => {
    try {
      await fetch(`${API_BASE}/reminders/${reminder.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_completed: !reminder.is_completed }),
      });
      fetchReminders();
    } catch (e) {
      console.error("Error toggling reminder:", e);
    }
  };

  const deleteReminder = async (id: number) => {
    try {
      await fetch(`${API_BASE}/reminders/${id}`, { method: "DELETE" });
      fetchReminders();
    } catch (e) {
      console.error("Error deleting reminder:", e);
    }
  };

  // ── SPECIALIZED AI ASSISTANTS (CREATOR & GAME DEV) ────────────

  const handleSpecializedQuery = async (systemPersona: string) => {
    if (!specializedInput.trim()) return;
    setLoading(true);
    setSpecializedOutput("");

    const fullMessage = `SYSTEM DIRECTIVE: ${systemPersona}\n\nUSER PROMPT: ${specializedInput}`;

    try {
      const res = await fetch(CHAT_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: fullMessage, history: [] }),
      });
      if (res.ok) {
        const data = await res.json();
        setSpecializedOutput(data.response);
      } else {
        setSpecializedOutput("System core returned an error. Check backend console.");
      }
    } catch (e) {
      console.error(e);
      setSpecializedOutput("Failed to connect to Cherry AI engine.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(specializedOutput);
    setIsCopying(true);
    setTimeout(() => setIsCopying(false), 2000);
  };

  const downloadText = (title: string, text: string) => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${title.toLowerCase().replace(/\s+/g, "_")}.txt`;
    link.click();
  };

  // Fetch all initial data
  useEffect(() => {
    fetchPlannerTasks();
  }, [fetchPlannerTasks]);

  useEffect(() => {
    fetchNotes();
    fetchReminders();
  }, [fetchNotes, fetchReminders]);

  return (
    <div className="flex h-screen bg-dark-900 text-gray-100 overflow-hidden">
      
      {/* Sidebar Navigation */}
      <aside className="w-80 flex flex-col border-r border-cherry-900/30 bg-dark-800/50 backdrop-blur-xl">
        <div className="p-4 flex items-center gap-3 border-b border-cherry-900/30 h-16 shrink-0">
          <Link href="/" className="p-2 rounded-lg hover:bg-dark-700 transition-colors text-gray-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Compass className="w-5 h-5 text-cherry-400 animate-spin-slow" />
          <span className="font-bold text-lg tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">
            Productivity Hub
          </span>
        </div>

        {/* Tab Items */}
        <nav className="p-4 space-y-1.5 flex-1 overflow-y-auto">
          <button
            onClick={() => setActiveTab("planner")}
            className={`w-full flex items-center gap-3 p-3.5 rounded-xl text-left transition-all ${
              activeTab === "planner"
                ? "bg-cherry-900/30 text-cherry-400 border border-cherry-500/20 shadow-[0_0_15px_rgba(244,63,94,0.05)]"
                : "text-gray-400 hover:text-cherry-400 hover:bg-cherry-950/10"
            }`}
          >
            <Calendar className="w-5 h-5" />
            <span className="text-sm font-semibold">Daily Planner</span>
          </button>
          
          <button
            onClick={() => setActiveTab("notes")}
            className={`w-full flex items-center gap-3 p-3.5 rounded-xl text-left transition-all ${
              activeTab === "notes"
                ? "bg-cherry-900/30 text-cherry-400 border border-cherry-500/20 shadow-[0_0_15px_rgba(244,63,94,0.05)]"
                : "text-gray-400 hover:text-cherry-400 hover:bg-cherry-950/10"
            }`}
          >
            <FileText className="w-5 h-5" />
            <span className="text-sm font-semibold">Notes Vault</span>
          </button>

          <button
            onClick={() => setActiveTab("reminders")}
            className={`w-full flex items-center gap-3 p-3.5 rounded-xl text-left transition-all ${
              activeTab === "reminders"
                ? "bg-cherry-900/30 text-cherry-400 border border-cherry-500/20 shadow-[0_0_15px_rgba(244,63,94,0.05)]"
                : "text-gray-400 hover:text-cherry-400 hover:bg-cherry-950/10"
            }`}
          >
            <Bell className="w-5 h-5" />
            <span className="text-sm font-semibold">Smart Reminders</span>
          </button>

          <div className="pt-4 pb-2">
            <p className="text-[10px] uppercase font-bold tracking-wider text-gray-500 px-3">Specialized Assistants</p>
          </div>

          <button
            onClick={() => {
              setActiveTab("creator");
              setSpecializedInput("");
              setSpecializedOutput("");
              setActivePreset("");
            }}
            className={`w-full flex items-center gap-3 p-3.5 rounded-xl text-left transition-all ${
              activeTab === "creator"
                ? "bg-cherry-900/30 text-cherry-400 border border-cherry-500/20 shadow-[0_0_15px_rgba(244,63,94,0.05)]"
                : "text-gray-400 hover:text-cherry-400 hover:bg-cherry-950/10"
            }`}
          >
            <PenTool className="w-5 h-5 text-purple-400" />
            <span className="text-sm font-semibold">Creator Studio</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("gamedev");
              setSpecializedInput("");
              setSpecializedOutput("");
              setActivePreset("");
            }}
            className={`w-full flex items-center gap-3 p-3.5 rounded-xl text-left transition-all ${
              activeTab === "gamedev"
                ? "bg-cherry-900/30 text-cherry-400 border border-cherry-500/20 shadow-[0_0_15px_rgba(244,63,94,0.05)]"
                : "text-gray-400 hover:text-cherry-400 hover:bg-cherry-950/10"
            }`}
          >
            <Gamepad2 className="w-5 h-5 text-emerald-400" />
            <span className="text-sm font-semibold">Game Dev Core</span>
          </button>
        </nav>

        {/* Footer Status */}
        <div className="p-4 border-t border-cherry-900/30 bg-dark-900/30 text-center">
          <p className="text-xs text-gray-500 flex items-center justify-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cherry-500 animate-pulse"></span>
            Cherry Productivity Engine v1.0
          </p>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-dark-900">
        
        {/* Ambient background glow */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute top-[-20%] right-[-10%] w-[45%] h-[45%] bg-cherry-950/10 rounded-full blur-[140px]" />
          <div className="absolute bottom-[-25%] left-[-10%] w-[45%] h-[45%] bg-cherry-950/10 rounded-full blur-[140px]" />
        </div>

        <div className="flex-1 overflow-y-auto p-8 relative z-10">
          <AnimatePresence mode="wait">
            
            {/* ── DAILY PLANNER VIEW ──────────────────────────────── */}
            {activeTab === "planner" && (
              <motion.div
                key="planner"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="max-w-4xl mx-auto space-y-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-cherry-900/20 pb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                      <Calendar className="w-6 h-6 text-cherry-400" />
                      Daily Scheduler
                    </h2>
                    <p className="text-sm text-gray-400 mt-1">Organize your time slots and track daily planner objectives.</p>
                  </div>
                  
                  {/* Date Selector */}
                  <div className="flex items-center gap-3 bg-dark-800 border border-gray-700/50 rounded-xl p-2">
                    <Calendar className="w-4 h-4 text-cherry-400" />
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="bg-transparent text-gray-200 text-sm font-medium focus:outline-none cursor-pointer"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Add Task Panel */}
                  <div className="md:col-span-1 bg-dark-800/60 backdrop-blur-xl border border-gray-800 rounded-2xl p-5 space-y-4">
                    <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider">New Task</h3>
                    
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-xs text-gray-500 font-medium">Task Title</label>
                        <input
                          type="text"
                          placeholder="e.g. Brainstorm Mechanics"
                          value={newTaskTitle}
                          onChange={(e) => setNewTaskTitle(e.target.value)}
                          className="w-full bg-dark-900 border border-gray-700/50 rounded-xl px-3.5 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cherry-500/50"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-gray-500 font-medium">Time Slot (Optional)</label>
                        <div className="relative">
                          <Clock className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="e.g. 09:00 - 10:30"
                            value={newTaskTime}
                            onChange={(e) => setNewTaskTime(e.target.value)}
                            className="w-full bg-dark-900 border border-gray-700/50 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cherry-500/50"
                          />
                        </div>
                      </div>

                      <button
                        onClick={addPlannerTask}
                        disabled={!newTaskTitle.trim()}
                        className="w-full py-2.5 bg-cherry-600 hover:bg-cherry-500 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-cherry-500/10 flex items-center justify-center gap-1.5"
                      >
                        <Plus className="w-4 h-4" /> Add to Schedule
                      </button>
                    </div>
                  </div>

                  {/* Tasks List Panel */}
                  <div className="md:col-span-2 space-y-3">
                    {plannerTasks.length === 0 ? (
                      <div className="glass p-12 rounded-2xl text-center text-gray-500 border border-gray-800/40">
                        <Calendar className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                        <p className="font-semibold text-sm">No tasks scheduled for this date</p>
                        <p className="text-xs text-gray-600 mt-1">Get ahead of your schedule by adding tasks on the left.</p>
                      </div>
                    ) : (
                      plannerTasks.map((task) => (
                        <div
                          key={task.id}
                          className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                            task.is_completed
                              ? "bg-dark-800/30 border-gray-800/60 opacity-60"
                              : "bg-dark-800/80 border-gray-800 hover:border-cherry-900/30 shadow-md"
                          }`}
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <button
                              onClick={() => togglePlannerTask(task)}
                              className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${
                                task.is_completed
                                  ? "border-cherry-500 bg-cherry-600 text-white"
                                  : "border-gray-600 hover:border-cherry-500"
                              }`}
                            >
                              {task.is_completed && <Check className="w-4 h-4" />}
                            </button>
                            <div className="min-w-0">
                              <p className={`text-sm font-semibold truncate ${task.is_completed ? "line-through text-gray-500" : "text-gray-200"}`}>
                                {task.title}
                              </p>
                              {task.time_slot && (
                                <p className="text-xs text-cherry-400 font-medium flex items-center gap-1 mt-0.5">
                                  <Clock className="w-3 h-3" />
                                  {task.time_slot}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <button
                            onClick={() => deletePlannerTask(task.id)}
                            className="p-2 hover:bg-red-950/20 text-gray-500 hover:text-red-400 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4.5 h-4.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── NOTES VAULT VIEW ────────────────────────────────── */}
            {activeTab === "notes" && (
              <motion.div
                key="notes"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="max-w-6xl mx-auto space-y-6"
              >
                <div className="flex items-center justify-between border-b border-cherry-900/20 pb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                      <FileText className="w-6 h-6 text-cherry-400" />
                      Notes Vault
                    </h2>
                    <p className="text-sm text-gray-400 mt-1">Draft notes, brain dump documents, and apply AI smart formatting.</p>
                  </div>
                  <button
                    onClick={handleCreateNewNote}
                    className="px-4 py-2 bg-cherry-600 hover:bg-cherry-500 text-white text-sm font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-lg shadow-cherry-500/10"
                  >
                    <Plus className="w-4 h-4" /> Create Note
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  {/* Left Notes List */}
                  <div className="lg:col-span-1 space-y-2 max-h-[60vh] overflow-y-auto pr-2">
                    {notes.length === 0 ? (
                      <p className="text-sm text-gray-600 text-center py-8 font-medium">Vault is empty.</p>
                    ) : (
                      notes.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => handleSelectNote(n)}
                          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                            selectedNote?.id === n.id
                              ? "bg-cherry-900/25 border-cherry-500/40 shadow-sm"
                              : "bg-dark-800/80 border-gray-800 hover:bg-dark-700/50"
                          }`}
                        >
                          <h4 className="text-sm font-bold text-gray-200 truncate">{n.title}</h4>
                          <p className="text-[10px] text-gray-500 mt-1.5">
                            {new Date(n.updated_at).toLocaleDateString()}
                          </p>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Middle Editor Panel */}
                  <div className="lg:col-span-2 bg-dark-800/60 backdrop-blur-xl border border-gray-800 rounded-2xl p-5 flex flex-col space-y-4 min-h-[50vh]">
                    {isEditingNote || selectedNote ? (
                      <>
                        <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                          <input
                            type="text"
                            value={noteTitle}
                            onChange={(e) => setNoteTitle(e.target.value)}
                            placeholder="Note Title"
                            disabled={!isEditingNote && selectedNote !== null}
                            className="bg-transparent text-lg font-bold text-white border-none focus:outline-none w-full"
                          />
                          <div className="flex items-center gap-2">
                            {isEditingNote ? (
                              <button
                                onClick={saveNote}
                                className="p-2 bg-cherry-600 hover:bg-cherry-500 text-white rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold shadow-md shadow-cherry-500/10"
                              >
                                <Save className="w-3.5 h-3.5" /> Save
                              </button>
                            ) : (
                              <button
                                onClick={() => setIsEditingNote(true)}
                                className="p-2 bg-dark-700 hover:bg-dark-600 text-gray-200 rounded-lg transition-colors text-xs font-semibold"
                              >
                                <Edit3 className="w-3.5 h-3.5" /> Edit
                              </button>
                            )}
                            {selectedNote && (
                              <button
                                onClick={() => deleteNote(selectedNote.id)}
                                className="p-2 bg-red-950/30 hover:bg-red-900/30 text-red-400 rounded-lg transition-colors"
                              >
                                <Trash className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        <textarea
                          value={noteContent}
                          onChange={(e) => setNoteContent(e.target.value)}
                          placeholder="Start typing your ideas, codes, or journal here..."
                          disabled={!isEditingNote && selectedNote !== null}
                          className="w-full flex-1 bg-transparent text-gray-300 placeholder-gray-700 resize-none focus:outline-none text-sm leading-relaxed min-h-[30vh]"
                        />
                      </>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-500">
                        <FileText className="w-12 h-12 text-gray-700 mb-3" />
                        <p className="font-semibold text-sm">No note open</p>
                        <p className="text-xs text-gray-600 mt-1">Select a note from the left, or create a new one to begin.</p>
                      </div>
                    )}
                  </div>

                  {/* Right AI Assist Panel */}
                  <div className="lg:col-span-1 space-y-4">
                    <div className="bg-dark-800/80 border border-gray-800 rounded-2xl p-5 space-y-3.5">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                        <Sparkles className="w-4 h-4 text-cherry-400" />
                        Cherry AI Vault Assist
                      </h4>
                      <p className="text-[11px] text-gray-500 leading-relaxed">
                        Process notes content for outline synthesis, task extraction, summaries, or stylistic improvement.
                      </p>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleAiNoteAssist("summarize")}
                          disabled={loading || !noteContent}
                          className="py-2.5 px-3 bg-dark-700/60 hover:bg-dark-700 text-xs font-semibold text-gray-200 border border-gray-700 hover:border-cherry-900/30 rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          Summarize
                        </button>
                        <button
                          onClick={() => handleAiNoteAssist("outline")}
                          disabled={loading || !noteContent}
                          className="py-2.5 px-3 bg-dark-700/60 hover:bg-dark-700 text-xs font-semibold text-gray-200 border border-gray-700 hover:border-cherry-900/30 rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          Outline
                        </button>
                        <button
                          onClick={() => handleAiNoteAssist("improve")}
                          disabled={loading || !noteContent}
                          className="py-2.5 px-3 bg-dark-700/60 hover:bg-dark-700 text-xs font-semibold text-gray-200 border border-gray-700 hover:border-cherry-900/30 rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          Polished Tone
                        </button>
                        <button
                          onClick={() => handleAiNoteAssist("actions")}
                          disabled={loading || !noteContent}
                          className="py-2.5 px-3 bg-dark-700/60 hover:bg-dark-700 text-xs font-semibold text-gray-200 border border-gray-700 hover:border-cherry-900/30 rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          Find Actionables
                        </button>
                      </div>
                    </div>

                    {loading && (
                      <div className="p-4 bg-dark-850 border border-cherry-500/20 rounded-xl text-center animate-pulse flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 text-cherry-400 animate-spin" />
                        <span className="text-xs text-cherry-400 font-semibold">AI Assistant processing Note...</span>
                      </div>
                    )}

                    {aiNoteSuggestion && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-dark-850/80 border border-cherry-900/25 p-4 rounded-2xl relative"
                      >
                        <button
                          onClick={() => setAiNoteSuggestion("")}
                          className="p-1 hover:bg-dark-700 rounded-lg absolute top-2 right-2 text-gray-500 hover:text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <h5 className="text-[11px] font-bold text-cherry-400 uppercase tracking-wider mb-2">Cherry Response</h5>
                        <div className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap max-h-[30vh] overflow-y-auto">
                          {aiNoteSuggestion}
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── SMART REMINDERS VIEW ────────────────────────────── */}
            {activeTab === "reminders" && (
              <motion.div
                key="reminders"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="max-w-4xl mx-auto space-y-6"
              >
                <div className="border-b border-cherry-900/20 pb-4">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Bell className="w-6 h-6 text-cherry-400 animate-bounce" />
                    Smart Reminders
                  </h2>
                  <p className="text-sm text-gray-400 mt-1">Set notifications, alarm triggers, and key milestones to stay on task.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Create Reminder Form */}
                  <div className="md:col-span-1 bg-dark-800/60 backdrop-blur-xl border border-gray-800 rounded-2xl p-5 space-y-4">
                    <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider">New Reminder</h3>
                    
                    <div className="space-y-3.5">
                      <div className="space-y-1">
                        <label className="text-xs text-gray-500 font-medium">Alert Description</label>
                        <input
                          type="text"
                          placeholder="e.g. Client Design Sync"
                          value={newReminderTitle}
                          onChange={(e) => setNewReminderTitle(e.target.value)}
                          className="w-full bg-dark-900 border border-gray-700/50 rounded-xl px-3.5 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cherry-500/50"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-gray-500 font-medium">Trigger Time</label>
                        <input
                          type="datetime-local"
                          value={newReminderTime}
                          onChange={(e) => setNewReminderTime(e.target.value)}
                          className="w-full bg-dark-900 border border-gray-700/50 rounded-xl px-3.5 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-cherry-500/50"
                        />
                      </div>

                      <button
                        onClick={addReminder}
                        disabled={!newReminderTitle.trim() || !newReminderTime}
                        className="w-full py-2.5 bg-cherry-600 hover:bg-cherry-500 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-cherry-500/10 flex items-center justify-center gap-1.5"
                      >
                        <Plus className="w-4 h-4" /> Add Reminder
                      </button>
                    </div>
                  </div>

                  {/* Reminders List */}
                  <div className="md:col-span-2 space-y-3">
                    {reminders.length === 0 ? (
                      <div className="glass p-12 rounded-2xl text-center text-gray-500 border border-gray-800/40">
                        <Bell className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                        <p className="font-semibold text-sm">No reminders set</p>
                        <p className="text-xs text-gray-600 mt-1">Add trigger reminders to compile schedule reminders dynamically.</p>
                      </div>
                    ) : (
                      reminders.map((r) => (
                        <div
                          key={r.id}
                          className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                            r.is_completed
                              ? "bg-dark-800/30 border-gray-800/60 opacity-60"
                              : "bg-dark-800/80 border-gray-800 hover:border-cherry-900/30 shadow-md"
                          }`}
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <button
                              onClick={() => toggleReminder(r)}
                              className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${
                                r.is_completed
                                  ? "border-cherry-500 bg-cherry-600 text-white"
                                  : "border-gray-600 hover:border-cherry-500"
                              }`}
                            >
                              {r.is_completed && <Check className="w-4 h-4" />}
                            </button>
                            <div className="min-w-0">
                              <p className={`text-sm font-semibold truncate ${r.is_completed ? "line-through text-gray-500" : "text-gray-200"}`}>
                                {r.title}
                              </p>
                              <p className="text-xs text-cherry-400 font-medium flex items-center gap-1.5 mt-1">
                                <Clock className="w-3.5 h-3.5" />
                                {new Date(r.reminder_time).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          
                          <button
                            onClick={() => deleteReminder(r.id)}
                            className="p-2 hover:bg-red-950/20 text-gray-500 hover:text-red-400 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4.5 h-4.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── CREATOR STUDIO VIEW ─────────────────────────────── */}
            {activeTab === "creator" && (
              <motion.div
                key="creator"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="max-w-5xl mx-auto space-y-6"
              >
                <div className="border-b border-cherry-900/20 pb-4">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <PenTool className="w-6 h-6 text-purple-400" />
                    Creator Studio
                  </h2>
                  <p className="text-sm text-gray-400 mt-1">Brainstorm scripts, outline YouTube outlines, write content logs, or generate thumbnails ideations.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Creator Tools Selector & Presets */}
                  <div className="md:col-span-1 space-y-4">
                    <div className="bg-dark-800/80 border border-gray-800 rounded-2xl p-5 space-y-3">
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Presets Templates</h3>
                      
                      <div className="space-y-2">
                        {[
                          { id: "script", label: "Video Script Outline", desc: "Storyboard out an engaging script" },
                          { id: "thumbnail", label: "Thumbnail Concept Designer", desc: "Design prompt directives for layout design" },
                          { id: "hooks", label: "Social Media Hooks Generator", desc: "Craft three scroll-stopping initial lines" },
                          { id: "newsletter", label: "Creator Newsletter Plan", desc: "Generate a weekly recap structure" }
                        ].map((preset) => (
                          <button
                            key={preset.id}
                            onClick={() => {
                              setActivePreset(preset.id);
                              if (preset.id === "script") setSpecializedInput("A video script outline explaining standard client-server APIs vs WebSockets");
                              else if (preset.id === "thumbnail") setSpecializedInput("Cyberpunk hacker workspace visual mockup in cherry neon glow style");
                              else if (preset.id === "hooks") setSpecializedInput("Unveiling my personal assistant project built with Gemini API fallbacks");
                              else if (preset.id === "newsletter") setSpecializedInput("Coding a client vault database system in Python");
                            }}
                            className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                              activePreset === preset.id
                                ? "bg-purple-950/30 border-purple-500/40 text-purple-300"
                                : "bg-dark-800/40 border-gray-800 hover:bg-dark-700/50"
                            }`}
                          >
                            <h4 className="text-xs font-bold text-gray-200">{preset.label}</h4>
                            <p className="text-[10px] text-gray-500 mt-1">{preset.desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Input/Output Core */}
                  <div className="md:col-span-2 space-y-4">
                    <div className="bg-dark-800/60 backdrop-blur-xl border border-gray-800 rounded-2xl p-5 space-y-4 flex flex-col">
                      <h3 className="text-sm font-bold text-gray-300">Workspace Input</h3>
                      
                      <textarea
                        value={specializedInput}
                        onChange={(e) => setSpecializedInput(e.target.value)}
                        placeholder="Provide details about your content concept..."
                        className="w-full bg-dark-900 border border-gray-700/50 rounded-xl p-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500/50 min-h-[120px] resize-none"
                      />

                      <button
                        onClick={() => handleSpecializedQuery("You are Cherry AI Creator Mode Assistant. Help the content creator map out scripts, layout layouts, hook hooks, or video visual ideas based on their input. Ensure output contains formatted headings, storyboards, and clear annotations.")}
                        disabled={loading || !specializedInput.trim()}
                        className="self-end py-2.5 px-6 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-purple-500/15 flex items-center gap-1.5"
                      >
                        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                        Generate Plan
                      </button>
                    </div>

                    {specializedOutput && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-dark-800/80 border border-purple-950/40 rounded-2xl p-5 space-y-4"
                      >
                        <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                          <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider">Generated Output Plan</h4>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={copyToClipboard}
                              className="p-2 hover:bg-dark-700 text-gray-400 hover:text-white rounded-lg transition-colors flex items-center gap-1 text-xs"
                            >
                              {isCopying ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                              Copy
                            </button>
                            <button
                              onClick={() => downloadText("creator_output", specializedOutput)}
                              className="p-2 hover:bg-dark-700 text-gray-400 hover:text-white rounded-lg transition-colors flex items-center gap-1 text-xs"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Save
                            </button>
                          </div>
                        </div>
                        <div className="text-sm text-gray-350 leading-relaxed whitespace-pre-wrap font-mono bg-dark-900/60 p-4 rounded-xl max-h-[40vh] overflow-y-auto border border-gray-850">
                          {specializedOutput}
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── GAME DEV SUPPORT VIEW ───────────────────────────── */}
            {activeTab === "gamedev" && (
              <motion.div
                key="gamedev"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="max-w-5xl mx-auto space-y-6"
              >
                <div className="border-b border-cherry-900/20 pb-4">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Gamepad2 className="w-6 h-6 text-emerald-400 animate-pulse" />
                    Game Dev Core
                  </h2>
                  <p className="text-sm text-gray-400 mt-1">Draft GDD (Game Design Documents), prototype mechanic descriptions, formulate algorithms, or layout dev logs.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Game Dev Presets */}
                  <div className="md:col-span-1 space-y-4">
                    <div className="bg-dark-800/80 border border-gray-800 rounded-2xl p-5 space-y-3">
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Game Dev Templates</h3>
                      
                      <div className="space-y-2">
                        {[
                          { id: "gdd", label: "Game Design Document Section", desc: "Map mechanics, lore, and HUD elements" },
                          { id: "mechanics", label: "Core Mechanics Brainstormer", desc: "Draft gameplay loop concepts" },
                          { id: "pseudocode", label: "Algorithms & State Layout", desc: "Layout states, triggers, or loops" },
                          { id: "devlog", label: "Dev Log Entry Composer", desc: "Draft progress summary updates" }
                        ].map((preset) => (
                          <button
                            key={preset.id}
                            onClick={() => {
                              setActivePreset(preset.id);
                              if (preset.id === "gdd") setSpecializedInput("Create a game design segment for a 2D side-scrolling platformer with time-reversal mechanics.");
                              else if (preset.id === "mechanics") setSpecializedInput("Brainstorm mechanics for a cherry-themed puzzle game with custom gravity settings.");
                              else if (preset.id === "pseudocode") setSpecializedInput("Draft state machines/conditions for a pathfinder AI navigating standard nodes.");
                              else if (preset.id === "devlog") setSpecializedInput("We successfully completed Phase 5 image generation router core and front end.");
                            }}
                            className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                              activePreset === preset.id
                                ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-300"
                                : "bg-dark-800/40 border-gray-800 hover:bg-dark-700/50"
                            }`}
                          >
                            <h4 className="text-xs font-bold text-gray-200">{preset.label}</h4>
                            <p className="text-[10px] text-gray-500 mt-1">{preset.desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Input/Output Workspace */}
                  <div className="md:col-span-2 space-y-4">
                    <div className="bg-dark-800/60 backdrop-blur-xl border border-gray-800 rounded-2xl p-5 space-y-4 flex flex-col">
                      <h3 className="text-sm font-bold text-gray-300">Dev Workspace</h3>
                      
                      <textarea
                        value={specializedInput}
                        onChange={(e) => setSpecializedInput(e.target.value)}
                        placeholder="Define your game concept, mechanics parameters, or dev logs content..."
                        className="w-full bg-dark-900 border border-gray-700/50 rounded-xl p-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 min-h-[120px] resize-none"
                      />

                      <button
                        onClick={() => handleSpecializedQuery("You are Cherry AI Game Dev Core engine. Assist game developers in crafting comprehensive Game Design Documents (GDD), brainstorming game mechanics, layout state flowcharts, formulating game mechanics math, or writing structured Dev Logs. Use standard technical markdown, coding structures, and design checklists.")}
                        disabled={loading || !specializedInput.trim()}
                        className="self-end py-2.5 px-6 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/15 flex items-center gap-1.5"
                      >
                        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Code className="w-3.5 h-3.5" />}
                        Compile GDD / Plan
                      </button>
                    </div>

                    {specializedOutput && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-dark-800/80 border border-emerald-950/40 rounded-2xl p-5 space-y-4"
                      >
                        <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                          <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Dev Compile Output</h4>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={copyToClipboard}
                              className="p-2 hover:bg-dark-700 text-gray-400 hover:text-white rounded-lg transition-colors flex items-center gap-1 text-xs"
                            >
                              {isCopying ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                              Copy
                            </button>
                            <button
                              onClick={() => downloadText("gamedev_output", specializedOutput)}
                              className="p-2 hover:bg-dark-700 text-gray-400 hover:text-white rounded-lg transition-colors flex items-center gap-1 text-xs"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Save
                            </button>
                          </div>
                        </div>
                        <div className="text-sm text-gray-350 leading-relaxed whitespace-pre-wrap font-mono bg-dark-900/60 p-4 rounded-xl max-h-[40vh] overflow-y-auto border border-gray-850">
                          {specializedOutput}
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
