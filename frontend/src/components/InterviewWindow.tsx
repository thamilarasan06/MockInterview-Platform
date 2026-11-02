"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, Volume2, ShieldCheck, Play, ArrowRight, CheckCircle2, Clock, Award, FileText } from "lucide-react";
import { api, InterviewSessionData } from "@/lib/api";

export default function InterviewWindow({ interviewId }: { interviewId: string }) {
  const [interview, setInterview] = useState<InterviewSessionData | null>(null);
  const [stage, setStage] = useState<"SETUP" | "READY" | "INTERVIEW" | "COMPLETED">("SETUP");
  
  // Media streams
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [audioLevel, setAudioLevel] = useState(0);
  const [consentAgreed, setConsentAgreed] = useState(false);

  // Video recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);

  // Question & TTS / STT State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const recognitionRef = useRef<any>(null);

  // 1. Load Interview Details
  useEffect(() => {
    loadInterview();
  }, [interviewId]);

  const loadInterview = async () => {
    try {
      const data = await api.getInterview(interviewId);
      setInterview(data);
      if (data.status === "COMPLETED") {
        setStage("COMPLETED");
      }
    } catch (err) {
      console.error("Error loading interview:", err);
    }
  };

  // 2. Hardware permissions & setup
  const requestMediaPermissions = async () => {
    try {
      const userStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true,
      });
      setStream(userStream);
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = userStream;
      }

      // Audio visualizer setup
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      const micSource = audioCtx.createMediaStreamSource(userStream);
      micSource.connect(analyser);
      analyser.fftSize = 256;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        setAudioLevel(Math.min(100, Math.round((sum / dataArray.length) * 2)));
        requestAnimationFrame(checkVolume);
      };
      checkVolume();

      setStage("READY");
    } catch (err) {
      alert("Please allow camera and microphone access to proceed with the AI interview.");
    }
  };

  const toggleCamera = () => {
    if (stream) {
      stream.getVideoTracks().forEach((track) => (track.enabled = !cameraEnabled));
      setCameraEnabled(!cameraEnabled);
    }
  };

  const toggleMic = () => {
    if (stream) {
      stream.getAudioTracks().forEach((track) => (track.enabled = !micEnabled));
      setMicEnabled(!micEnabled);
    }
  };

  // 3. Speech Recognition (STT) setup
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const reco = new SpeechRecognition();
        reco.continuous = true;
        reco.interimResults = true;
        reco.lang = "en-US";

        reco.onresult = (event: any) => {
          let currentInterim = "";
          let finalBlock = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalBlock += event.results[i][0].transcript + " ";
            } else {
              currentInterim += event.results[i][0].transcript;
            }
          }
          if (finalBlock) {
            setTranscript((prev) => prev + finalBlock);
          }
          setInterimTranscript(currentInterim);
        };

        reco.onerror = (e: any) => {
          console.warn("Speech recognition notice:", e.error);
        };

        recognitionRef.current = reco;
      }
    }
  }, []);

  // 4. Text-To-Speech (TTS)
  const speakQuestion = (text: string, onEnd?: () => void) => {
    if (!("speechSynthesis" in window)) {
      if (onEnd) onEnd();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.05;
    
    // Pick standard female/clear voice if available
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find((v) => v.lang.startsWith("en") && (v.name.includes("Female") || v.name.includes("Natural") || v.name.includes("Google")));
    if (englishVoice) utterance.voice = englishVoice;

    setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      if (onEnd) onEnd();
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      if (onEnd) onEnd();
    };
    window.speechSynthesis.speak(utterance);
  };

  // 5. Start Interview
  const beginInterviewSession = async () => {
    if (!consentAgreed) {
      alert("Please check the consent box to record your interview session.");
      return;
    }

    // Try Fullscreen mode
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (e) {
      // Fullscreen optional
    }

    await api.startInterview(interviewId, true);
    setStage("INTERVIEW");

    // Initialize MediaRecorder
    if (stream) {
      try {
        const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8,opus" });
        recordedChunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) recordedChunksRef.current.push(e.data);
        };
        recorder.start(1000); // 1-second chunks
        mediaRecorderRef.current = recorder;
      } catch (err) {
        console.warn("MediaRecorder fallback:", err);
      }
    }

    startQuestion(0);
  };

  const startQuestion = (index: number) => {
    if (!interview || !interview.questions[index]) return;
    setCurrentIndex(index);
    setTranscript("");
    setInterimTranscript("");
    setQuestionStartTime(Date.now());

    // AI Avatar speaks question, then starts listening
    const qText = interview.questions[index].question_text;
    speakQuestion(`Question ${index + 1}: ${qText}`, () => {
      startListening();
    });
  };

  const startListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        // Already started
        setIsListening(true);
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      setIsListening(false);
    }
  };

  // 6. Next Question / Submit Answer
  const handleNextQuestion = async () => {
    if (!interview) return;
    setIsSubmitting(true);
    stopListening();
    window.speechSynthesis.cancel();

    const currentQ = interview.questions[currentIndex];
    const duration = Math.round((Date.now() - questionStartTime) / 1000);
    const finalAnswer = (transcript + " " + interimTranscript).trim();

    try {
      await api.submitAnswer(interviewId, {
        question_id: currentQ.id,
        transcript: finalAnswer,
        duration_seconds: duration,
      });

      if (currentIndex + 1 < interview.questions.length) {
        startQuestion(currentIndex + 1);
      } else {
        finishInterview();
      }
    } catch (err) {
      alert("Error saving answer. Proceeding to next question.");
      if (currentIndex + 1 < interview.questions.length) {
        startQuestion(currentIndex + 1);
      } else {
        finishInterview();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // 7. Finish & Upload Recording
  const finishInterview = async () => {
    setStage("COMPLETED");
    stopListening();
    window.speechSynthesis.cancel();

    // Stop MediaRecorder and upload blob
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.onstop = async () => {
        const fullBlob = new Blob(recordedChunksRef.current, { type: "video/webm" });
        await api.uploadRecording(interviewId, fullBlob);
        await api.completeInterview(interviewId);
        loadInterview();
      };
      mediaRecorderRef.current.stop();
    } else {
      await api.completeInterview(interviewId);
      loadInterview();
    }
  };

  // Timer countdown
  useEffect(() => {
    if (stage === "INTERVIEW") {
      const interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [stage]);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (!interview) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 px-6 py-4 flex items-center justify-between backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-slate-950">
            H
          </div>
          <div>
            <h1 className="font-semibold text-lg text-white">HospiHire AI Interviewer</h1>
            <p className="text-xs text-slate-400">
              Role: <span className="text-emerald-400 font-medium">{interview.job_title}</span> • Level: {interview.difficulty_level}
            </p>
          </div>
        </div>

        {stage === "INTERVIEW" && (
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 bg-slate-800 px-4 py-1.5 rounded-full border border-slate-700">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span className="font-mono text-sm text-emerald-400 font-bold">{formatTimer(timerSeconds)}</span>
            </div>
            <div className="text-xs text-slate-400">
              Question <span className="text-white font-bold">{currentIndex + 1}</span> of {interview.questions.length}
            </div>
          </div>
        )}
      </header>

      {/* STAGE 1 & 2: SETUP & HARDWARE TEST */}
      {(stage === "SETUP" || stage === "READY") && (
        <main className="flex-1 max-w-4xl w-full mx-auto p-8 flex flex-col justify-center">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-2">Device & Environment Readiness Check</h2>
            <p className="text-slate-400 text-sm mb-6">
              Welcome, <span className="text-white font-medium">{interview.candidate.full_name}</span>. Please test your camera, microphone, and verify consent before entering the interview room.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              {/* Camera Preview */}
              <div className="relative rounded-xl overflow-hidden bg-slate-950 aspect-video border border-slate-800 flex items-center justify-center">
                <video
                  ref={videoPreviewRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${!cameraEnabled ? "hidden" : ""}`}
                />
                {!stream && (
                  <button
                    onClick={requestMediaPermissions}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 font-medium text-sm rounded-lg transition"
                  >
                    Enable Camera & Mic
                  </button>
                )}
                {stream && !cameraEnabled && (
                  <p className="text-xs text-slate-500">Camera preview paused</p>
                )}

                {/* Stream Controls */}
                {stream && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-3 bg-slate-900/90 px-4 py-1.5 rounded-full border border-slate-700 backdrop-blur">
                    <button onClick={toggleCamera} className="p-1.5 text-slate-300 hover:text-white">
                      {cameraEnabled ? <Video className="w-4 h-4 text-emerald-400" /> : <VideoOff className="w-4 h-4 text-rose-500" />}
                    </button>
                    <button onClick={toggleMic} className="p-1.5 text-slate-300 hover:text-white">
                      {micEnabled ? <Mic className="w-4 h-4 text-emerald-400" /> : <MicOff className="w-4 h-4 text-rose-500" />}
                    </button>
                  </div>
                )}
              </div>

              {/* Instructions & Mic Meter */}
              <div className="space-y-5">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>Microphone Input Level</span>
                    <span className="font-mono text-emerald-400">{audioLevel}%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-75"
                      style={{ width: `${audioLevel}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Speak a few words to confirm the green meter reacts to your voice.
                  </p>
                </div>

                <div className="space-y-2 text-xs text-slate-300">
                  <p className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    Questions are sourced directly from the verified Clinical Question Bank.
                  </p>
                  <p className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    AI evaluates clinical answers against professional rubrics without judging appearance or accents.
                  </p>
                  <p className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    Session video and audio are securely recorded for recruiter review.
                  </p>
                </div>

                <label className="flex items-start gap-3 p-3 bg-slate-950/60 border border-slate-800 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentAgreed}
                    onChange={(e) => setConsentAgreed(e.target.checked)}
                    className="mt-0.5 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span className="text-xs text-slate-400">
                    I grant explicit consent to be recorded for this interview and understand that my responses will be reviewed by the clinical hiring committee.
                  </span>
                </label>

                <button
                  disabled={!stream || !consentAgreed}
                  onClick={beginInterviewSession}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 font-semibold text-white rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-sm"
                >
                  <Play className="w-4 h-4 fill-white" />
                  Enter Fullscreen AI Interview Room
                </button>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* STAGE 3: LIVE AI INTERVIEW */}
      {stage === "INTERVIEW" && interview.questions[currentIndex] && (
        <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl w-full mx-auto">
          {/* Left: AI Avatar & Candidate Video */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {/* AI Avatar */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center text-center relative overflow-hidden shadow-xl">
              <div className={`w-28 h-28 rounded-full border-4 ${isSpeaking ? "border-emerald-400 scale-105 shadow-[0_0_25px_rgba(16,185,129,0.4)]" : "border-slate-700"} flex items-center justify-center bg-slate-800 transition-all duration-300 relative mb-4`}>
                <span className="text-4xl">👩‍⚕️</span>
                {isSpeaking && (
                  <span className="absolute -bottom-2 bg-emerald-500 text-[10px] font-bold text-slate-950 px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                    Speaking
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-white text-base">Dr. Sarah (AI Interviewer)</h3>
              <p className="text-xs text-slate-400">Clinical Evaluation Specialist</p>

              <button
                onClick={() => speakQuestion(interview.questions[currentIndex].question_text)}
                className="mt-4 flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-950/40 border border-emerald-800/50 px-3 py-1.5 rounded-lg transition"
              >
                <Volume2 className="w-3.5 h-3.5" /> Repeat Question
              </button>
            </div>

            {/* Candidate Live Feed */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden relative aspect-video flex items-center justify-center shadow-xl">
              <video
                ref={(el) => {
                  if (el && stream) el.srcObject = stream;
                }}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute top-3 left-3 bg-red-600/90 text-[11px] font-semibold text-white px-2.5 py-1 rounded-full flex items-center gap-1.5 backdrop-blur animate-pulse">
                <span className="w-2 h-2 rounded-full bg-white"></span>
                REC
              </div>
              <div className="absolute bottom-3 left-3 bg-slate-950/80 px-3 py-1 rounded-lg text-xs text-slate-300 backdrop-blur">
                {interview.candidate.full_name}
              </div>
            </div>
          </div>

          {/* Right: Question Card & Speech-to-Text Transcript */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-950/80 text-emerald-400 border border-emerald-800/50">
                    {interview.questions[currentIndex].category}
                  </span>
                  <span className="text-xs text-slate-400">
                    Level: <strong className="text-slate-200">{interview.questions[currentIndex].difficulty}</strong>
                  </span>
                </div>

                <h2 className="text-xl font-bold text-white leading-relaxed mb-4">
                  {interview.questions[currentIndex].question_text}
                </h2>

                <div className="text-[11px] text-slate-500 mb-6 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Verified PDF Question • {interview.questions[currentIndex].source}
                </div>

                {/* Speech to Text Box */}
                <div className="border border-slate-800 bg-slate-950 rounded-xl p-4 min-h-[160px] max-h-[220px] overflow-y-auto space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 border-b border-slate-800/60 pb-2">
                    <span className="flex items-center gap-1.5">
                      <Mic className={`w-3.5 h-3.5 ${isListening ? "text-emerald-400 animate-pulse" : "text-slate-500"}`} />
                      {isListening ? "Listening to your speech..." : "Microphone idle"}
                    </span>
                    <button
                      onClick={() => (isListening ? stopListening() : startListening())}
                      className="text-xs text-emerald-400 hover:underline"
                    >
                      {isListening ? "Pause STT" : "Resume STT"}
                    </button>
                  </div>

                  <p className="text-sm text-slate-200 leading-relaxed">
                    {transcript}
                    <span className="text-slate-400 italic">{interimTranscript}</span>
                    {!transcript && !interimTranscript && (
                      <span className="text-slate-600 italic">
                        Speak clearly into your microphone. Your transcribed speech will appear here in real time...
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-6 border-t border-slate-800 flex items-center justify-between mt-6">
                <p className="text-xs text-slate-400">
                  Ensure all clinical points are verbalized before continuing.
                </p>
                <button
                  disabled={isSubmitting}
                  onClick={handleNextQuestion}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 font-semibold text-white text-sm rounded-xl transition flex items-center gap-2 shadow-lg"
                >
                  {isSubmitting ? (
                    "Evaluating..."
                  ) : currentIndex + 1 < interview.questions.length ? (
                    <>
                      Next Question <ArrowRight className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      Complete Interview <CheckCircle2 className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* STAGE 4: INTERVIEW COMPLETED & SUMMARY */}
      {stage === "COMPLETED" && (
        <main className="flex-1 max-w-4xl w-full mx-auto p-8 flex flex-col justify-center">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <h2 className="text-3xl font-bold text-white">Interview Submitted Successfully!</h2>
            <p className="text-slate-400 text-sm max-w-lg mx-auto">
              Thank you, <span className="text-white font-medium">{interview.candidate.full_name}</span>. Your responses and session recording have been securely delivered to the recruiter dashboard.
            </p>

            {interview.assessment && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto pt-4">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <div className="text-2xl font-bold text-emerald-400">{interview.assessment.overall_score}%</div>
                  <div className="text-xs text-slate-400 mt-1">Overall Score</div>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <div className="text-2xl font-bold text-blue-400">{interview.assessment.technical_score}%</div>
                  <div className="text-xs text-slate-400 mt-1">Technical</div>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <div className="text-2xl font-bold text-purple-400">{interview.assessment.problem_solving_score}%</div>
                  <div className="text-xs text-slate-400 mt-1">Problem Solving</div>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <div className="text-2xl font-bold text-amber-400">{interview.assessment.communication_score}%</div>
                  <div className="text-xs text-slate-400 mt-1">Communication</div>
                </div>
              </div>
            )}

            <div className="pt-6">
              <a
                href="/recruiter"
                className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-xl transition"
              >
                Go to Recruiter Dashboard
              </a>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}

