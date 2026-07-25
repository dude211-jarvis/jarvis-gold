/**
 * JARVIS smart chat — Arabic RTL conversation about any financial asset,
 * powered by ai.chat mutation (LLM with live-quote tool calling).
 */
import { trpc } from "@/lib/trpc";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { Loader2, Mic, MicOff, Radio, SendHorizontal, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";

type Voice = {
  speak: (text: string) => void;
  stop: () => void;
  speaking: boolean;
  supported: boolean;
};

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "ما رأيك بوضع الذهب اليوم؟",
  "كم سعر البيتكوين الآن؟",
  "قارن بين الذهب والفضة",
  "هل الوقت مناسب لشراء الذهب؟",
];

export default function JarvisChat({ voice }: { voice: Voice }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [liveMode, setLiveMode] = useState(false);
  const autoSpeakRef = useRef(autoSpeak);
  autoSpeakRef.current = autoSpeak;
  const scrollRef = useRef<HTMLDivElement>(null);

  // Voice output is English-only: translate the Arabic reply into a short
  // spoken English briefing server-side, then speak it.
  const speechText = trpc.ai.speechText.useMutation({
    onSuccess: res => voice.speak(res.spoken),
    onSettled: () => setSpeakingIdx(null),
  });
  const speechTextRef = useRef(speechText);
  speechTextRef.current = speechText;

  const onSpeakReply = (i: number, content: string) => {
    if (voice.speaking) {
      voice.stop();
      return;
    }
    setSpeakingIdx(i);
    speechText.mutate({ text: content });
  };

  const chat = trpc.ai.chat.useMutation({
    onSuccess: res => {
      setMessages(prev => [...prev, { role: "assistant", content: res.reply }]);
      // Auto-speak every new reply (full voice conversation)
      if (autoSpeakRef.current && voice.supported) {
        speechTextRef.current.mutate({ text: res.reply });
      }
    },
    onError: err => {
      const msg = err.message.includes("Gemini")
        ? err.message
        : "عذراً، حدث خلل مؤقت في الاتصال. حاول مرة أخرى.";
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: msg },
      ]);
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, chat.isPending]);

  const send = (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || chat.isPending) return;
    const next: Msg[] = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setInput("");
    chat.mutate({ messages: next.slice(-20) });
  };

  // Arabic microphone input → send transcript directly to JARVIS
  const mic = useSpeechRecognition({
    onFinalTranscript: text => send(text),
  });
  const micRef = useRef(mic);
  micRef.current = mic;

  // Live mode: mute the mic while JARVIS is speaking or thinking so it
  // doesn't hear itself, then resume listening automatically.
  const busy = voice.speaking || chat.isPending;
  useEffect(() => {
    if (!liveMode) return;
    micRef.current.setMuted(busy);
  }, [busy, liveMode]);

  const toggleLive = () => {
    if (liveMode) {
      setLiveMode(false);
      mic.stopLive();
    } else {
      setLiveMode(true);
      setAutoSpeak(true); // full conversation implies spoken replies
      mic.startLive();
    }
  };

  return (
    <section className="hud-panel hud-enter flex flex-col p-4 md:p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="hud-title">JARVIS COMMS</h2>
          <span className="hidden font-cairo text-[11px] text-muted-foreground sm:inline">
            اسأل جارفس عن أي أصل مالي — أسهم، عملات، كريبتو، معادن
          </span>
        </div>
        <div className="flex items-center gap-2">
          {chat.isPending && (
            <span className="flex items-end gap-0.5" aria-label="جارفس يفكر">
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="voice-bar block w-1 rounded bg-cyan-400"
                  style={{ height: 12, animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </span>
          )}
          {mic.supported && voice.supported && (
            <button
              onClick={toggleLive}
              title={
                liveMode
                  ? "إيقاف المحادثة المستمرة"
                  : "محادثة مستمرة: جارفس يستمع إليك دائماً ويرد صوتياً"
              }
              className={`flex items-center gap-1.5 rounded border px-2 py-1 font-tech text-[10px] tracking-wider transition-all duration-150 active:scale-95 ${
                liveMode
                  ? "border-red-400/50 bg-red-400/15 text-red-300 shadow-[0_0_10px_rgba(248,113,113,0.3)]"
                  : "border-cyan-400/40 bg-cyan-400/10 text-cyan-300 hover:bg-cyan-400/20"
              }`}>
              <Radio className={`h-3 w-3 ${liveMode ? "animate-pulse" : ""}`} />
              LIVE {liveMode ? "ON" : "MODE"}
            </button>
          )}
          {voice.supported && (
            <button
              onClick={() => {
                if (autoSpeak) voice.stop();
                setAutoSpeak(v => !v);
              }}
              title={autoSpeak ? "إيقاف النطق التلقائي للردود" : "تفعيل النطق التلقائي للردود"}
              className={`flex items-center gap-1.5 rounded border px-2 py-1 font-tech text-[10px] tracking-wider transition-all duration-150 active:scale-95 ${
                autoSpeak
                  ? "border-yellow-400/40 bg-yellow-400/10 text-yellow-300"
                  : "border-border bg-accent/20 text-muted-foreground"
              }`}>
              {autoSpeak ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
              VOICE {autoSpeak ? "ON" : "OFF"}
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="jarvis-scroll mb-3 flex h-64 flex-col gap-2.5 overflow-y-auto pe-1">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <p className="font-cairo text-sm text-muted-foreground">
              مرحباً، أنا جارفس. اسألني كتابةً، أو فعّل LIVE MODE وتحدث إليّ بالعربي — أسمعك وأرد
              عليك صوتاً.
            </p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-cyan-400/30 bg-cyan-400/5 px-3 py-1 font-cairo text-xs text-cyan-200 transition-all duration-150 hover:border-cyan-400/60 hover:bg-cyan-400/10 active:scale-95">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"} w-full`}>
            <div
              className={`max-w-[85%] rounded-lg border p-2.5 ${
                m.role === "user"
                  ? "border-yellow-400/25 bg-yellow-400/5"
                  : "border-cyan-400/25 bg-cyan-400/5"
              }`}>
              <div className="mb-1 flex items-center justify-between gap-3">
                <span
                  className={`font-tech text-[10px] tracking-widest ${
                    m.role === "user" ? "text-yellow-300/80" : "text-cyan-300/80"
                  }`}>
                  {m.role === "user" ? "COMMANDER" : "J.A.R.V.I.S"}
                </span>
                {m.role === "assistant" && voice.supported && (
                  <button
                    onClick={() => onSpeakReply(i, m.content)}
                    disabled={speechText.isPending && speakingIdx !== i}
                    title="استمع لملخص الرد بصوت جارفس (إنجليزي)"
                    className="text-muted-foreground transition-colors hover:text-yellow-300 disabled:opacity-40">
                    {speechText.isPending && speakingIdx === i ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Volume2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
              </div>
              {m.role === "assistant" ? (
                <div className="prose prose-invert prose-sm max-w-none font-cairo text-sm leading-relaxed [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5">
                  <Streamdown>{m.content}</Streamdown>
                </div>
              ) : (
                <p className="font-cairo text-sm leading-relaxed text-foreground">{m.content}</p>
              )}
            </div>
          </div>
        ))}

        {chat.isPending && (
          <div className="flex w-full justify-end">
            <div className="max-w-[85%] rounded-lg border border-cyan-400/25 bg-cyan-400/5 p-2.5">
              <span className="font-tech text-[10px] tracking-widest text-cyan-300/80">J.A.R.V.I.S</span>
              <p className="mt-1 flex items-center gap-2 font-cairo text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                جارٍ تحليل البيانات الحية...
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={e => {
          e.preventDefault();
          send();
        }}
        className="flex items-center gap-2">
        {mic.supported && (
          <button
            type="button"
            onClick={() => (mic.listening ? mic.stop() : mic.start())}
            disabled={chat.isPending}
            title={mic.listening ? "إيقاف الاستماع" : "تحدث إلى جارفس بالعربي"}
            className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded border transition-all duration-150 active:scale-95 disabled:opacity-40 ${
              mic.listening
                ? "border-red-400/60 bg-red-400/15 text-red-300"
                : "border-cyan-400/40 bg-cyan-400/10 text-cyan-300 hover:bg-cyan-400/20"
            }`}>
            {mic.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {mic.listening && (
              <span className="absolute -top-1 -end-1 h-2.5 w-2.5 animate-ping rounded-full bg-red-400" />
            )}
          </button>
        )}
        {!mic.supported && (
          <span
            title="التعرف على الصوت غير مدعوم في هذا المتصفح — استخدم Chrome أو Edge أو Safari"
            className="flex h-10 w-10 shrink-0 cursor-help items-center justify-center rounded border border-border bg-accent/10 text-muted-foreground/50">
            <MicOff className="h-4 w-4" />
          </span>
        )}
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
        placeholder={
            mic.listening
              ? mic.interim || "جارفس يستمع إليك... تحدث الآن"
              : liveMode
                ? busy
                  ? "جارفس يتحدث... سيعود للاستماع تلقائياً"
                  : "وضع المحادثة المستمرة مفعّل..."
                : "اكتب سؤالك لجارفس أو اضغط الميكروفون..."
          }
          className="h-10 flex-1 rounded border border-border bg-accent/20 px-3 font-cairo text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-cyan-400/60 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
        />
        <button
          type="submit"
          disabled={chat.isPending || !input.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-yellow-400/40 bg-yellow-400/10 text-yellow-300 transition-all duration-150 hover:bg-yellow-400/20 active:scale-95 disabled:opacity-40">
          <SendHorizontal className="h-4 w-4 -scale-x-100" />
        </button>
      </form>
      {mic.error && (
        <p className="mt-1.5 font-cairo text-[11px] text-red-300/80">{mic.error}</p>
      )}
    </section>
  );
}
