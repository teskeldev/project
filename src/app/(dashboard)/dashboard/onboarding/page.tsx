"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Code,
  MessageSquare,
  Terminal,
  Bot,
  Check,
  Loader2,
  SkipForward,
  FolderPlus,
} from "lucide-react";
import { useProject } from "@/lib/store/project";
import { ApiClientError, type ProjectTemplate } from "@/lib/client/api";

type OnboardingStep = 1 | 2 | 3 | 4 | 5;

const templates: { id: ProjectTemplate; label: string; description: string }[] = [
  { id: "blank", label: "Blank", description: "Empty project, start from scratch" },
  { id: "node", label: "Node.js", description: "Node.js with TypeScript" },
  { id: "react", label: "React", description: "React with Vite and TypeScript" },
  { id: "python", label: "Python", description: "Python project with venv" },
];

const tourHighlights = [
  { icon: Code, title: "Editor", description: "Full-featured code editor with syntax highlighting, IntelliSense, and multi-file support." },
  { icon: MessageSquare, title: "Chat", description: "AI-powered chat that understands your codebase and can write code for you." },
  { icon: Terminal, title: "Terminal", description: "Integrated terminal to run commands, install packages, and manage your project." },
  { icon: Bot, title: "Agents", description: "Background agents that can autonomously complete complex tasks across your project." },
];

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 200 : -200,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 200 : -200,
    opacity: 0,
  }),
};

