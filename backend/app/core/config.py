import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:Thamil%402005@localhost:5432/mock_interview_db")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
SECRET_KEY = os.getenv("SECRET_KEY", "standalone-mock-interview-secret-2026")
RECORDINGS_DIR = os.getenv("RECORDINGS_DIR", "uploads/recordings")
RESUMES_DIR = os.getenv("RESUMES_DIR", "uploads/resumes")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

