import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, Text, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.session import Base

class QuestionBank(Base):
    __tablename__ = "question_bank"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    role = Column(String(100), nullable=False, index=True)
    department = Column(String(100), default="Nursing / Healthcare", index=True)
    category = Column(String(100), default="Clinical Practice & Patient Safety", index=True)
    topic = Column(String(150), nullable=True)
    difficulty = Column(String(50), default="Fresher", index=True) # Fresher, Junior, Senior
    question = Column(Text, nullable=False)
    model_answer = Column(Text, nullable=True)
    source = Column(String(100), default="Nursing_Interview_Question_Bank_21_Roles.pdf")
    page_number = Column(Integer, nullable=True)
    is_ai_generated = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name = Column(String(150), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    phone = Column(String(50), nullable=True)
    role_applied = Column(String(100), nullable=False)
    experience_level = Column(String(50), default="Fresher") # Fresher, Junior, Senior
    experience_years = Column(Integer, default=0)
    skills = Column(JSON, default=list) # ["CPR", "Medication Admin", ...]
    qualifications = Column(String(255), nullable=True)
    resume_path = Column(String(255), nullable=True)
    resume_text = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    interviews = relationship("InterviewSession", back_populates="candidate", cascade="all, delete-orphan")

class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id = Column(UUID(as_uuid=True), ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False)
    job_title = Column(String(150), nullable=False)
    job_description = Column(Text, nullable=True)
    difficulty_level = Column(String(50), default="Fresher")
    duration_minutes = Column(Integer, default=15)
    total_questions = Column(Integer, default=5)
    current_question_index = Column(Integer, default=0)
    status = Column(String(50), default="SCHEDULED") # SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED
    recording_path = Column(String(255), nullable=True)
    consent_given = Column(Boolean, default=False)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    candidate = relationship("Candidate", back_populates="interviews")
    questions = relationship("InterviewQuestion", back_populates="interview", cascade="all, delete-orphan", order_by="InterviewQuestion.order_index")
    assessment = relationship("InterviewAssessment", back_populates="interview", uselist=False, cascade="all, delete-orphan")

class InterviewQuestion(Base):
    __tablename__ = "interview_questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    interview_id = Column(UUID(as_uuid=True), ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False)
    question_bank_id = Column(UUID(as_uuid=True), ForeignKey("question_bank.id"), nullable=True)
    order_index = Column(Integer, nullable=False)
    question_text = Column(Text, nullable=False)
    category = Column(String(100), default="General")
    difficulty = Column(String(50), default="Fresher")
    model_answer = Column(Text, nullable=True)
    is_ai_generated = Column(Boolean, default=False)
    is_follow_up = Column(Boolean, default=False)
    source = Column(String(100), default="Question Bank PDF")
    
    # Candidate Response
    candidate_transcript = Column(Text, nullable=True)
    response_audio_path = Column(String(255), nullable=True)
    duration_seconds = Column(Integer, default=0)
    score = Column(Float, nullable=True) # 0 - 100
    ai_evaluation = Column(JSON, nullable=True) # rubric scoring breakdown
    answered_at = Column(DateTime(timezone=True), nullable=True)

    interview = relationship("InterviewSession", back_populates="questions")
    question_bank = relationship("QuestionBank")

class InterviewAssessment(Base):
    __tablename__ = "interview_assessments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    interview_id = Column(UUID(as_uuid=True), ForeignKey("interview_sessions.id", ondelete="CASCADE"), unique=True, nullable=False)
    overall_score = Column(Float, nullable=False) # 0 - 100
    technical_score = Column(Float, nullable=False)
    skills_score = Column(Float, nullable=False)
    problem_solving_score = Column(Float, nullable=False)
    communication_score = Column(Float, nullable=False)
    strengths = Column(JSON, default=list) # List of strengths
    areas_for_improvement = Column(JSON, default=list)
    evidence_based_feedback = Column(Text, nullable=True)
    interview_summary = Column(Text, nullable=False)
    rubric_breakdown = Column(JSON, default=dict)
    recruiter_notes = Column(Text, nullable=True)
    recruiter_verdict = Column(String(50), default="PENDING_REVIEW") # PENDING_REVIEW, SHORTLISTED, NEEDS_ROUND_2, ON_HOLD
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    interview = relationship("InterviewSession", back_populates="assessment")

