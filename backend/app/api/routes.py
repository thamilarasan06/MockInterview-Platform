import os
import uuid
import json
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc

from app.db.session import get_db
from app.db.models import QuestionBank, Candidate, InterviewSession, InterviewQuestion, InterviewAssessment
from app.core.interview_engine import IntelligentInterviewEngine
from app.core.evaluation import EvaluationEngine
from app.core.config import RECORDINGS_DIR

router = APIRouter(prefix="/api", tags=["Interview Platform"])

# ----------------- SCHEMAS -----------------
class CandidateCreate(BaseModel):
    full_name: str
    email: str
    phone: Optional[str] = None
    role_applied: str
    experience_level: str = "Fresher"
    experience_years: int = 0
    skills: List[str] = []
    qualifications: Optional[str] = None

class ScheduleInterviewRequest(BaseModel):
    candidate_id: str
    job_title: str
    job_description: Optional[str] = None
    difficulty_level: str = "Fresher"
    duration_minutes: int = 15
    total_questions: int = 5

class SubmitAnswerRequest(BaseModel):
    question_id: str
    transcript: str
    duration_seconds: int = 0

class RecruiterFeedbackRequest(BaseModel):
    verdict: str
    notes: Optional[str] = None

# ----------------- 1. QUESTION BANK ENDPOINTS -----------------
@router.get("/questions/bank")
def get_question_bank(
    search: Optional[str] = None,
    role: Optional[str] = None,
    difficulty: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(QuestionBank)
    if search:
        query = query.filter(or_(
            QuestionBank.question.ilike(f"%{search}%"),
            QuestionBank.role.ilike(f"%{search}%"),
            QuestionBank.model_answer.ilike(f"%{search}%")
        ))
    if role:
        query = query.filter(QuestionBank.role.ilike(f"%{role}%"))
    if difficulty:
        query = query.filter(QuestionBank.difficulty.ilike(f"%{difficulty}%"))

    items = query.order_by(QuestionBank.role, QuestionBank.page_number).all()
    
    # Get distinct roles for filtering
    roles = [r[0] for r in db.query(QuestionBank.role).distinct().order_by(QuestionBank.role).all()]
    
    return {
        "total": len(items),
        "available_roles": roles,
        "questions": [
            {
                "id": str(q.id),
                "role": q.role,
                "category": q.category,
                "difficulty": q.difficulty,
                "question": q.question,
                "model_answer": q.model_answer,
                "source": q.source,
                "page_number": q.page_number,
                "is_ai_generated": q.is_ai_generated,
            }
            for q in items
        ]
    }

# ----------------- 2. CANDIDATES ENDPOINTS -----------------
@router.post("/candidates")
def register_candidate(data: CandidateCreate, db: Session = Depends(get_db)):
    # Check if candidate email exists
    candidate = db.query(Candidate).filter(Candidate.email == data.email).first()
    if not candidate:
        candidate = Candidate(
            full_name=data.full_name,
            email=data.email,
            phone=data.phone,
            role_applied=data.role_applied,
            experience_level=data.experience_level,
            experience_years=data.experience_years,
            skills=data.skills,
            qualifications=data.qualifications,
        )
        db.add(candidate)
        db.commit()
        db.refresh(candidate)
    return {
        "id": str(candidate.id),
        "full_name": candidate.full_name,
        "email": candidate.email,
        "role_applied": candidate.role_applied,
        "experience_level": candidate.experience_level,
    }

@router.get("/candidates")
def list_candidates(db: Session = Depends(get_db)):
    candidates = db.query(Candidate).order_by(desc(Candidate.created_at)).all()
    return [
        {
            "id": str(c.id),
            "full_name": c.full_name,
            "email": c.email,
            "phone": c.phone,
            "role_applied": c.role_applied,
            "experience_level": c.experience_level,
            "experience_years": c.experience_years,
            "skills": c.skills or [],
            "interviews_count": len(c.interviews),
        }
        for c in candidates
    ]

# ----------------- 3. INTERVIEW SCHEDULING & SESSIONS -----------------
@router.post("/interviews/schedule")
def schedule_interview(data: ScheduleInterviewRequest, db: Session = Depends(get_db)):
    candidate = db.query(Candidate).filter(Candidate.id == uuid.UUID(data.candidate_id)).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    session = IntelligentInterviewEngine.create_interview_session(
        db=db,
        candidate_id=str(candidate.id),
        job_title=data.job_title,
        job_description=data.job_description,
        difficulty_level=data.difficulty_level,
        duration_minutes=data.duration_minutes,
        total_questions=data.total_questions
    )

    return {
        "interview_id": str(session.id),
        "candidate_name": candidate.full_name,
        "job_title": session.job_title,
        "status": session.status,
        "total_questions": session.total_questions,
        "duration_minutes": session.duration_minutes
    }

@router.get("/interviews/{interview_id}")
def get_interview_details(interview_id: str, db: Session = Depends(get_db)):
    session = db.query(InterviewSession).filter(InterviewSession.id == uuid.UUID(interview_id)).first()
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")

    questions_data = []
    for q in session.questions:
        questions_data.append({
            "id": str(q.id),
            "order_index": q.order_index,
            "question_text": q.question_text,
            "category": q.category,
            "difficulty": q.difficulty,
            "model_answer": q.model_answer,
            "is_ai_generated": q.is_ai_generated,
            "is_follow_up": q.is_follow_up,
            "source": q.source,
            "candidate_transcript": q.candidate_transcript,
            "score": q.score,
            "ai_evaluation": q.ai_evaluation,
            "answered_at": q.answered_at.isoformat() if q.answered_at else None,
        })

    assessment_data = None
    if session.assessment:
        assessment_data = {
            "overall_score": session.assessment.overall_score,
            "technical_score": session.assessment.technical_score,
            "skills_score": session.assessment.skills_score,
            "problem_solving_score": session.assessment.problem_solving_score,
            "communication_score": session.assessment.communication_score,
            "strengths": session.assessment.strengths or [],
            "areas_for_improvement": session.assessment.areas_for_improvement or [],
            "evidence_based_feedback": session.assessment.evidence_based_feedback,
            "interview_summary": session.assessment.interview_summary,
            "recruiter_notes": session.assessment.recruiter_notes,
            "recruiter_verdict": session.assessment.recruiter_verdict,
        }

    return {
        "id": str(session.id),
        "candidate": {
            "id": str(session.candidate.id),
            "full_name": session.candidate.full_name,
            "email": session.candidate.email,
            "phone": session.candidate.phone,
            "role_applied": session.candidate.role_applied,
            "skills": session.candidate.skills or [],
        },
        "job_title": session.job_title,
        "job_description": session.job_description,
        "difficulty_level": session.difficulty_level,
        "duration_minutes": session.duration_minutes,
        "total_questions": session.total_questions,
        "current_question_index": session.current_question_index,
        "status": session.status,
        "recording_path": session.recording_path,
        "has_recording": bool(session.recording_path and os.path.exists(session.recording_path)),
        "questions": questions_data,
        "assessment": assessment_data,
        "created_at": session.created_at.isoformat(),
        "started_at": session.started_at.isoformat() if session.started_at else None,
        "completed_at": session.completed_at.isoformat() if session.completed_at else None,
    }

# ----------------- 4. LIVE INTERVIEW FLOW & RECORDING -----------------
@router.post("/interviews/{interview_id}/start")
def start_interview(interview_id: str, consent: bool = True, db: Session = Depends(get_db)):
    session = db.query(InterviewSession).filter(InterviewSession.id == uuid.UUID(interview_id)).first()
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")

    session.status = "IN_PROGRESS"
    session.consent_given = consent
    session.started_at = datetime.now(timezone.utc)
    db.commit()
    return {"status": "IN_PROGRESS", "started_at": session.started_at.isoformat()}

@router.post("/interviews/{interview_id}/submit-answer")
def submit_question_answer(interview_id: str, data: SubmitAnswerRequest, db: Session = Depends(get_db)):
    session = db.query(InterviewSession).filter(InterviewSession.id == uuid.UUID(interview_id)).first()
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")

    iq = db.query(InterviewQuestion).filter(InterviewQuestion.id == uuid.UUID(data.question_id)).first()
    if not iq:
        raise HTTPException(status_code=404, detail="Interview question not found")

    # Evaluate answer using clinical rubric
    eval_res = EvaluationEngine.evaluate_response(
        question_text=iq.question_text,
        model_answer=iq.model_answer,
        candidate_transcript=data.transcript,
        role=session.job_title,
        difficulty=iq.difficulty
    )

    iq.candidate_transcript = data.transcript
    iq.duration_seconds = data.duration_seconds
    iq.score = eval_res["score"]
    iq.ai_evaluation = eval_res
    iq.answered_at = datetime.now(timezone.utc)
    
    session.current_question_index += 1
    db.commit()

    # Dynamic follow-up generation check
    follow_up_text = None
    if len(session.questions) < session.total_questions + 1 and eval_res["score"] < 70 and not iq.is_follow_up:
        follow_up_text = IntelligentInterviewEngine.generate_follow_up(
            current_question=iq.question_text,
            candidate_transcript=data.transcript,
            role=session.job_title
        )

    return {
        "status": "ANSWER_RECORDED",
        "score": eval_res["score"],
        "evaluation": eval_res,
        "follow_up_question": follow_up_text,
    }

@router.post("/interviews/{interview_id}/upload-recording")
async def upload_interview_recording(
    interview_id: str,
    recording: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    session = db.query(InterviewSession).filter(InterviewSession.id == uuid.UUID(interview_id)).first()
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")

    os.makedirs(RECORDINGS_DIR, exist_ok=True)
    filename = f"rec_{interview_id}_{int(datetime.now().timestamp())}.webm"
    file_path = os.path.join(RECORDINGS_DIR, filename)

    contents = await recording.read()
    with open(file_path, "wb") as f:
        f.write(contents)

    session.recording_path = file_path
    db.commit()

    return {"status": "RECORDING_UPLOADED", "file_path": file_path, "size_bytes": len(contents)}

@router.get("/interviews/{interview_id}/recording")
def stream_interview_recording(interview_id: str, db: Session = Depends(get_db)):
    session = db.query(InterviewSession).filter(InterviewSession.id == uuid.UUID(interview_id)).first()
    if not session or not session.recording_path or not os.path.exists(session.recording_path):
        raise HTTPException(status_code=404, detail="Recording file not found")

    return FileResponse(
        path=session.recording_path,
        media_type="video/webm",
        filename=os.path.basename(session.recording_path)
    )

@router.post("/interviews/{interview_id}/complete")
def complete_interview(interview_id: str, db: Session = Depends(get_db)):
    session = db.query(InterviewSession).filter(InterviewSession.id == uuid.UUID(interview_id)).first()
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")

    session.status = "COMPLETED"
    session.completed_at = datetime.now(timezone.utc)

    # Compile all evaluations for assessment
    evaluations = []
    for q in session.questions:
        if q.ai_evaluation:
            evaluations.append(q.ai_evaluation)
        elif q.score is not None:
            evaluations.append({
                "score": q.score,
                "technical_score": q.score,
                "skills_score": q.score,
                "problem_solving_score": q.score,
                "communication_score": q.score,
                "keywords_matched": [],
            })

    assessment_res = EvaluationEngine.generate_overall_assessment(
        evaluations=evaluations,
        candidate_name=session.candidate.full_name,
        role=session.job_title,
        job_description=session.job_description
    )

    assessment = session.assessment
    if not assessment:
        assessment = InterviewAssessment(interview_id=session.id)
        db.add(assessment)

    assessment.overall_score = assessment_res["overall_score"]
    assessment.technical_score = assessment_res["technical_score"]
    assessment.skills_score = assessment_res["skills_score"]
    assessment.problem_solving_score = assessment_res["problem_solving_score"]
    assessment.communication_score = assessment_res["communication_score"]
    assessment.strengths = assessment_res["strengths"]
    assessment.areas_for_improvement = assessment_res["areas_for_improvement"]
    assessment.evidence_based_feedback = assessment_res["evidence_based_feedback"]
    assessment.interview_summary = assessment_res["interview_summary"]

    db.commit()
    return {"status": "COMPLETED", "overall_score": assessment.overall_score}

# ----------------- 5. RECRUITER DASHBOARD & REVIEWS -----------------
@router.get("/recruiter/interviews")
def list_recruiter_interviews(db: Session = Depends(get_db)):
    sessions = db.query(InterviewSession).order_by(desc(InterviewSession.created_at)).all()
    results = []
    for s in sessions:
        results.append({
            "id": str(s.id),
            "candidate_name": s.candidate.full_name,
            "candidate_email": s.candidate.email,
            "job_title": s.job_title,
            "difficulty_level": s.difficulty_level,
            "status": s.status,
            "questions_count": len(s.questions),
            "overall_score": s.assessment.overall_score if s.assessment else None,
            "verdict": s.assessment.recruiter_verdict if s.assessment else "PENDING_REVIEW",
            "has_recording": bool(s.recording_path and os.path.exists(s.recording_path)),
            "created_at": s.created_at.isoformat(),
            "completed_at": s.completed_at.isoformat() if s.completed_at else None,
        })
    return results

@router.post("/recruiter/interviews/{interview_id}/feedback")
def submit_recruiter_feedback(
    interview_id: str,
    data: RecruiterFeedbackRequest,
    db: Session = Depends(get_db)
):
    session = db.query(InterviewSession).filter(InterviewSession.id == uuid.UUID(interview_id)).first()
    if not session or not session.assessment:
        raise HTTPException(status_code=404, detail="Interview assessment not found")

    session.assessment.recruiter_verdict = data.verdict
    session.assessment.recruiter_notes = data.notes
    session.assessment.reviewed_at = datetime.now(timezone.utc)
    db.commit()

    return {"status": "FEEDBACK_SAVED", "verdict": data.verdict}

