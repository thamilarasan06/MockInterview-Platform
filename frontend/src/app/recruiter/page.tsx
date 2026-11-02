"use client";

import { useEffect, useState } from "react";
import { UserCheck, Video, Play, FileText, CheckCircle2, AlertCircle, MessageSquare, ArrowUpRight, Search, Award } from "lucide-react";
import { api, InterviewSessionData } from "@/lib/api";

export default function RecruiterDashboard() {
  const [interviews, setInterviews] = useState<any[]>([]);
  const [selectedInterview, setSelectedInterview] = useState<InterviewSessionData | null>(null);
  const [loading, setLoading] = useState(true);

  // Recruiter feedback modal state
  const [verdict, setVerdict] = useState("SHORTLISTED");
  const [notes, setNotes] = useState("");
  const [isSavingFeedback, setIsSavingFeedback] = useState(false);

  useEffect(() => {
    loadInterviews();
  }, []);

  const loadInterviews = async () => {
    setLoading(true);
    try {
      const data = await api.listRecruiterInterviews();
      setInterviews(data);
      if (data.length > 0 && !selectedInterview) {
        viewDetails(data[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const viewDetails = async (id: string) => {
    try {
      const data = await api.getInterview(id);
      setSelectedInterview(data);
      if (data.assessment?.recruiter_verdict) {
        setVerdict(data.assessment.recruiter_verdict);
      }
      if (data.assessment?.recruiter_notes) {
        setNotes(data.assessment.recruiter_notes);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const saveFeedback = async () => {
    if (!selectedInterview) return;
    setIsSavingFeedback(true);
    try {
      await api.submitRecruiterFeedback(selectedInterview.id, {
        verdict,
        notes,
      });
      await viewDetails(selectedInterview.id);
      await loadInterviews();
      alert("Recruiter evaluation successfully saved!");
    } catch (e) {
      alert("Error saving feedback");
    } finally {
      setIsSavingFeedback(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <header className="border-b border-slate-800 bg-slate-900/60 px-8 py-5 backdrop-blur flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-emerald-400" />
            Recruiter AI Interview Review Dashboard
          </h1>
          <p className="text-xs text-slate-400">
            Review completed video interviews, question-by-question transcripts, and AI assessment reports.
          </p>
        </div>
        <div className="flex gap-3">
          <a
            href="/questions"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg text-slate-200 transition"
          >
            Question Bank (PDF)
          </a>
          <a
            href="/"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold rounded-lg text-white transition"
          >
            Launch Candidate Session
          </a>
        </div>
      </header>

      <main className="max-w-7xl w-full mx-auto p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">
        {/* Left List of Interviews */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex justify-between items-center text-xs text-slate-400 px-1">
            <span>Interview Pipeline ({interviews.length})</span>
            <span className="text-emerald-400">Live PostgreSQL Sync</span>
          </div>

          <div className="space-y-3">
            {interviews.map((item) => (
              <div
                key={item.id}
                onClick={() => viewDetails(item.id)}
                className={`p-4 rounded-xl border cursor-pointer transition ${
                  selectedInterview?.id === item.id
                    ? "bg-slate-900 border-emerald-500 shadow-md"
                    : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-semibold text-white text-sm">{item.candidate_name}</h4>
                    <p className="text-xs text-slate-400">{item.candidate_email}</p>
                  </div>
                  {item.overall_score !== null ? (
                    <span className="font-bold text-sm px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                      {item.overall_score}%
                    </span>
                  ) : (
                    <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                      {item.status}
                    </span>
                  )}
                </div>

                <div className="flex justify-between items-center text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                  <span>{item.job_title} ({item.difficulty_level})</span>
                  <span className="text-[11px] text-slate-500">
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
            {interviews.length === 0 && !loading && (
              <div className="p-8 text-center text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800 text-sm">
                No interviews scheduled yet. Launch an interview from the candidate portal.
              </div>
            )}
          </div>
        </div>

        {/* Right Details Pane */}
        <div className="lg:col-span-7">
          {selectedInterview ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
              {/* Header */}
              <div className="flex justify-between items-start border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white">{selectedInterview.candidate.full_name}</h2>
                  <p className="text-xs text-slate-400">
                    Role: <span className="text-white font-medium">{selectedInterview.job_title}</span> • Level: {selectedInterview.difficulty_level}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    selectedInterview.status === "COMPLETED" ? "bg-emerald-950 text-emerald-400 border border-emerald-800" : "bg-amber-950 text-amber-400 border border-amber-800"
                  }`}>
                    {selectedInterview.status}
                  </span>
                </div>
              </div>

              {/* Assessment Report Summary */}
              {selectedInterview.assessment && (
                <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Award className="w-4 h-4 text-emerald-400" /> AI Competency Assessment Report
                  </h3>

                  <div className="grid grid-cols-4 gap-3 text-center">
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <div className="text-xl font-bold text-emerald-400">{selectedInterview.assessment.overall_score}%</div>
                      <div className="text-[10px] text-slate-400 uppercase">Overall</div>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <div className="text-xl font-bold text-blue-400">{selectedInterview.assessment.technical_score}%</div>
                      <div className="text-[10px] text-slate-400 uppercase">Technical</div>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <div className="text-xl font-bold text-purple-400">{selectedInterview.assessment.problem_solving_score}%</div>
                      <div className="text-[10px] text-slate-400 uppercase">Solving</div>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <div className="text-xl font-bold text-amber-400">{selectedInterview.assessment.communication_score}%</div>
                      <div className="text-[10px] text-slate-400 uppercase">Verbal</div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                    {selectedInterview.assessment.interview_summary}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="bg-emerald-950/30 border border-emerald-900/50 p-3 rounded-lg">
                      <strong className="text-emerald-400 block mb-1">Identified Strengths:</strong>
                      <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px]">
                        {selectedInterview.assessment.strengths.map((s, idx) => (
                          <li key={idx}>{s}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-amber-950/30 border border-amber-900/50 p-3 rounded-lg">
                      <strong className="text-amber-400 block mb-1">Improvement Areas:</strong>
                      <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px]">
                        {selectedInterview.assessment.areas_for_improvement.map((a, idx) => (
                          <li key={idx}>{a}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Video Recording Player */}
              {selectedInterview.has_recording && (
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Video className="w-3.5 h-3.5 text-emerald-400" /> Candidate Video Recording
                  </h4>
                  <video
                    controls
                    src={api.getRecordingStreamUrl(selectedInterview.id)}
                    className="w-full rounded-lg bg-black aspect-video object-contain"
                  />
                </div>
              )}

              {/* Questions & Transcripts */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Question-by-Question Audit ({selectedInterview.questions.length})
                </h3>
                {selectedInterview.questions.map((q, idx) => (
                  <div key={q.id} className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 space-y-2 text-xs">
                    <div className="flex justify-between items-start">
                      <span className="font-semibold text-white">
                        Q{idx + 1}: {q.question_text}
                      </span>
                      {q.score !== null && (
                        <span className="font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                          {q.score}%
                        </span>
                      )}
                    </div>
                    <div className="text-slate-400 text-[11px]">
                      Source: {q.source} ({q.difficulty})
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-slate-200">
                      <strong className="text-slate-400 block text-[10px] uppercase">Candidate Speech Transcript:</strong>
                      <p className="mt-1 italic">{q.candidate_transcript || "No transcript recorded."}</p>
                    </div>
                    {q.ai_evaluation?.feedback && (
                      <p className="text-[11px] text-emerald-400/90">
                        <strong>Clinical Assessment:</strong> {q.ai_evaluation.feedback}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Recruiter Final Verdict */}
              {selectedInterview.assessment && (
                <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
                  <h4 className="text-sm font-semibold text-white">Recruiter Decision & Manual Feedback</h4>
                  <div className="flex gap-4">
                    {["SHORTLISTED", "NEEDS_ROUND_2", "ON_HOLD"].map((v) => (
                      <button
                        key={v}
                        onClick={() => setVerdict(v)}
                        className={`px-4 py-2 rounded-lg text-xs font-semibold transition border ${
                          verdict === v
                            ? "bg-emerald-600 border-emerald-500 text-white"
                            : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        {v.replace(/_/g, " ")}
                      </button>
                    ))}
                  </div>

                  <textarea
                    rows={3}
                    placeholder="Add manual recruiter notes regarding clinical readiness..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  />

                  <button
                    disabled={isSavingFeedback}
                    onClick={saveFeedback}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white rounded-lg transition"
                  >
                    {isSavingFeedback ? "Saving..." : "Save Recruiter Verdict"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center p-12 bg-slate-900/40 rounded-2xl border border-slate-800 text-slate-500 text-sm">
              Select an interview to view recordings, transcripts, and evaluation metrics.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

