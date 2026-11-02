"use client";

import { useEffect, useState } from "react";
import { Search, BookOpen, Layers, Award, ShieldCheck, ChevronRight } from "lucide-react";
import { api, QuestionBankItem } from "@/lib/api";

export default function QuestionBankPage() {
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQuestions();
  }, [selectedRole, selectedDifficulty]);

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const data = await api.getQuestionBank(search, selectedRole, selectedDifficulty);
      setQuestions(data.questions || []);
      setAvailableRoles(data.available_roles || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadQuestions();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <header className="border-b border-slate-800 bg-slate-900/60 px-8 py-5 backdrop-blur flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-400" />
            Verified Nursing Question Bank
          </h1>
          <p className="text-xs text-slate-400">
            Source: <span className="text-slate-200">Nursing_Interview_Question_Bank_21_Roles.pdf</span> • 315 Authentic Questions
          </p>
        </div>
        <div className="flex gap-3">
          <a
            href="/"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg text-slate-200 transition"
          >
            Candidate Portal
          </a>
          <a
            href="/recruiter"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold rounded-lg text-white transition"
          >
            Recruiter Dashboard
          </a>
        </div>
      </header>

      <main className="max-w-7xl w-full mx-auto p-8 space-y-6">
        {/* Filters */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-wrap gap-4 items-center justify-between">
          <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[280px] relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search clinical topics, questions, protocols..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </form>

          <div className="flex gap-3 items-center">
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
            >
              <option value="">All 21 Clinical Roles</option>
              {availableRoles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
            >
              <option value="">All Experience Levels</option>
              <option value="Fresher">Fresher Level</option>
              <option value="Junior">Junior Level</option>
              <option value="Senior">Senior Level</option>
            </select>
          </div>
        </div>

        {/* Results Stats */}
        <div className="flex justify-between items-center text-xs text-slate-400 px-1">
          <span>Found {questions.length} matching questions from PDF primary source</span>
          <span className="flex items-center gap-1.5 text-emerald-400">
            <ShieldCheck className="w-4 h-4" /> 100% Genuine Clinical Database
          </span>
        </div>

        {/* Cards */}
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading questions...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {questions.map((q) => (
              <div
                key={q.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                      {q.role}
                    </span>
                    <span className="text-[11px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      {q.difficulty} • Page {q.page_number}
                    </span>
                  </div>
                  <h3 className="font-medium text-white text-sm leading-snug">{q.question}</h3>
                </div>

                {q.model_answer && (
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 text-xs text-slate-300 space-y-1">
                    <strong className="text-slate-400 font-semibold block text-[10px] uppercase tracking-wider">
                      Model Answer (PDF Source)
                    </strong>
                    <p className="line-clamp-3 leading-relaxed">{q.model_answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

