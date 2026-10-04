"use client";

import {useEffect, useMemo, useRef, useState} from "react";

const STORAGE_KEY = "ganbur-ai-chats-v1";
const MAX_SAVED_CHATS = 30;

function makeChat() {
  return {id: crypto.randomUUID(), title: "محادثة جديدة", messages: [], updatedAt: Date.now()};
}

function titleFrom(text) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 42 ? clean.slice(0, 42) + "…" : clean || "محادثة جديدة";
}

export default function Home() {
  const [chats, setChats] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [service, setService] = useState("checking");
  const abortRef = useRef(null);

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeId) || null,
    [chats, activeId]
  );
  const messages = activeChat?.messages || [];

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      const valid = Array.isArray(saved) ? saved.slice(0, MAX_SAVED_CHATS) : [];
      if (valid.length) {
        setChats(valid);
        setActiveId(valid[0].id);
      } else {
        const chat = makeChat();
        setChats([chat]);
        setActiveId(chat.id);
      }
    } catch {
      const chat = makeChat();
      setChats([chat]);
      setActiveId(chat.id);
    }

    fetch("/api/health", {cache: "no-store"})
      .then((r) => r.json())
      .then((data) => setService(data?.aiConfigured ? (data.provider || "online") : "offline"))
      .catch(() => setService("offline"));
  }, []);

  useEffect(() => {
    if (chats.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(chats.slice(0, MAX_SAVED_CHATS)));
  }, [chats]);

  function newChat() {
    abortRef.current?.abort();
    const chat = makeChat();
    setChats((current) => [chat, ...current].slice(0, MAX_SAVED_CHATS));
    setActiveId(chat.id);
    setInput("");
    setLoading(false);
  }

  function selectChat(id) {
    if (loading) return;
    setActiveId(id);
    setInput("");
  }

  function updateActive(messages, title) {
    setChats((current) =>
      current.map((chat) =>
        chat.id === activeId
          ? {...chat, messages, title: title || chat.title, updatedAt: Date.now()}
          : chat
      ).sort((a, b) => b.updatedAt - a.updatedAt)
    );
  }

  async function send(textOverride) {
    const text = (textOverride ?? input).trim();
    if (!text || loading || text.length > 8000 || !activeChat) return;

    const next = [...messages, {role: "user", content: text}];
    updateActive(next, activeChat.title === "محادثة جديدة" ? titleFrom(text) : activeChat.title);
    setInput("");
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({messages: next}),
        signal: controller.signal
      });
      const data = await res.json().catch(() => ({}));
      const message = data?.message || "لم يصل رد من الخادم.";
      updateActive([...next, {role: "assistant", content: message, error: !res.ok}], null);
    } catch (error) {
      if (error?.name !== "AbortError") {
        updateActive([...next, {role: "assistant", content: "تعذر الاتصال بالخادم. حاول مرة أخرى.", error: true}], null);
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setLoading(false);
    }
  }

  function stop() {
    abortRef.current?.abort();
    setLoading(false);
  }

  async function copyMessage(content) {
    try { await navigator.clipboard.writeText(content); } catch {}
  }

  async function regenerate() {
    if (loading || messages.length < 2) return;
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    const beforeLastAssistant = messages[messages.length - 1]?.role === "assistant"
      ? messages.slice(0, -1)
      : messages;
    updateActive(beforeLastAssistant, null);
    await send(lastUser.content);
  }

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand">Ganbur <span>AI</span></div>
      <button className="newchat" onClick={newChat}>＋ محادثة جديدة</button>
      <div className="history-title">المحادثات</div>
      <div className="history">
        {chats.map((chat) => (
          <button key={chat.id} className={"history-item " + (chat.id === activeId ? "active" : "")} onClick={() => selectChat(chat.id)}>
            {chat.title}
          </button>
        ))}
      </div>
      <div className="muted" style={{marginTop:"auto"}}>الإصدار 0.3 • سجل محادثات محلي</div>
    </aside>

    <main className="main">
      <header className="topbar">
        <strong>{activeChat?.title || "المحادثة"}</strong>
        <div className="status"><span className={"dot " + (service === "offline" ? "offline" : "")}/>{service === "offline" ? "غير متاح" : "متصل"}</div>
      </header>

      <div className="content">
        <section className="chat">
          {!messages.length && (
            <div className="welcome">
              <div className="welcome-icon">✦</div>
              <h1>مرحباً بك في Ganbur AI</h1>
              <p>اسأل، اكتب، حلّل، وبرمج. محادثاتك تُحفظ محليًا على جهازك.</p>
              <div className="suggestions">
                {["اكتب لي خطة مشروع احترافية", "اشرح لي الذكاء الاصطناعي ببساطة", "ساعدني في كتابة كود آمن"].map((s) => (
                  <button key={s} onClick={() => send(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}

          <div className="messages" aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className={"msg-wrap " + (m.role === "user" ? "user-wrap" : "assistant-wrap")}>
                <div className={"msg " + (m.role === "user" ? "user" : "assistant") + (m.error ? " error" : "")}>{m.content}</div>
                {m.role === "assistant" && (
                  <div className="msg-actions">
                    <button onClick={() => copyMessage(m.content)}>نسخ</button>
                    {i === messages.length - 1 && <button onClick={regenerate}>إعادة المحاولة</button>}
                  </div>
                )}
              </div>
            ))}
            {loading && <div className="msg assistant thinking">أفكر…</div>}
          </div>

          <div className="composer">
            <textarea value={input} maxLength={8000} aria-label="رسالتك" onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="اكتب رسالتك هنا…" disabled={loading}/>
            <button className="send" onClick={loading ? stop : () => send()} disabled={!loading && !input.trim()}>
              {loading ? "إيقاف" : "إرسال"}
            </button>
          </div>
          <div className="footer">قد تخطئ إجابات الذكاء الاصطناعي؛ تحقق من المعلومات المهمة.</div>
        </section>
      </div>
    </main>
  </div>;
}
