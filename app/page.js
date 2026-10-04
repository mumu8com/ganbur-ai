"use client";

import {useRef, useState} from "react";

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const abortRef = useRef(null);

  function newChat() {
    abortRef.current?.abort();
    setMessages([]);
    setInput("");
    setLoading(false);
  }

  async function send() {
    const text = input.trim();
    if (!text || loading || text.length > 8000) return;

    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
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

      setMessages((current) => [
        ...current,
        {role: "assistant", content: res.ok ? message : message}
      ]);
    } catch (error) {
      if (error?.name !== "AbortError") {
        setMessages((current) => [
          ...current,
          {role: "assistant", content: "تعذر الاتصال بالخادم. حاول مرة أخرى."}
        ]);
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setLoading(false);
    }
  }

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand">Ganbur <span>AI</span></div>
      <button className="newchat" onClick={newChat}>＋ محادثة جديدة</button>
      <div className="muted">مساعدك الذكي بالعربية والإنجليزية</div>
      <div className="muted" style={{marginTop:"auto"}}>الإصدار 0.2 • محمي ومهيأ للتطوير</div>
    </aside>

    <main className="main">
      <header className="topbar">
        <strong>المحادثة</strong>
        <div className="status"><span className="dot"/> متصل</div>
      </header>

      <div className="content">
        <section className="chat">
          {!messages.length && (
            <div className="welcome">
              <h1>مرحباً بك في Ganbur AI</h1>
              <p>اسأل، اكتب، حلّل، وابدأ محادثتك.</p>
            </div>
          )}

          <div className="messages" aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className={"msg " + (m.role === "user" ? "user" : "assistant")}>
                {m.content}
              </div>
            ))}
            {loading && <div className="msg assistant">أفكر…</div>}
          </div>

          <div className="composer">
            <textarea
              value={input}
              maxLength={8000}
              aria-label="رسالتك"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="اكتب رسالتك هنا…"
              disabled={loading}
            />
            <button className="send" onClick={send} disabled={!input.trim() || loading}>
              {loading ? "..." : "إرسال"}
            </button>
          </div>

          <div className="footer">
            قد تخطئ إجابات الذكاء الاصطناعي؛ تحقق من المعلومات المهمة.
          </div>
        </section>
      </div>
    </main>
  </div>;
}
