"use client";

import {useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {createClient} from "../lib/supabase/client";

const MAX_SAVED_CHATS=30;
const fallbackId=()=>globalThis.crypto?.randomUUID?.()||String(Date.now())+"-"+Math.random().toString(36).slice(2);

function titleFrom(text){const clean=text.replace(/\s+/g," ").trim();return clean.length>42?clean.slice(0,42)+"…":clean||"محادثة جديدة";}
function emptyChat(){return{id:fallbackId(),title:"محادثة جديدة",messages:[],updated_at:new Date().toISOString(),local:true};}

export default function Home(){
 const router=useRouter();const supabaseRef=useRef(null);
 const [user,setUser]=useState(null);const [chats,setChats]=useState([]);const [activeId,setActiveId]=useState(null);
 const [input,setInput]=useState("");const [loading,setLoading]=useState(false);const [service,setService]=useState("checking");const abortRef=useRef(null);
 const activeChat=useMemo(()=>chats.find(c=>c.id===activeId)||null,[chats,activeId]);const messages=activeChat?.messages||[];

 useEffect(()=>{
  let alive=true;
  (async()=>{
   const supabase=createClient();supabaseRef.current=supabase;
   const {data}=await supabase.auth.getUser();if(!alive)return;
   if(!data.user){router.replace("/login");return}setUser(data.user);
   const {data:rows,error}=await supabase.from("conversations").select("id,title,updated_at").order("updated_at",{ascending:false}).limit(MAX_SAVED_CHATS);
   if(!error&&alive){const list=(rows||[]).map(c=>({...c,messages:[]}));setChats(list);if(list[0]){setActiveId(list[0].id);loadMessages(list[0].id);}}
  })();
  fetch("/api/health",{cache:"no-store"}).then(r=>r.json()).then(d=>setService(d?.aiConfigured?(d.provider||"online"):"offline")).catch(()=>setService("offline"));
  return()=>{alive=false;abortRef.current?.abort()};
 },[]);

 async function loadMessages(id){
  const supabase=supabaseRef.current;if(!supabase)return;
  const {data,error}=await supabase.from("messages").select("id,role,content,created_at").eq("conversation_id",id).order("created_at",{ascending:true}).limit(100);
  if(!error)setChats(current=>current.map(c=>c.id===id?{...c,messages:data||[]}:c));
 }
 function newChat(){abortRef.current?.abort();const c=emptyChat();setChats(current=>[c,...current].slice(0,MAX_SAVED_CHATS));setActiveId(c.id);setInput("");setLoading(false);}
 async function selectChat(id){if(loading)return;setActiveId(id);setInput("");await loadMessages(id);}
 async function send(textOverride){
  const text=(textOverride??input).trim();if(!text||loading||text.length>8000||!user)return;
  const current=activeChat;const tempMessage={id:fallbackId(),role:"user",content:text,created_at:new Date().toISOString()};
  setChats(list=>list.map(c=>c.id===activeId?{...c,messages:[...c.messages,tempMessage],title:c.title==="محادثة جديدة"?titleFrom(text):c.title}:c));
  setInput("");setLoading(true);const controller=new AbortController();abortRef.current=controller;
  try{
   const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({conversationId:current?.local?null:current?.id||null,message:text}),signal:controller.signal});
   const data=await res.json().catch(()=>({}));
   if(!res.ok)throw new Error(data?.message||"تعذر إرسال الرسالة.");
   const realId=data.conversationId;
   const nextMessages=[...((current?.messages)||[]),tempMessage];
   setChats(list=>list.map(c=>c.id===activeId?{...c,id:realId,local:false,title:c.title==="محادثة جديدة"?titleFrom(text):c.title,messages:[...nextMessages,{id:fallbackId(),role:"assistant",content:data.message,created_at:new Date().toISOString()}],updated_at:new Date().toISOString()}:c));
   setActiveId(realId);
  }catch(error){
   if(error?.name!=="AbortError")setChats(list=>list.map(c=>c.id===activeId?{...c,messages:[...c.messages,{id:fallbackId(),role:"assistant",content:error.message||"تعذر الاتصال بالخادم.",error:true,created_at:new Date().toISOString()}]}:c));
  }finally{if(abortRef.current===controller)abortRef.current=null;setLoading(false);}
 }
 function stop(){abortRef.current?.abort();setLoading(false);}
 async function copyMessage(content){try{await navigator.clipboard.writeText(content)}catch{}}
 async function logout(){abortRef.current?.abort();const supabase=supabaseRef.current;if(supabase)await supabase.auth.signOut();router.replace("/login");router.refresh();}

 if(!user)return <main style={{minHeight:"100vh",display:"grid",placeItems:"center"}}>جارٍ تحميل Ganbur AI…</main>;

 return <div className="shell">
  <aside className="sidebar">
   <div className="brand">Ganbur <span>AI</span></div>
   <button className="newchat" onClick={newChat}>＋ محادثة جديدة</button>
   <div className="history-title">المحادثات السحابية</div>
   <div className="history">{chats.map(chat=><button key={chat.id} className={"history-item "+(chat.id===activeId?"active":"")} onClick={()=>selectChat(chat.id)}>{chat.title}</button>)}</div>
   <div className="account-box"><div className="muted">{user.email}</div><button className="link-button" onClick={logout}>تسجيل الخروج</button></div>
  </aside>
  <main className="main">
   <header className="topbar"><strong>{activeChat?.title||"محادثة جديدة"}</strong><div className="status"><span className={"dot "+(service==="offline"?"offline":"")}/>{service==="offline"?"غير متاح":"متصل"}</div></header>
   <div className="content"><section className="chat">
    {!messages.length&&<div className="welcome"><div className="welcome-icon">✦</div><h1>مرحباً بك في Ganbur AI</h1><p>محادثاتك محفوظة الآن في حسابك ويمكنك الوصول إليها من أجهزتك.</p><div className="suggestions">{["اكتب لي خطة مشروع احترافية","اشرح لي الذكاء الاصطناعي ببساطة","ساعدني في كتابة كود آمن"].map(s=><button key={s} onClick={()=>send(s)}>{s}</button>)}</div></div>}
    <div className="messages" aria-live="polite">{messages.map((m,i)=><div key={m.id||i} className={"msg-wrap "+(m.role==="user"?"user-wrap":"assistant-wrap")}><div className={"msg "+(m.role==="user"?"user":"assistant")+(m.error?" error":"")}>{m.content}</div>{m.role==="assistant"&&<div className="msg-actions"><button onClick={()=>copyMessage(m.content)}>نسخ</button></div>}</div>)}{loading&&<div className="msg assistant thinking">أفكر…</div>}</div>
    <div className="composer"><textarea value={input} maxLength={8000} aria-label="رسالتك" onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}}} placeholder="اكتب رسالتك هنا…" disabled={loading}/><button className="send" onClick={loading?stop:()=>send()} disabled={!loading&&!input.trim()}>{loading?"إيقاف":"إرسال"}</button></div>
    <div className="footer">قد تخطئ إجابات الذكاء الاصطناعي؛ تحقق من المعلومات المهمة.</div>
   </section></div>
  </main>
 </div>;
}
