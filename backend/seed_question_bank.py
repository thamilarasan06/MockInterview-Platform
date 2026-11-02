import os
import re
import sys
import pypdf
from app.db.session import SessionLocal
from app.db.models import QuestionBank

PDF_PATH = "question_bank.pdf"

def extract_and_seed_questions():
    if not os.path.exists(PDF_PATH):
        print(f"Error: {PDF_PATH} not found.")
        return

    reader = pypdf.PdfReader(PDF_PATH)
    print(f"Reading {len(reader.pages)} pages from {PDF_PATH}...")

    role_pattern = re.compile(r'^\s*(\d{1,2})\.\s+(.+)$')
    level_pattern = re.compile(r'^(Fresher|Junior|Senior)\s+Level$', re.IGNORECASE)
    q_pattern = re.compile(r'^(Q\d+[\.:]?\s*)(.+)$', re.IGNORECASE)
    ans_pattern = re.compile(r'^(Answer:\s*)(.+)$', re.IGNORECASE)

    current_role_id = None
    current_role_name = None
    current_level = "Fresher"
    current_q = None
    current_ans = None
    current_page = 1

    extracted = []

    for page_idx, page in enumerate(reader.pages):
        page_num = page_idx + 1
        if page_num in [1, 2]:
            continue # Cover and TOC
        text = page.extract_text() or ''
        lines = text.split('\n')
        for line in lines:
            line_clean = line.strip()
            if not line_clean or 'Nursing Interview Question Bank' in line_clean or line_clean.startswith('Page '):
                continue

            m_role = role_pattern.match(line_clean)
            if m_role and not line_clean.lower().startswith('q'):
                current_role_id = int(m_role.group(1))
                current_role_name = m_role.group(2).strip()
                continue

            m_level = level_pattern.match(line_clean)
            if m_level:
                current_level = m_level.group(1).capitalize()
                continue

            m_q = q_pattern.match(line_clean)
            if m_q:
                if current_q and current_ans and current_role_name:
                    extracted.append({
                        "role": current_role_name,
                        "difficulty": current_level,
                        "question": current_q.strip(),
                        "model_answer": current_ans.strip(),
                        "page_number": current_page,
                        "category": f"{current_role_name} - {current_level} Competency",
                    })
                current_q = m_q.group(2).strip()
                current_ans = None
                current_page = page_num
                continue

            m_ans = ans_pattern.match(line_clean)
            if m_ans:
                current_ans = m_ans.group(2).strip()
                continue

            if current_ans is not None:
                current_ans += ' ' + line_clean
            elif current_q is not None and not line_clean.startswith('Q'):
                current_q += ' ' + line_clean

    if current_q and current_ans and current_role_name:
        extracted.append({
            "role": current_role_name,
            "difficulty": current_level,
            "question": current_q.strip(),
            "model_answer": current_ans.strip(),
            "page_number": current_page,
            "category": f"{current_role_name} - {current_level} Competency",
        })

    print(f"Successfully parsed {len(extracted)} questions from PDF.")

    # Save to PostgreSQL
    db = SessionLocal()
    try:
        # Check if already seeded
        existing_count = db.query(QuestionBank).count()
        if existing_count > 0:
            print(f"Database already contains {existing_count} questions. Cleaning and re-seeding...")
            db.query(QuestionBank).delete()
            db.commit()

        for item in extracted:
            q_entry = QuestionBank(
                role=item["role"],
                department="Nursing & Clinical Operations",
                category=item["category"],
                topic=item["role"],
                difficulty=item["difficulty"],
                question=item["question"],
                model_answer=item["model_answer"],
                source="Nursing_Interview_Question_Bank_21_Roles.pdf",
                page_number=item["page_number"],
                is_ai_generated=False,
            )
            db.add(q_entry)
        db.commit()
        print(f"Successfully seeded {len(extracted)} verified PDF questions into PostgreSQL question_bank table!")
    finally:
        db.close()

if __name__ == "__main__":
    extract_and_seed_questions()

