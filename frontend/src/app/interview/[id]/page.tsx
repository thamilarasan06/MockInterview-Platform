import { Suspense } from "react";
import InterviewWindow from "@/components/InterviewWindow";

export const dynamic = "force-dynamic";

export default async function InterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">Loading Interview Room...</div>}>
      <InterviewWindow interviewId={resolved.id} />
    </Suspense>
  );
}