export default function OnboardingPage() {
  const router = useRouter();
  const { projects, activeWorkspace, createNewProject, setActiveProject } = useProject();

  const [step, setStep] = useState<OnboardingStep>(1);
  const [direction, setDirection] = useState(1);
  const [name, setName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate>("blank");
  const [projectName, setProjectName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goNext = () => {
    setDirection(1);
    setStep((s) => Math.min(5, s + 1) as OnboardingStep);
    setError(null);
  };

  const goBack = () => {
    setDirection(-1);
    setStep((s) => Math.max(1, s - 1) as OnboardingStep);
    setError(null);
  };

  const completeOnboarding = useCallback(async () => {
    setSubmitting(true);
    try {
      await fetch("/api/user/onboarding", { method: "POST" });
      router.push("/dashboard");
    } catch {
      router.push("/dashboard");
    }
  }, [router]);

  const handleNameSubmit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await fetch("/api/user/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      }).catch(() => {});
      // Update name is best-effort; proceed regardless
      goNext();
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateProject = async () => {
    if (!projectName.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const template: ProjectTemplate = selectedTemplate;
      const project = await createNewProject({ name: projectName.trim(), template });
      setActiveProject(project.id);
      goNext();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to create project"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-full items-center justify-center overflow-hidden bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/30 px-6">
      <div className="w-full max-w-lg">
        {/* Progress indicator */}
        <div className="mb-8 flex items-center justify-center gap-2">
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                s === step
                  ? "w-8 bg-blue-600"
                  : s < step
                    ? "w-4 bg-blue-300"
                    : "w-4 bg-gray-200"
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            {/* Step 1: Welcome + name */}
            {step === 1 && (
              <div className="text-center">
                <div className="mb-6 inline-flex items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-4 shadow-lg shadow-blue-200/50">
                  <Sparkles size={32} className="text-white" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Welcome to Teskel
                </h1>
                <p className="mt-2 text-sm text-gray-500">
                  Let&apos;s get you set up in just a few steps.
                </p>
                <div className="mt-8">
                  <label htmlFor="onboarding-name" className="mb-2 block text-left text-xs font-medium text-gray-600">
                    What should we call you?
                  </label>
                  <input
                    id="onboarding-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleNameSubmit();
                    }}
                  />
                </div>
                <button
                  onClick={() => void handleNameSubmit()}
                  disabled={!name.trim() || submitting}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      Continue
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Step 2: Create workspace */}
            {step === 2 && (
              <div className="text-center">
                <div className="mb-6 inline-flex items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 p-4 shadow-lg shadow-purple-200/50">
                  <FolderPlus size={32} className="text-white" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Your Workspace
                </h1>
                <p className="mt-2 text-sm text-gray-500">
                  {activeWorkspace
                    ? `You already have a workspace: "${activeWorkspace.name}". You can continue or create a new one.`
                    : "A workspace organizes your projects and team members."}
                </p>

                {!activeWorkspace && (
                  <div className="mt-8">
                    <label htmlFor="onboarding-workspace" className="mb-2 block text-left text-xs font-medium text-gray-600">
                      Workspace name
                    </label>
                    <input
                      id="onboarding-workspace"
                      type="text"
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      placeholder="My Workspace"
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      autoFocus
                    />
                  </div>
                )}

                <div className="mt-6 flex items-center justify-center gap-3">
                  <button
                    onClick={goBack}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
                  >
                    <ArrowLeft size={16} />
                    Back
                  </button>
                  <button
                    onClick={goNext}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                  >
                    {activeWorkspace ? "Continue" : "Skip for now"}
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Create project */}
            {step === 3 && (
              <div className="text-center">
                <h1 className="text-2xl font-bold text-gray-900">
                  Create Your First Project
                </h1>
                <p className="mt-2 text-sm text-gray-500">
                  {projects.length > 0
                    ? "You already have projects. Create another or skip this step."
                    : "Choose a template to get started quickly."}
                </p>

                <div className="mt-6 space-y-4">
                  <div>
                    <label htmlFor="onboarding-project-name" className="mb-2 block text-left text-xs font-medium text-gray-600">
                      Project name
                    </label>
                    <input
                      id="onboarding-project-name"
                      type="text"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="my-awesome-app"
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-left text-xs font-medium text-gray-600">
                      Template
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {templates.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSelectedTemplate(t.id)}
                          className={`rounded-xl border px-4 py-3 text-left transition-all ${
                            selectedTemplate === t.id
                              ? "border-blue-400 bg-blue-50 ring-2 ring-blue-100"
                              : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          <p className="text-sm font-medium text-gray-900">
                            {t.label}
                          </p>
                          <p className="mt-0.5 text-[11px] text-gray-500">
                            {t.description}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {error && (
                    <p className="text-xs text-red-600">{error}</p>
                  )}
                </div>

                <div className="mt-6 flex items-center justify-center gap-3">
                  <button
                    onClick={goBack}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
                  >
                    <ArrowLeft size={16} />
                    Back
                  </button>
                  {projects.length > 0 && (
                    <button
                      onClick={goNext}
                      className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
                    >
                      <SkipForward size={16} />
                      Skip
                    </button>
                  )}
                  <button
                    onClick={() => void handleCreateProject()}
                    disabled={!projectName.trim() || submitting}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <>
                        Create Project
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Quick tour */}
            {step === 4 && (
              <div className="text-center">
                <h1 className="text-2xl font-bold text-gray-900">
                  Quick Tour
                </h1>
                <p className="mt-2 text-sm text-gray-500">
                  Here&apos;s what you can do with Teskel.
                </p>

                <div className="mt-8 grid grid-cols-2 gap-3">
                  {tourHighlights.map((item) => (
                    <div
                      key={item.title}
                      className="rounded-xl border border-gray-200 bg-white p-4 text-left transition-all hover:border-gray-300 hover:shadow-sm"
                    >
                      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
                        <item.icon size={18} className="text-blue-600" />
                      </div>
                      <p className="text-sm font-medium text-gray-900">
                        {item.title}
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
                        {item.description}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex items-center justify-center gap-3">
                  <button
                    onClick={goBack}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
                  >
                    <ArrowLeft size={16} />
                    Back
                  </button>
                  <button
                    onClick={goNext}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                  >
                    Finish Setup
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Step 5: Done */}
            {step === 5 && (
              <div className="text-center">
                <div className="mb-6 inline-flex items-center justify-center rounded-full bg-green-100 p-4">
                  <Check size={32} className="text-green-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">
                  You&apos;re All Set!
                </h1>
                <p className="mt-2 text-sm text-gray-500">
                  Your workspace is ready. Start building something amazing.
                </p>

                <button
                  onClick={() => void completeOnboarding()}
                  disabled={submitting}
                  className="mt-8 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      Go to Dashboard
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
