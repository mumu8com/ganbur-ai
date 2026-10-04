"use client";
import {useState} from "react";

export default function Home(){
  const [messages,setMessages]=useState([]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);

  async function send(){
    const text=input.trim();
    if(!text||loading)return;
    const next=[...messages,{role:"user",content:text}];
    setMessages(next); setInput(""); setLoading(true);
    try{
      const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:next})});
      const data=await res.json();
      setMessages([...next,{role:"assistant",content:data.message||"حدث خطأ غير متوقع."}]);
    }catch{
      setMessages([...next,{role:"assistant",content:"تعذر الاتصال بالخادم. حاول مرة أخرى."}]);
    }finally{setLoading(false)}
  }

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand">Ganbur <span>AI</span></div>
      <button className="newchat" onClick={()=>setMessages([])}>＋ محادثة جديدة</button>
      <div className="muted">مساعدك الذكي بالعربية والإنجليزية</div>
      <div className="muted" style={{marginTop:"auto"}}>الإصدار 0.1 • بداية المشروع</div>
    </aside>
    <main className="main">
      <header className="topbar"><strong>المحادثة</strong><div className="status"><span className="dot"/> متصل</div></header>
      <div className="content"><section className="chat">
        {!messages.length && <div className="welcome"><h1>مرحباً بك في Ganbur AI</h1><p>اسأل، اكتب، حلّل، وابدأ محادثتك.</p></div>}
        <div className="messages">{messages.map((m,i)=><div key={i} className={"msg "+(m.role==="user"?"user":"assistant")}>{m.content}</div>)}{loading&&<div className="msg assistant">أفكر…</div>}</div>
        <div className="composer">
          <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}}} placeholder="اكتب رسالتك هنا…" />
          <button className="send" onClick={send} disabled={!input.trim()||loading}>إرسال</button>
        </div>
        <div className="footer">قد تخطئ إجابات الذكاء الاصطناعي؛ تحقق من المعلومات المهمة.</div>
      </section></div>
    </main>
  </div>
}
