/**
 * JARVIS premium voice:
 * 1) Primary — Gemini TTS "Algenib" (deep, commanding) generated server-side
 *    on the user's own Gemini API key, returned as base64 WAV.
 * 2) Fallback — best available browser speechSynthesis voice when the
 *    Gemini quota is exhausted / key fails / network error.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";

const PREFERRED = [
  "Microsoft Guy Online (Natural)",
  "Microsoft Ryan Online (Natural)",
  "Microsoft Brian Online (Natural)",
  "Google UK English Male",
  "Google US English",
  "Daniel",
  "Alex",
];

function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  for (const pref of PREFERRED) {
    const v = voices.find(v => v.name.includes(pref));
    if (v) return v;
  }
  const natural = voices.find(v => v.lang.startsWith("en") && /natural|neural/i.test(v.name));
  if (natural) return natural;
  const enGB = voices.find(v => v.lang === "en-GB");
  if (enGB) return enGB;
  return voices.find(v => v.lang.startsWith("en")) ?? null;
}

export function useJarvisVoice() {
  const [speaking, setSpeaking] = useState(false);
  const [supported] = useState(
    () => typeof window !== "undefined" && ("speechSynthesis" in window || "Audio" in window)
  );
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const reqIdRef = useRef(0);
  const ttsMutation = trpc.ai.tts.useMutation();
  const ttsRef = useRef(ttsMutation);
  ttsRef.current = ttsMutation;

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const load = () => {
      voiceRef.current = pickVoice(window.speechSynthesis.getVoices());
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  const stop = useCallback(() => {
    reqIdRef.current++;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speakWithBrowser = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) {
      setSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    if (voiceRef.current) utter.voice = voiceRef.current;
    utter.lang = voiceRef.current?.lang ?? "en-US";
    utter.rate = 1.02;
    utter.pitch = 0.9;
    utter.onstart = () => setSpeaking(true);
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utter);
  }, []);

  const speak = useCallback(
    async (text: string) => {
      if (!supported || !text.trim()) return;
      stop();
      const myId = ++reqIdRef.current;
      setSpeaking(true);
      try {
        // Premium Algenib voice via the user's own Gemini key
        const res = await ttsRef.current.mutateAsync({ text: text.slice(0, 6000) });
        if (reqIdRef.current !== myId) return; // superseded by a newer speak/stop
        const audio = new Audio(`data:${res.mimeType};base64,${res.audioBase64}`);
        audioRef.current = audio;
        audio.onended = () => {
          if (reqIdRef.current === myId) setSpeaking(false);
        };
        audio.onerror = () => {
          if (reqIdRef.current === myId) setSpeaking(false);
        };
        await audio.play();
      } catch {
        // Quota exhausted / key error / autoplay rejection → browser voice
        if (reqIdRef.current !== myId) return;
        speakWithBrowser(text);
      }
    },
    [supported, stop, speakWithBrowser]
  );

  return { speak, stop, speaking, supported };
}
