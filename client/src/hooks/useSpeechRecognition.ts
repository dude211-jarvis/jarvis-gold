/**
 * Arabic speech-to-text using the Web Speech API (SpeechRecognition).
 * Supported in Chrome/Edge/Safari; gracefully reports unsupported browsers.
 */
import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionResultEvent = {
  resultIndex: number;
  results: {
    length: number;
    [i: number]: { isFinal: boolean; 0: { transcript: string } };
  };
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeechRecognition(opts: {
  onFinalTranscript: (text: string) => void;
}) {
  const [supported] = useState(() => getRecognitionCtor() != null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const onFinalRef = useRef(opts.onFinalTranscript);
  onFinalRef.current = opts.onFinalTranscript;
  // Live mode: keep listening continuously; auto-restart after each result,
  // but stay muted (no restart) while JARVIS itself is speaking.
  const liveRef = useRef(false);
  const mutedRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      liveRef.current = false;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      recRef.current?.abort();
    };
  }, []);

  const stop = useCallback(() => {
    liveRef.current = false;
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    recRef.current?.stop();
    setListening(false);
  }, []);

  const startInternal = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    setError(null);
    setInterim("");

    const rec = new Ctor();
    recRef.current = rec;
    rec.lang = "ar-SA";
    rec.continuous = false;
    rec.interimResults = true;

    let finalText = "";

    rec.onresult = e => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      setInterim(interimText || finalText);
    };

    rec.onend = () => {
      setListening(false);
      setInterim("");
      const text = finalText.trim();
      if (text) onFinalRef.current(text);
      // Live mode: seamlessly resume listening unless muted (JARVIS speaking)
      if (liveRef.current && !mutedRef.current) {
        restartTimerRef.current = setTimeout(() => {
          if (liveRef.current && !mutedRef.current) startInternal();
        }, 350);
      }
    };

    rec.onerror = e => {
      setListening(false);
      setInterim("");
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        liveRef.current = false;
        setError("يرجى السماح باستخدام الميكروفون من إعدادات المتصفح");
      } else if (e.error === "no-speech") {
        if (!liveRef.current) setError("لم أسمع شيئاً، حاول مرة أخرى");
      } else if (e.error !== "aborted") {
        setError("تعذر التعرف على الصوت، حاول مجدداً");
      }
    };

    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, []);

  const start = useCallback(() => {
    if (listening) return;
    startInternal();
  }, [listening, startInternal]);

  /** Toggle continuous hands-free listening. */
  const startLive = useCallback(() => {
    liveRef.current = true;
    mutedRef.current = false;
    if (!listening) startInternal();
  }, [listening, startInternal]);

  /** Pause/resume live listening without leaving live mode (used while JARVIS speaks). */
  const setMuted = useCallback(
    (muted: boolean) => {
      mutedRef.current = muted;
      if (muted) {
        recRef.current?.abort();
        setListening(false);
        setInterim("");
      } else if (liveRef.current) {
        restartTimerRef.current = setTimeout(() => {
          if (liveRef.current && !mutedRef.current) startInternal();
        }, 400);
      }
    },
    [startInternal]
  );

  const [, forceRender] = useState(0);
  const isLive = () => liveRef.current;

  const stopLive = useCallback(() => {
    liveRef.current = false;
    mutedRef.current = false;
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    recRef.current?.abort();
    setListening(false);
    setInterim("");
    forceRender(n => n + 1);
  }, []);

  const startLiveWrapped = useCallback(() => {
    startLive();
    forceRender(n => n + 1);
  }, [startLive]);

  return {
    supported,
    listening,
    interim,
    error,
    start,
    stop,
    startLive: startLiveWrapped,
    stopLive,
    setMuted,
    isLive,
  };
}
