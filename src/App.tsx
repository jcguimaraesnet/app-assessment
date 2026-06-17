import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';

type Phase = 'start' | 'quiz' | 'finish';
type SetupStep = 'input' | 'loading' | 'loaded';
type BankTab = 'easy' | 'hard';

type QuestionsState = {
  phase: Phase;
  settingsOpen: boolean;
  setupOpen: boolean;
  setupStep: SetupStep;
  studentName: string;
  copied: boolean;
  courseName: string;
  draftCourseName: string;
  bankOpen: boolean;
  activeBank: BankTab;
  easyText: string;
  hardText: string;
  draftEasyText: string;
  draftHardText: string;
  easyCount: number;
  hardCount: number;
  seconds: number;
  draftEasy: number;
  draftHard: number;
  draftSeconds: number;
  questions: string[];
  current: number;
  revealed: boolean;
  expired: boolean;
  remainingMs: number;
};

const DEFAULT_EASY = 6;
const DEFAULT_HARD = 2;
const DEFAULT_SECONDS = 60;
const STORAGE_KEY = 'assessment_bank_v1';

const SEED_EASY = [
  'What is a variable, and what is it used for?',
  'Explain the difference between a "for" loop and a "while" loop.',
  'What does it mean for a function to "return" a value?',
  'Describe the difference between an integer and a floating-point number.',
  'What is an array (or list), and how do you access one of its elements?',
  'What is the purpose of an "if" statement?',
  'What is a string, and give one operation you can perform on it.',
  'What does it mean to comment your code, and why is it useful?',
].join('\n');

const SEED_HARD = [
  'Compare the time complexity of searching in a sorted array versus a hash table.',
  'Explain how recursion works, and describe a case where it can cause a stack overflow.',
  'What is the difference between pass-by-value and pass-by-reference?',
  'Describe what a race condition is and how you might prevent one.',
].join('\n');

function shuffle<T>(items: T[]) {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function parseLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith('//'));
}

function countLines(text: string) {
  return parseLines(text).length;
}

