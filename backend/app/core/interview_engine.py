import random
from typing import List, Optional
from sqlalchemy.orm import Session
from app.db.models import QuestionBank, Candidate, InterviewSession, InterviewQuestion

class IntelligentInterviewEngine:
    @staticmethod
    def select_questions_for_interview(
        db: Session,
        role: str,
        difficulty: str = "Fresher",
        count: int = 5,
        skills: Optional[List[str]] = None
    ) -> List[QuestionBank]:
        """
        Intelligently selects relevant questions from Question Bank PDF source.
        1. Exact match on role and difficulty level.
        2. Fallback to same role across adjacent difficulties if needed.
        3. Never repeats questions within the interview.
        """
        query = db.query(QuestionBank).filter(
            QuestionBank.role.ilike(f"%{role}%"),
            QuestionBank.difficulty.ilike(f"%{difficulty}%"),
            QuestionBank.is_ai_generated == False
        )
        questions = query.all()

        if len(questions) < count:
            # Fallback to all questions for this role
            role_all = db.query(QuestionBank).filter(
                QuestionBank.role.ilike(f"%{role}%"),
                QuestionBank.is_ai_generated == False
            ).all()
            questions = role_all

        if not questions:
            # Fallback to Staff Nurse (General baseline)
            questions = db.query(QuestionBank).filter(
                QuestionBank.role.ilike("%Staff Nurse%"),
                QuestionBank.is_ai_generated == False
            ).all()

        # Randomize selection without repeating
        selected = random.sample(questions, min(count, len(questions)))
        
        # Sort by difficulty progression: Fresher -> Junior -> Senior
        diff_order = {"Fresher": 1, "Junior": 2, "Senior": 3}
        selected.sort(key=lambda q: diff_order.get(q.difficulty, 2))
        return selected

    @staticmethod
    def create_interview_session(
        db: Session,
        candidate_id: str,
        job_title: str,
        job_description: Optional[str] = None,
        difficulty_level: str = "Fresher",
        duration_minutes: int = 15,
        total_questions: int = 5
    ) -> InterviewSession:
        session = InterviewSession(
            candidate_id=candidate_id,
            job_title=job_title,
            job_description=job_description,
            difficulty_level=difficulty_level,
            duration_minutes=duration_minutes,
            total_questions=total_questions,
            status="SCHEDULED"
        )
        db.add(session)
        db.flush()

        # Select questions from Question Bank
        selected_questions = IntelligentInterviewEngine.select_questions_for_interview(
            db=db,
            role=job_title,
            difficulty=difficulty_level,
            count=total_questions
        )

        for idx, q_bank in enumerate(selected_questions):
            iq = InterviewQuestion(
                interview_id=session.id,
                question_bank_id=q_bank.id,
                order_index=idx + 1,
                question_text=q_bank.question,
                category=q_bank.category,
                difficulty=q_bank.difficulty,
                model_answer=q_bank.model_answer,
                is_ai_generated=q_bank.is_ai_generated,
                source=q_bank.source
            )
            db.add(iq)

        db.commit()
        db.refresh(session)
        return session

    @staticmethod
    def generate_follow_up(
        current_question: str,
        candidate_transcript: str,
        role: str
    ) -> Optional[str]:
        """
        Dynamically generates a relevant follow-up question if candidate answer is brief or incomplete.
        Clearly marked as AI generated.
        """
        if not candidate_transcript or len(candidate_transcript.split()) < 8:
            return f"Could you provide a specific clinical scenario or protocol step you followed when dealing with that?"
        
        lower = candidate_transcript.lower()
        if "escalat" not in lower and "doctor" not in lower and "clinician" not in lower:
            return "How and at what threshold would you escalate this clinical situation to the attending physician?"
        if "document" not in lower and "chart" not in lower:
            return "What specific details would you ensure are recorded in the patient chart or incident report for this case?"
        
        return "What would be your next priority once the immediate patient condition is stabilized?"

