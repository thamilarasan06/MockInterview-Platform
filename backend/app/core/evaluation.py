import re
import math
from typing import List, Dict, Any, Optional

class EvaluationEngine:
    @staticmethod
    def evaluate_response(
        question_text: str,
        model_answer: Optional[str],
        candidate_transcript: str,
        role: str,
        difficulty: str
    ) -> Dict[str, Any]:
        """
        Evaluates candidate speech transcript against clinical rubric and model answer.
        Does NOT evaluate facial expressions, accents, appearance or emotions.
        Strictly evidence-based textual & clinical competency analysis.
        """
        if not candidate_transcript or len(candidate_transcript.strip()) < 5:
            return {
                "score": 15.0,
                "technical_score": 10.0,
                "skills_score": 15.0,
                "problem_solving_score": 15.0,
                "communication_score": 20.0,
                "feedback": "Candidate gave little to no audible verbal response to this question.",
                "keywords_matched": [],
                "key_missing_concepts": ["Did not articulate steps or rationale."],
            }

        transcript_lower = candidate_transcript.lower()
        model_lower = (model_answer or "").lower()

        # Stop words removal for clinical keyword extraction
        stop_words = {
            "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "with",
            "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
            "do", "does", "did", "i", "you", "he", "she", "it", "we", "they", "my",
            "your", "would", "should", "could", "also", "such", "than", "that", "this",
            "when", "where", "how", "what", "which", "who", "all", "any", "as", "by"
        }

        # Extract meaningful terms from model answer
        model_words = set(re.findall(r'\b[a-z]{3,}\b', model_lower)) - stop_words
        
        # Domain terms to boost
        domain_keywords = {
            "vital", "signs", "abcde", "airway", "breathing", "circulation", "oxygen",
            "medication", "rights", "allergies", "hygiene", "ppe", "aseptic", "escalate",
            "doctor", "clinician", "physician", "protocol", "document", "documentation",
            "patient", "safety", "infection", "sbar", "handover", "triage", "iv", "glucose",
            "sepsis", "resuscitation", "cpr", "catheter", "monitoring", "assessment",
            "reassess", "perfusion", "seizure", "stroke", "bleeding", "wound", "sterile"
        }

        matched_words = [w for w in model_words if w in transcript_lower]
        matched_domain = [w for w in domain_keywords if w in transcript_lower]
        
        # Match density
        target_len = max(len(model_words), 8)
        coverage_ratio = len(matched_words) / target_len
        coverage_ratio = min(1.0, coverage_ratio * 1.4) # Fair normalization

        # Word count & thoroughness
        words_count = len(transcript_lower.split())
        thoroughness = min(1.0, words_count / 35.0)

        # Dimension scores
        tech_base = (coverage_ratio * 70.0) + (len(matched_domain) * 4.0)
        technical_score = round(min(98.0, max(25.0, tech_base + (10.0 if thoroughness > 0.6 else 0))), 1)

        # Skills & protocol compliance
        skills_keywords = ["protocol", "policy", "standard", "procedure", "check", "verify", "monitor", "assess", "administer", "escalate", "document"]
        skills_matched = [w for w in skills_keywords if w in transcript_lower]
        skills_score = round(min(98.0, max(30.0, 35.0 + len(skills_matched) * 9.0 + (coverage_ratio * 25.0))), 1)

        # Problem solving & clinical prioritization (ABCDE, immediate actions, safety)
        ps_keywords = ["immediate", "first", "prioritize", "abcde", "emergency", "deterioration", "safety", "prevent", "call", "urgent", "reassess"]
        ps_matched = [w for w in ps_keywords if w in transcript_lower]
        problem_solving_score = round(min(98.0, max(30.0, 30.0 + len(ps_matched) * 11.0 + (thoroughness * 20.0))), 1)

        # Communication clarity
        comm_score = round(min(98.0, max(40.0, 50.0 + (min(words_count, 60) * 0.7))), 1)

        overall = round((technical_score * 0.35) + (skills_score * 0.25) + (problem_solving_score * 0.25) + (comm_score * 0.15), 1)

        missing = [w for w in list(model_words)[:6] if w not in transcript_lower]

        feedback_parts = []
        if overall >= 80:
            feedback_parts.append(f"Strong response demonstrating accurate clinical protocol for {role}.")
        elif overall >= 60:
            feedback_parts.append(f"Competent baseline response covering essential nursing safety steps.")
        else:
            feedback_parts.append(f"Basic answer; candidate needs to elaborate further on standard protocols.")

        if matched_domain:
            feedback_parts.append(f"Effective mention of clinical concepts: {', '.join(matched_domain[:4])}.")
        if missing:
            feedback_parts.append(f"Could strengthen by also mentioning: {', '.join(missing[:3])}.")

        return {
            "score": overall,
            "technical_score": technical_score,
            "skills_score": skills_score,
            "problem_solving_score": problem_solving_score,
            "communication_score": comm_score,
            "feedback": " ".join(feedback_parts),
            "keywords_matched": list(set(matched_words + matched_domain))[:8],
            "key_missing_concepts": missing[:4],
        }

    @staticmethod
    def generate_overall_assessment(
        evaluations: List[Dict[str, Any]],
        candidate_name: str,
        role: str,
        job_description: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Synthesizes individual question evaluations into a comprehensive competency report.
        """
        if not evaluations:
            return {
                "overall_score": 0.0,
                "technical_score": 0.0,
                "skills_score": 0.0,
                "problem_solving_score": 0.0,
                "communication_score": 0.0,
                "strengths": ["Interview not completed"],
                "areas_for_improvement": ["Complete interview to receive evaluation"],
                "evidence_based_feedback": "No answers submitted.",
                "interview_summary": "Session ended without answers.",
            }

        count = len(evaluations)
        avg_overall = round(sum(e["score"] for e in evaluations) / count, 1)
        avg_tech = round(sum(e["technical_score"] for e in evaluations) / count, 1)
        avg_skills = round(sum(e["skills_score"] for e in evaluations) / count, 1)
        avg_ps = round(sum(e["problem_solving_score"] for e in evaluations) / count, 1)
        avg_comm = round(sum(e["communication_score"] for e in evaluations) / count, 1)

        all_keywords = []
        for e in evaluations:
            all_keywords.extend(e.get("keywords_matched", []))
        top_keywords = list(dict.fromkeys(all_keywords))[:6]

        strengths = []
        improvements = []

        if avg_tech >= 75:
            strengths.append(f"Sound grasp of {role} clinical guidelines and safe operational standards.")
        else:
            improvements.append("Review standard specialty protocols and disease-specific interventions.")

        if avg_ps >= 75:
            strengths.append("Decisive escalation mindset during emergency scenarios and clinical deterioration.")
        else:
            improvements.append("Practice systematic ABCDE prioritization and structured clinical escalation.")

        if avg_skills >= 75:
            strengths.append("High adherence to medication safety rights, aseptic protocols, and documentation.")
        else:
            improvements.append("Emphasize cross-checking procedures and non-punitive incident reporting.")

        if avg_comm >= 75:
            strengths.append("Clear, structured verbal delivery suitable for multidisciplinary handovers (e.g. SBAR).")
        else:
            improvements.append("Structure answers with clear problem statement, action steps, and evaluation.")

        if not strengths:
            strengths.append(f"Basic familiarity with {role} routines and supportive care.")
        if not improvements:
            improvements.append("Maintain clinical knowledge through continuing nursing education (CNE).")

        summary = (
            f"{candidate_name} completed an AI technical interview for the {role} position across {count} questions. "
            f"Achieved an overall clinical competency score of {avg_overall}/100. "
            f"Demonstrated technical mastery ({avg_tech}/100) and communication ({avg_comm}/100). "
            f"All evaluations are based strictly on clinical rubrics and verifiable answers from the official question bank."
        )

        evidence = (
            f"Evidence Notes:\n"
            f"- Clinical concepts demonstrated: {', '.join(top_keywords) if top_keywords else 'General bedside care'}\n"
            f"- Technical accuracy: {avg_tech}%\n"
            f"- Practical skill & compliance: {avg_skills}%\n"
            f"- Problem solving & triage: {avg_ps}%\n"
            f"- Verbal communication: {avg_comm}%"
        )

        return {
            "overall_score": avg_overall,
            "technical_score": avg_tech,
            "skills_score": avg_skills,
            "problem_solving_score": avg_ps,
            "communication_score": avg_comm,
            "strengths": strengths,
            "areas_for_improvement": improvements,
            "evidence_based_feedback": evidence,
            "interview_summary": summary,
        }