function formatTime(totalMs: number) {
  const secsLeft = Math.max(0, Math.ceil(totalMs / 1000));
  const minutes = Math.floor(secsLeft / 60);
  const seconds = secsLeft % 60;
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

function clampCount(value: number) {
  return Math.max(0, value);
}

function Assessment() {
  const [state, setState] = useState<QuestionsState>(() => {
    let easyText = SEED_EASY;
    let hardText = SEED_HARD;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { easy?: string; hard?: string };
        if (typeof parsed.easy === 'string') easyText = parsed.easy;
        if (typeof parsed.hard === 'string') hardText = parsed.hard;
      }
    } catch {
      // ignore malformed storage
    }

    return {
      phase: 'start',
      settingsOpen: false,
      setupOpen: false,
      setupStep: 'input',
      studentName: '',
      copied: false,
      courseName: '',
      draftCourseName: '',
      bankOpen: false,
      activeBank: 'easy',
      easyText,
      hardText,
      draftEasyText: easyText,
      draftHardText: hardText,
      easyCount: DEFAULT_EASY,
      hardCount: DEFAULT_HARD,
      seconds: DEFAULT_SECONDS,
      draftEasy: DEFAULT_EASY,
      draftHard: DEFAULT_HARD,
      draftSeconds: DEFAULT_SECONDS,
      questions: [],
      current: 0,
      revealed: false,
      expired: false,
      remainingMs: DEFAULT_SECONDS * 1000,
    };
  });

  const timerRef = useRef<number | null>(null);
  const celebrationRef = useRef<number | null>(null);
  const resizeRef = useRef<(() => void) | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    return () => {
      clearTimer();
      stopCelebration();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearTimer() {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function stopCelebration() {
    if (celebrationRef.current !== null) {
      window.cancelAnimationFrame(celebrationRef.current);
      celebrationRef.current = null;
    }
    if (resizeRef.current) {
      window.removeEventListener('resize', resizeRef.current);
      resizeRef.current = null;
    }
  }

  function openSettings() {
    setState((prev) => ({
      ...prev,
      settingsOpen: true,
      draftEasy: prev.easyCount,
      draftHard: prev.hardCount,
      draftSeconds: prev.seconds,
      draftCourseName: prev.courseName,
    }));
  }

  function saveSettings() {
    setState((prev) => {
      if (prev.draftEasy + prev.draftHard < 1) return prev;
      return {
        ...prev,
        settingsOpen: false,
        easyCount: prev.draftEasy,
        hardCount: prev.draftHard,
        seconds: prev.draftSeconds,
        courseName: prev.draftCourseName.trim(),
        remainingMs: prev.draftSeconds * 1000,
      };
    });
  }

  function openBank() {
    setState((prev) => ({
      ...prev,
      bankOpen: true,
      activeBank: 'easy',
      draftEasyText: prev.easyText,
      draftHardText: prev.hardText,
    }));
  }

  function saveBank() {
    setState((prev) => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ easy: prev.draftEasyText, hard: prev.draftHardText }),
        );
      } catch {
        // ignore storage failures
      }
      return {
        ...prev,
        bankOpen: false,
        easyText: prev.draftEasyText,
        hardText: prev.draftHardText,
      };
    });
  }

  function openSetup() {
    setState((prev) => ({
      ...prev,
      setupOpen: true,
      setupStep: 'input',
      copied: false,
    }));
  }

  function closeModal(type: 'settingsOpen' | 'bankOpen' | 'setupOpen') {
    setState((prev) => ({ ...prev, [type]: false } as QuestionsState));
  }

  function loadSet() {
    setState((prev) => {
      if (!prev.studentName.trim()) return prev;

      const easy = parseLines(prev.easyText);
      const hard = parseLines(prev.hardText);
      const selected = shuffle(easy).slice(0, prev.easyCount).concat(shuffle(hard).slice(0, prev.hardCount));

      window.setTimeout(() => {
        setState((later) => {
          if (!selected.length) {
            return { ...later, setupStep: 'input' };
          }
          return { ...later, questions: selected, setupStep: 'loaded', copied: false };
        });
      }, 1000);

      return { ...prev, setupStep: 'loading' };
    });
  }

  function copySummary() {
    setState((prev) => {
      const lines = prev.questions.map((question, index) => `${index + 1}. ${question}`).join('\n');
      const text = `Student: ${prev.studentName}\n\n${lines}`;

      const done = () => {
        setState((current) => ({ ...current, copied: true }));
        window.setTimeout(() => {
          setState((current) => ({ ...current, copied: false }));
        }, 2000);
      };

      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
      } else {
        fallbackCopy(text, done);
      }

      return prev;
    });
  }

  function fallbackCopy(text: string, done?: () => void) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      done?.();
    } catch {
      // ignore copy failures
    }
  }

  function startQuiz() {
    clearTimer();
    stopCelebration();
    setState((prev) => ({
      ...prev,
      setupOpen: false,
      phase: 'quiz',
      current: 0,
      revealed: false,
      expired: false,
      remainingMs: prev.seconds * 1000,
    }));
  }

  function startTimer(seconds: number) {
    clearTimer();
    const total = seconds * 1000;
    const endsAt = Date.now() + total;

    setState((prev) => ({ ...prev, remainingMs: total }));

    timerRef.current = window.setInterval(() => {
      const remaining = Math.max(0, endsAt - Date.now());
      if (remaining <= 0) {
        clearTimer();
        setState((prev) => ({ ...prev, remainingMs: 0, expired: true }));
      } else {
        setState((prev) => ({ ...prev, remainingMs: remaining }));
      }
    }, 100);
  }

  function revealFirst() {
    setState((prev) => ({ ...prev, revealed: true, expired: false }));
    startTimer(state.seconds);
  }

  function goTo(index: number) {
    setState((prev) => {
      if (index < 0 || index >= prev.questions.length) return prev;
      return { ...prev, current: index, revealed: true, expired: false };
    });
    startTimer(state.seconds);
  }

  function nextAction() {
    if (state.current === state.questions.length - 1) {
      finish();
    } else {
      goTo(state.current + 1);
    }
  }

  function navTo(index: number) {
    setState((prev) => {
      if (index < 0 || index >= prev.questions.length) return prev;
      return { ...prev, current: index, revealed: false, expired: false, remainingMs: prev.seconds * 1000 };
    });
    clearTimer();
  }

  function finish() {
    clearTimer();
    setState((prev) => ({ ...prev, phase: 'finish' }));
    startCelebration();
  }

  function restart() {
    clearTimer();
    stopCelebration();
    setState((prev) => ({
      ...prev,
      phase: 'start',
      current: 0,
      revealed: false,
      expired: false,
    }));
  }

  function startCelebration() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    resizeRef.current = resize;
    window.addEventListener('resize', resize);

    const colors = ['#ffd76b', '#ffffff', '#8fb4ff', '#6c8cff', '#ffe9a8', '#bcd0ff'];
    const confetti: Array<{ x: number; y: number; vx: number; vy: number; rot: number; vr: number; w: number; h: number; color: string }> = [];
    const particles: Array<{ x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }> = [];
    let frame = 0;

    const burst = (x: number, y: number) => {
      const count = 64;
      for (let i = 0; i < count; i += 1) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.2;
        const speed = 2 + Math.random() * 3.8;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: 1.6 + Math.random() * 2,
        });
      }
    };

    const addConfetti = () => {
      confetti.push({
        x: Math.random() * canvas.clientWidth,
        y: -12,
        vx: (Math.random() - 0.5) * 1.3,
        vy: 1.5 + Math.random() * 2.2,
        rot: Math.random() * 6,
        vr: (Math.random() - 0.5) * 0.35,
        w: 5 + Math.random() * 6,
        h: 8 + Math.random() * 8,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    };

    const loop = () => {
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      frame += 1;
      if (frame % 40 === 0) burst(canvas.clientWidth * (0.18 + Math.random() * 0.64), canvas.clientHeight * (0.14 + Math.random() * 0.34));
      if (frame % 5 === 0) addConfetti();

      for (const particle of particles) {
        particle.vy += 0.045;
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vx *= 0.99;
        particle.life -= 0.012;
      }
      for (const confettiItem of confetti) {
        confettiItem.x += confettiItem.vx;
        confettiItem.y += confettiItem.vy;
        confettiItem.rot += confettiItem.vr;
      }

      while (particles.length && particles[0].life <= 0) particles.shift();
      while (confetti.length && confetti[0].y > canvas.clientHeight + 20) confetti.shift();

      for (const particle of particles) {
        ctx.globalAlpha = Math.max(0, particle.life);
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      for (const confettiItem of confetti) {
        ctx.save();
        ctx.translate(confettiItem.x, confettiItem.y);
        ctx.rotate(confettiItem.rot);
        ctx.fillStyle = confettiItem.color;
        ctx.fillRect(-confettiItem.w / 2, -confettiItem.h / 2, confettiItem.w, confettiItem.h);
        ctx.restore();
      }

      celebrationRef.current = window.requestAnimationFrame(loop);
    };

    burst(canvas.clientWidth * 0.3, canvas.clientHeight * 0.32);
    burst(canvas.clientWidth * 0.7, canvas.clientHeight * 0.28);
    loop();
  }

  const totalQuestions = Math.max(1, state.seconds * 1000);
  const fraction = Math.max(0, Math.min(1, state.remainingMs / totalQuestions));
  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  const lowTime = state.remainingMs <= 10000 && state.remainingMs > 0;
  const questionCount = state.questions.length;
  const isLast = state.current === questionCount - 1;
  const easyCount = countLines(state.draftEasyText);
  const hardCount = countLines(state.draftHardText);
  const activeBankIsEasy = state.activeBank === 'easy';
  const bankText = activeBankIsEasy ? state.draftEasyText : state.draftHardText;
  const draftTotal = state.draftEasy + state.draftHard;
  const loadedCountLabel = `${state.questions.length} loaded`;

  const dots = useMemo(
    () =>
      state.questions.map((_, index) => {
        const current = index === state.current;
        const past = index < state.current;
        return {
          key: index,
          width: current ? '28px' : '8px',
          color: current ? '#2a4d9b' : past ? '#9fb0d6' : '#dde2ec',
        };
      }),
    [state.current, state.questions],
  );

  function onCourseInput(event: FormEvent<HTMLInputElement>) {
    const value = event.currentTarget.value;
    setState((prev) => ({ ...prev, draftCourseName: value }));
  }

  function onStudentInput(event: FormEvent<HTMLInputElement>) {
    const value = event.currentTarget.value;
    setState((prev) => ({ ...prev, studentName: value }));
  }

  function onBankInput(event: FormEvent<HTMLTextAreaElement>) {
    const value = event.currentTarget.value;
    setState((prev) => (prev.activeBank === 'easy' ? { ...prev, draftEasyText: value } : { ...prev, draftHardText: value }));
  }

  function stopPropagation(event: React.MouseEvent<HTMLDivElement>) {
    event.stopPropagation();
  }

  const bankPlaceholder = activeBankIsEasy ? 'Paste your easy questions here — one per line.' : 'Paste your hard questions here — one per line.';
  const bankCountLabel = `${easyCount} easy · ${hardCount} hard — hard questions are placed last`;
  const setupLoadDisabled = !state.studentName.trim();
  const saveDisabled = draftTotal < 1;
  const nextLabel = isLast ? 'Finish' : 'Next';

  return (
    <div className="app-shell">
      {state.phase === 'start' && (
        <section className="screen screen--start">
          <div className="orb orb--one" />
          <div className="orb orb--two" />
          <div className="top-actions">
            <button className="icon-button" aria-label="Edit questions" onClick={openBank}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="7" x2="14" y2="7" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="17" x2="12" y2="17" />
                <circle cx="18.5" cy="7" r="1.5" fill="currentColor" stroke="none" />
                <circle cx="16.5" cy="17" r="1.5" fill="currentColor" stroke="none" />
              </svg>
            </button>
            <button className="icon-button icon-button--rotate" aria-label="Settings" onClick={openSettings}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.14 12.94a7.49 7.49 0 0 0 .05-.94 7.49 7.49 0 0 0-.05-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.61-.22l-2.39.96a7.3 7.3 0 0 0-1.62-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.5.5 0 0 0-.61.22L2.74 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.03.31-.05.62-.05.94 0 .32.02.63.05.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.14.24.43.34.69.22l2.39-.96c.49.38 1.03.7 1.62.94l.36 2.54c.05.24.25.42.5.42h3.84c.25 0 .46-.18.5-.42l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.26.12.55.02.69-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z" />
              </svg>
            </button>
          </div>

          <div className="hero">
            <div className="eyebrow">Oral Assessment</div>
            <h1>Assessment</h1>
            {state.courseName.trim() ? <p>{state.courseName}</p> : null}
            <button className="primary-button primary-button--light" onClick={openSetup}>
              Setup
            </button>
          </div>
        </section>
      )}

      {state.phase === 'quiz' && (
        <section className="screen screen--quiz">
          <header className="progress-strip" aria-hidden="true">
            {dots.map((dot) => (
              <span key={dot.key} style={{ width: dot.width, background: dot.color }} />
            ))}
          </header>

          <main className="quiz-content">
            <div className="quiz-card">
              <div className="question-label">Question {state.current + 1}</div>

              {!state.revealed ? (
                <div className="show-panel">
                  <button className="primary-button" onClick={revealFirst}>
                    Show question
                  </button>
                  <p>You&apos;ll have {formatTime(state.seconds * 1000)} once it&apos;s revealed.</p>
                </div>
              ) : !state.expired ? (
                <div className="question-panel">
                  <p className="question-text">{state.questions[state.current] ?? ''}</p>
                  <div className="timer-ring">
                    <svg viewBox="0 0 172 172" aria-hidden="true">
                      <circle cx="86" cy="86" r={radius} fill="none" stroke="#e4e8f1" strokeWidth="9" />
                      <circle
                        cx="86"
                        cy="86"
                        r={radius}
                        fill="none"
                        stroke={lowTime ? '#c2820b' : '#2a4d9b'}
                        strokeWidth="9"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={circumference * (1 - fraction)}
                      />
                    </svg>
                    <div className="timer-ring__content">
                      <div className="timer-ring__time" style={{ color: lowTime ? '#c2820b' : '#2a4d9b' }}>
                        {formatTime(state.remainingMs)}
                      </div>
                      <div className="timer-ring__label">remaining</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="expired-panel">
                  <div className="timer-ring timer-ring--expired">
                    <svg viewBox="0 0 172 172" aria-hidden="true">
                      <circle cx="86" cy="86" r={radius} fill="none" stroke="#e4e8f1" strokeWidth="9" />
                      <circle cx="86" cy="86" r={radius} fill="none" stroke="#c7ccd8" strokeWidth="9" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={0} />
                    </svg>
                    <div className="timer-ring__content">
                      <div className="timer-ring__time timer-ring__time--muted">0:00</div>
                      <div className="timer-ring__label timer-ring__label--muted">time&apos;s up</div>
                    </div>
                  </div>
                  <button className="primary-button" onClick={nextAction}>
                    {nextLabel}
                  </button>
                </div>
              )}
            </div>
          </main>

          <footer className="nav-bar">
            <button className="nav-icon" aria-label="Restart" onClick={restart}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 4 3 10 9 10" />
                <path d="M3.5 14a8 8 0 1 0 1.4-7.4L3 10" />
              </svg>
            </button>
            <button className="nav-icon" aria-label="Previous question" disabled={state.current === 0} onClick={() => navTo(state.current - 1)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 6 9 12 15 18" />
              </svg>
            </button>
            <span className="nav-label">navigate</span>
            <button className="nav-icon" aria-label="Next question" disabled={isLast} onClick={() => navTo(state.current + 1)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 6 15 12 9 18" />
              </svg>
            </button>
          </footer>
        </section>
      )}

      {state.phase === 'finish' && (
        <section className="screen screen--finish">
          <canvas ref={canvasRef} className="celebration-canvas" />
          <div className="finish-copy">
            <div className="eyebrow eyebrow--bright">Assessment complete</div>
            <h1>Well done</h1>
            <p>You&apos;ve reached the end. Thank you for your answers.</p>
            <button className="primary-button primary-button--ghost" onClick={restart}>
              Start over
            </button>
          </div>
        </section>
      )}

      {state.settingsOpen ? (
        <Modal onClose={() => closeModal('settingsOpen')}>
          <div className="modal-card">
            <h2>Assessment settings</h2>
            <p>These apply to this session only.</p>

            <div className="field-block">
              <label>
                Course name <span>(optional)</span>
              </label>
              <input value={state.draftCourseName} onChange={onCourseInput} placeholder="e.g. Introduction to Programming" />
            </div>

            <Stepper
              label="Easy questions"
              description="Placed first in the set"
              value={state.draftEasy}
              onDecrement={() => setState((prev) => ({ ...prev, draftEasy: clampCount(prev.draftEasy - 1) }))}
              onIncrement={() => setState((prev) => ({ ...prev, draftEasy: prev.draftEasy + 1 }))}
            />
            <Stepper
              label="Hard questions"
              description="Placed last in the set"
              value={state.draftHard}
              onDecrement={() => setState((prev) => ({ ...prev, draftHard: clampCount(prev.draftHard - 1) }))}
              onIncrement={() => setState((prev) => ({ ...prev, draftHard: prev.draftHard + 1 }))}
            />
            <Stepper
              label="Time per question"
              description="Countdown for each question"
              value={state.draftSeconds}
              suffix="s"
              onDecrement={() => setState((prev) => ({ ...prev, draftSeconds: Math.max(15, prev.draftSeconds - 15) }))}
              onIncrement={() => setState((prev) => ({ ...prev, draftSeconds: prev.draftSeconds + 15 }))}
            />

            <div className="total-row">
              <span>Total</span>
              <strong>{draftTotal} {draftTotal === 1 ? 'question' : 'questions'}</strong>
            </div>

            <div className="modal-actions">
              <button className="secondary-button" onClick={() => closeModal('settingsOpen')}>
                Cancel
              </button>
              <button className="primary-button" disabled={saveDisabled} onClick={saveSettings}>
                Save
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {state.bankOpen ? (
        <Modal onClose={() => closeModal('bankOpen')}>
          <div className="modal-card modal-card--wide">
            <h2>Question bank</h2>
            <p>Paste your questions — one per line. Easy questions come first; hard questions are always placed last. Students never see which is which.</p>

            <div className="segmented-control">
              <button className={activeBankIsEasy ? 'segmented-control__button is-active' : 'segmented-control__button'} onClick={() => setState((prev) => ({ ...prev, activeBank: 'easy' }))}>
                <span className="dot dot--blue" />
                Easy <span>{easyCount}</span>
              </button>
              <button className={!activeBankIsEasy ? 'segmented-control__button is-active' : 'segmented-control__button'} onClick={() => setState((prev) => ({ ...prev, activeBank: 'hard' }))}>
                <span className="dot dot--amber" />
                Hard <span>{hardCount}</span>
              </button>
            </div>

            <textarea rows={9} value={bankText} onChange={onBankInput} placeholder={bankPlaceholder} />
            <div className="bank-meta">{bankCountLabel}</div>

            <div className="modal-actions">
              <button className="secondary-button" onClick={() => closeModal('bankOpen')}>
                Cancel
              </button>
              <button className="primary-button" onClick={saveBank}>
                Save
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {state.setupOpen ? (
        <Modal onClose={() => closeModal('setupOpen')}>
          <div className="modal-card modal-card--setup">
            {state.setupStep === 'input' && (
              <>
                <h2>Setup</h2>
                <p>Enter the student's name, then load the question set.</p>
                <div className="field-block">
                  <label>Student name</label>
                  <input value={state.studentName} onChange={onStudentInput} placeholder="e.g. Maria Silva" />
                </div>
                <div className="modal-actions">
                  <button className="secondary-button" onClick={() => closeModal('setupOpen')}>
                    Cancel
                  </button>
                  <button className="primary-button" disabled={setupLoadDisabled} onClick={loadSet}>
                    Load
                  </button>
                </div>
              </>
            )}

            {state.setupStep === 'loading' && (
              <div className="loading-state">
                <div className="spinner" />
                <h2>Loading questions…</h2>
              </div>
            )}

            {state.setupStep === 'loaded' && (
              <>
                <h2>Ready</h2>
                <p>Question set loaded for this student.</p>
                <div className="info-pill-row">
                  <span className="info-label">Student</span>
                  <strong>{state.studentName.trim() || '—'}</strong>
                </div>
                <div className="info-pill-row info-pill-row--questions">
                  <span className="info-label">Questions</span>
                  <strong>{loadedCountLabel}</strong>
                  <span className="muted">hidden</span>
                </div>
                <div className="modal-actions">
                  <button className="secondary-button" onClick={copySummary}>
                    {state.copied ? 'Copied!' : 'Copy questions'}
                  </button>
                  <button className="primary-button" onClick={startQuiz}>
                    Start
                  </button>
                </div>
              </>
            )}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal-surface" onClick={stopModalClick} role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  );
}

function stopModalClick(event: React.MouseEvent<HTMLDivElement>) {
  event.stopPropagation();
}

function Stepper({
  label,
  description,
  value,
  onDecrement,
  onIncrement,
  suffix,
}: {
  label: string;
  description: string;
  value: number;
  onDecrement: () => void;
  onIncrement: () => void;
  suffix?: string;
}) {
  return (
    <div className="stepper-row">
      <div>
        <strong>{label}</strong>
        <span>{description}</span>
      </div>
      <div className="stepper-controls">
        <button type="button" onClick={onDecrement} aria-label={`Decrease ${label}`}>
          −
        </button>
        <div className="stepper-value">
          {value}
          {suffix ?? ''}
        </div>
        <button type="button" onClick={onIncrement} aria-label={`Increase ${label}`}>
          +
        </button>
      </div>
    </div>
  );
}

export default Assessment;
