"use client";

import { useEffect, useState } from "react";
import { Play, Sparkles, ShieldCheck, User, Briefcase, Award, ArrowRight, BookOpen, Layers } from "lucide-react";
import { api } from "@/lib/api";

export default function CandidatePortal() {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  
  // Registration Form state
  const [fullName, setFullName] = useState("Nurse Priya Sharma");
  const [email, setEmail] = useState("priya.sharma@example.com");
  const [phone, setPhone] = useState("+91 98765 43210");
  const [selectedRole, setSelectedRole] = useState("Staff Nurse");
  const [difficulty, setDifficulty] = useState("Fresher");
  const [questionCount, setQuestionCount] = useState(5);
  const [isScheduling, setIsScheduling] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const qbData = await api.getQuestionBank();
      setAvailableRoles(qbData.available_roles || []);
      if (qbData.available_roles?.length > 0) {
        setSelectedRole(qbData.available_roles[0]);
      }
      const cList = await api.listCandidates();
      setCandidates(cList);
    } catch (e) {
      console.error(e);
    }
  };

  const handleStartInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsScheduling(true);

    try {
      // 1. Register or retrieve candidate
      const cand = await api.registerCandidate({
        full_name: fullName,
        email: email,
        phone: phone,
        role_applied: selectedRole,
        experience_level: difficulty,
        experience_years: difficulty === "Fresher" ? 0 : difficulty === "Junior" ? 2 : 5,
        skills: ["Vital Signs", "Medication Admin", "Patient Safety", "SBAR Handover"],
      });

      // 2. Schedule interview session
      const interview = await api.scheduleInterview({
        candidate_id: cand.id,
        job_title: selectedRole,
        difficulty_level: difficulty,
        duration_minutes: 15,
        total_questions: questionCount,
      });

      // 3. Open dedicated interview window
      window.open(`/interview/${interview.interview_id}`, "_blank", "width=1280,height=850,menubar=no,toolbar=no");
    } catch (err) {
      alert("Error scheduling interview.");
    } finally {
      setIsScheduling(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 px-8 py-5 backdrop-blur flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center font-black text-slate-950 text-lg shadow-lg shadow-emerald-500/20">
            H
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              AI Mock Interviewer
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-850">
                Standalone System
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Direct Clinical Question Bank (315 Questions across 21 Nursing Roles)
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <a
            href="/questions"
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold rounded-lg text-slate-200 transition"
          >
            <BookOpen className="w-3.5 h-3.5 text-emerald-400" /> Question Bank (PDF)
          </a>
          <a
            href="/recruiter"
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold rounded-lg text-white transition shadow-lg shadow-emerald-600/20"
          >
            Recruiter Dashboard <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl w-full mx-auto p-8 space-y-10 flex-1">
        {/* Hero banner */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/30 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-800 text-[11px] text-emerald-400 font-medium">
              <Sparkles className="w-3.5 h-3.5" /> Full AI Video Interview & Assessment System
            </div>
            <h2 className="text-3xl font-extrabold text-white leading-tight">
              Practice Authentic Hospital Interviews with an AI Specialist
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Experience a full browser interview session with real-time AI speech questions, candidate audio recognition, video recording, and instant clinical rubric grading.
            </p>
          </div>
        </div>

        {/* Schedule Interview Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-emerald-400" /> Launch New Interview Session
          </h3>

          <form onSubmit={handleStartInterview} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">Candidate Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">Phone Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">Nursing Role</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  {availableRoles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">Experience Level</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Fresher">Fresher Level</option>
                  <option value="Junior">Junior Level</option>
                  <option value="Senior">Senior Level</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">Number of Questions</label>
                <select
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value={3}>3 Questions (Fast Practice)</option>
                  <option value={5}>5 Questions (Standard)</option>
                  <option value={10}>10 Questions (Comprehensive)</option>
                </select>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between border-t border-slate-800">
              <div className="text-xs text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Launches dedicated interview window with camera & mic testing
              </div>
              <button
                type="submit"
                disabled={isScheduling}
                className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 font-bold text-white text-sm rounded-xl shadow-lg shadow-emerald-600/25 transition flex items-center gap-2"
              >
                <Play className="w-4 h-4 fill-white" />
                {isScheduling ? "Generating Interview..." : "Open AI Interview Window"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
