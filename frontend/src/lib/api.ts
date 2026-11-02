const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

export interface QuestionBankItem {
  id: string;
  role: string;
  category: string;
  difficulty: string;
  question: string;
  model_answer: string;
  source: string;
  page_number: number;
  is_ai_generated: boolean;
}

export interface Candidate {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  role_applied: string;
  experience_level: string;
  experience_years: number;
  skills: string[];
}

export interface InterviewQuestionItem {
  id: string;
  order_index: number;
  question_text: string;
  category: string;
  difficulty: string;
  model_answer?: string;
  is_ai_generated: boolean;
  is_follow_up: boolean;
  source: string;
  candidate_transcript?: string;
  score?: number;
  ai_evaluation?: any;
}

export interface AssessmentData {
  overall_score: number;
  technical_score: number;
  skills_score: number;
  problem_solving_score: number;
  communication_score: number;
  strengths: string[];
  areas_for_improvement: string[];
  evidence_based_feedback: string;
  interview_summary: string;
  recruiter_notes?: string;
  recruiter_verdict?: string;
}

export interface InterviewSessionData {
  id: string;
  candidate: Candidate;
  job_title: string;
  job_description?: string;
  difficulty_level: string;
  duration_minutes: number;
  total_questions: number;
  current_question_index: number;
  status: string;
  has_recording: boolean;
  recording_path?: string;
  questions: InterviewQuestionItem[];
  assessment?: AssessmentData;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export const api = {
  getQuestionBank: async (search?: string, role?: string, difficulty?: string) => {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (role) params.append("role", role);
    if (difficulty) params.append("difficulty", difficulty);
    const res = await fetch(`${API_BASE}/questions/bank?${params.toString()}`);
    return res.json();
  },

  registerCandidate: async (data: any) => {
    const res = await fetch(`${API_BASE}/candidates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  listCandidates: async () => {
    const res = await fetch(`${API_BASE}/candidates`);
    return res.json();
  },

  scheduleInterview: async (data: {
    candidate_id: string;
    job_title: string;
    job_description?: string;
    difficulty_level?: string;
    duration_minutes?: number;
    total_questions?: number;
  }) => {
    const res = await fetch(`${API_BASE}/interviews/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  getInterview: async (id: string): Promise<InterviewSessionData> => {
    const res = await fetch(`${API_BASE}/interviews/${id}`);
    if (!res.ok) throw new Error("Failed to load interview");
    return res.json();
  },

  startInterview: async (id: string, consent: boolean = true) => {
    const res = await fetch(`${API_BASE}/interviews/${id}/start?consent=${consent}`, {
      method: "POST",
    });
    return res.json();
  },

  submitAnswer: async (
    interviewId: string,
    data: { question_id: string; transcript: string; duration_seconds: number }
  ) => {
    const res = await fetch(`${API_BASE}/interviews/${interviewId}/submit-answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  uploadRecording: async (interviewId: string, blob: Blob) => {
    const formData = new FormData();
    formData.append("recording", blob, `interview_${interviewId}.webm`);
    const res = await fetch(`${API_BASE}/interviews/${interviewId}/upload-recording`, {
      method: "POST",
      body: formData,
    });
    return res.json();
  },

  completeInterview: async (id: string) => {
    const res = await fetch(`${API_BASE}/interviews/${id}/complete`, {
      method: "POST",
    });
    return res.json();
  },

  listRecruiterInterviews: async () => {
    const res = await fetch(`${API_BASE}/recruiter/interviews`);
    return res.json();
  },

  submitRecruiterFeedback: async (
    interviewId: string,
    data: { verdict: string; notes?: string }
  ) => {
    const res = await fetch(`${API_BASE}/recruiter/interviews/${interviewId}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  getRecordingStreamUrl: (interviewId: string) => {
    return `${API_BASE}/interviews/${interviewId}/recording`;
  },
};

