/**
 * Alert banner that appears when the owner's Gemini API key fails
 * (quota exhausted / invalid). JARVIS also announces it vocally once.
 */
import { trpc } from "@/lib/trpc";
import { AlertTriangle } from "lucide-react";
import { useEffect, useRef } from "react";

type Voice = { speak: (text: string) => void; supported: boolean };

export default function ApiHealthBanner({ voice }: { voice: Voice }) {
  const { data } = trpc.ai.health.useQuery(undefined, { refetchInterval: 60_000 });
  const announced = useRef(false);

  const critical = data && !data.ok && (data.status === "quota_exhausted" || data.status === "invalid_key");

  useEffect(() => {
    if (critical && !announced.current && voice.supported) {
      announced.current = true;
      voice.speak(
        data!.status === "quota_exhausted"
          ? "Sir, I must inform you: the Gemini API quota has been exhausted. Please review your Google AI Studio account."
          : "Sir, the Gemini API key appears to be invalid. Please issue a new key from Google AI Studio."
      );
    }
    if (!critical) announced.current = false;
  }, [critical, data, voice]);

  if (!critical) return null;

  return (
    <div
      role="alert"
      className="hud-panel flex items-center gap-3 border-red-400/40 bg-red-500/10 p-3">
      <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />
      <div className="flex-1">
        <p className="font-tech text-[10px] tracking-widest text-red-300">API ALERT</p>
        <p className="font-cairo text-sm text-red-100">
          {data!.message}{" "}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-red-300/50 hover:text-red-50">
            فتح Google AI Studio
          </a>
        </p>
      </div>
    </div>
  );
}
