"use client";

import {useEffect,useMemo,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {createClient} from "../lib/supabase/client";

const MAX_SAVED_CHATS=30;
const fallbackId=()=>globalThis.crypto?.randomUUID?.()||String(Date.now())+"-"+Math.random().toString(36).slice(2);
function titleFrom(text){const clean=text.replace(/\s+/g," ").trim();return clean.length>42?clean.slice(0,42)+"…":clean||"محادثة جديدة";}
function emptyChat(){return{id:fallbackId(),title:"محادثة جديدة",messages:[],updated_at:new Date().toISOString(),local:true};}

export default function Home(){
 const router=useRouter(),supabaseRef=useRef(null),abortRef=useRef(null);
 const [user,setUser]=useState(null),[chats,setChats]=useState([]),[activeId,setActiveId]=useState(null),[input,setInput]=useState("");
 const [loading,setLoading]=useState(false),[service,setService]=useState("checking"),[search,setSearch]=useState(""),[searchResults,setSearchResults]=useState([]);
 const [memory,setMemory]=useState([]),[showMemory,setShowMemory]=useState(false),[memoryBusy,setMemoryBusy]=useState(false);
 const [files,setFiles]=useState([]),[fileBusy,setFileBusy]=useState(false),[fileMessage,setFileMessage]=useState("");
 const [pendingFileIds,setPendingFileIds]=useState([]);
 const fileInputRef=useRef(null);
 const activeChat=useMemo(()=>chats.find(c=>c.id===activeId)||null,[chats,activeId]);
 const messages=activeChat?.messages||[];

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

 useEffect(()=>{if(!search.trim()||search.trim().length<2){setSearchResults([]);return;}const timer=setTimeout(async()=>{try{const r=await fetch("/api/search?q="+encodeURIComponent(search.trim()),{cache:"no-store"});const d=await r.json();setSearchResults(d.results||[]);}catch{setSearchResults([]);}},250);return()=>clearTimeout(timer)},[search]);

 async function loadMessages(id){const supabase=supabaseRef.current;if(!supabase)return;const {data,error}=await supabase.from("messages").select("id,role,content,created_at").eq("conversation_id",id).order("created_at",{ascending:true}).limit(100);if(!error)setChats(current=>current.map(c=>c.id===id?{...c,messages:data||[]}:c));}
 async function loadFiles(){try{const r=await fetch("/api/files",{cache:"no-store"});const d=await r.json();if(r.ok)setFiles(d.files||[])}catch{}}
 async function uploadFile(file){
  if(!file||!user)return;
  setFileMessage("");
  const allowed=["application/pdf","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/msword","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","application/vnd.ms-excel","text/plain","image/png","image/jpeg","image/webp"];
  if(!allowed.includes(file.type)||file.size<1||file.size>10*1024*1024){setFileMessage("الملف غير مدعوم أو يتجاوز 10MB.");return;}
  setFileBusy(true);
  try{
   const safeName=file.name.replace(/[^\\p{L}\\p{N}._-]+/gu,"_").slice(0,180)||"file";
   const path=user.id+"/"+fallbackId()+"-"+safeName;
   const supabase=supabaseRef.current;
   const {error:ue}=await supabase.storage.from("ganbur-files").upload(path,file,{contentType:file.type,upsert:false});
   if(ue)throw new Error("تعذر رفع الملف.");
   const r=await fetch("/api/files",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:file.name,storagePath:path,mimeType:file.type,sizeBytes:file.size})});
   const d=await r.json().catch(()=>({}));
   if(!r.ok){await supabase.storage.from("ganbur-files").remove([path]);throw new Error(d?.message||"تعذر تسجيل الملف.");}
   setFiles(current=>[d.file,...current].slice(0,50));
   if(activeChat&&!activeChat.local){
    const link=await fetch("/api/files/link",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({fileId:d.file.id,conversationId:activeChat.id})});
    if(!link.ok)throw new Error("تم رفع الملف لكن تعذر ربطه بالمحادثة.");
    setFiles(current=>current.map(x=>x.id===d.file.id?{...x,conversation_id:activeChat.id}:x));
    setFileMessage("تم رفع الملف وربطه بالمحادثة الحالية.");
   }else{
    setPendingFileIds(ids=>[...ids,d.file.id]);
    setFileMessage("تم رفع الملف. سيُربط بالمحادثة عند إرسال أول رسالة.");
   }
  }catch(e){setFileMessage(e.message||"تعذر رفع الملف.")}finally{setFileBusy(false);if(fileInputRef.current)fileInputRef.current.value=""}
 }
 async function analyzeFile(file){
  if(!file||fileBusy)return;setFileBusy(true);setFileMessage("جارٍ تحليل الملف…");
  try{const r=await fetch("/api/files/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:file.id})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.message||"تعذر تحليل الملف.");
   const content="📎 تحليل الملف: "+d.name+"\
\
"+d.analysis;
   const msg={id:fallbackId(),role:"assistant",content,created_at:new Date().toISOString()};
   setChats(list=>list.map(c=>c.id===activeId?{...c,messages:[...c.messages,msg]}:c));
   const active=chats.find(c=>c.id===activeId);if(active&&!active.local)await supabaseRef.current.from("messages").insert({conversation_id:active.id,user_id:user.id,role:"assistant",content});
   setFiles(list=>list.map(x=>x.id===file.id?{...x,status:"analyzed"}:x));setFileMessage("اكتمل تحليل الملف.");
  }catch(e){setFileMessage(e.message||"تعذر تحليل الملف.")}finally{setFileBusy(false)}
 }
 async function deleteFile(file){if(!window.confirm("حذف الملف نهائيًا؟"))return;const r=await fetch("/api/files",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:file.id})});if(r.ok)setFiles(list=>list.filter(x=>x.id!==file.id));else setFileMessage("تعذر حذف الملف.")}
 async function loadMemory(){setMemoryBusy(true);try{const r=await fetch("/api/memory",{cache:"no-store"});const d=await r.json();setMemory(d.memory||[])}finally{setMemoryBusy(false)}}
 function newChat(){abortRef.current?.abort();const c=emptyChat();setChats(current=>[c,...current].slice(0,MAX_SAVED_CHATS));setActiveId(c.id);setInput("");setLoading(false);setSearch("");}
 async function selectChat(id){if(loading)return;setActiveId(id);setInput("");setSearch("");await loadMessages(id);}
 async function openSearchResult(id){setSearch("");await selectChat(id);}
 async function send(textOverride){
  const text=(textOverride??input).trim();if(!text||loading||text.length>8000||!user)return;
  const current=activeChat,tempMessage={id:fallbackId(),role:"user",content:text,created_at:new Date().toISOString()};
  setChats(list=>list.map(c=>c.id===activeId?{...c,messages:[...c.messages,tempMessage],title:c.title==="محادثة جديدة"?titleFrom(text):c.title}:c));
  setInput("");setLoading(true);const controller=new AbortController();abortRef.current=controller;
  try{const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({conversationId:current?.local?null:current?.id||null,message:text,fileIds:pendingFileIds}),signal:controller.signal});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data?.message||"تعذر إرسال الرسالة.");const realId=data.conversationId;const nextMessages=[...((current?.messages)||[]),tempMessage];setChats(list=>list.map(c=>c.id===activeId?{...c,id:realId,local:false,title:c.title==="محادثة جديدة"?titleFrom(text):c.title,messages:[...nextMessages,{id:fallbackId(),role:"assistant",content:data.message,created_at:new Date().toISOString()}],updated_at:new Date().toISOString()}:c));setActiveId(realId);setPendingFileIds([]);}catch(error){if(error?.name!=="AbortError")setChats(list=>list.map(c=>c.id===activeId?{...c,messages:[...c.messages,{id:fallbackId(),role:"assistant",content:error.message||"تعذر الاتصال بالخادم.",error:true,created_at:new Date().toISOString()}]}:c));}finally{if(abortRef.current===controller)abortRef.current=null;setLoading(false);}
 }
 function stop(){abortRef.current?.abort();setLoading(false)}
 async function copyMessage(content){try{await navigator.clipboard.writeText(content)}catch{}}
 async function renameChat(chat){if(chat.local)return;const title=window.prompt("اسم المحادثة الجديد:",chat.title);if(!title?.trim())return;const r=await fetch("/api/conversations",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:chat.id,title:title.trim()})});if(r.ok){const d=await r.json();setChats(list=>list.map(c=>c.id===chat.id?{...c,title:d.title}:c));}}
 async function deleteChat(chat){if(chat.local){setChats(list=>list.filter(c=>c.id!==chat.id));if(activeId===chat.id)newChat();return;}if(!window.confirm("حذف هذه المحادثة نهائيًا؟"))return;const r=await fetch("/api/conversations",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:chat.id})});if(r.ok){const next=chats.filter(c=>c.id!==chat.id);setChats(next);if(activeId===chat.id){setActiveId(next[0]?.id||null);if(next[0])loadMessages(next[0].id);}}}
 async function addMemory(){const key=window.prompt("اسم الذاكرة، مثل: أسلوب الكتابة");if(!key?.trim())return;const value=window.prompt("القيمة التي تريد من Ganbur تذكرها:");if(!value?.trim())return;const r=await fetch("/api/memory",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key:key.trim(),value:value.trim()})});if(r.ok)loadMemory();}
 async function deleteMemory(id){const r=await fetch("/api/memory",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})});if(r.ok)setMemory(m=>m.filter(x=>x.id!==id));}
 async function logout(){abortRef.current?.abort();const supabase=supabaseRef.current;if(supabase)await supabase.auth.signOut();router.replace("/login");router.refresh();}

 if(!user)return <main style={{minHeight:"100vh",display:"grid",placeItems:"center"}}>جارٍ تحميل Ganbur AI…</main>;
 return <div className="shell">
  <aside className="sidebar">
   <div className="brand">Ganbur <span>AI</span></div>
   <button className="newchat" onClick={newChat}>＋ محادثة جديدة</button>
   <div className="search-box"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث في المحادثات…" aria-label="البحث في المحادثات"/></div>
   {searchResults.length>0&&<div className="search-results">{searchResults.map(r=><button key={r.id} onClick={()=>openSearchResult(r.id)}><strong>{r.title}</strong><small>{r.snippet}</small></button>)}</div>}
   <div className="history-title">المحادثات السحابية</div>
   <div className="history">{chats.map(chat=><div key={chat.id} className={"history-row "+(chat.id===activeId?"active":"")}><button className="history-item" onClick={()=>selectChat(chat.id)}>{chat.title}</button>{!chat.local&&<><button className="tiny-action" title="إعادة تسمية" onClick={()=>renameChat(chat)}>✎</button><button className="tiny-action danger" title="حذف" onClick={()=>deleteChat(chat)}>×</button></>}</div>)}</div>
   <div className="memory-tools"><button className="tool-button" onClick={()=>{setShowMemory(v=>!v);if(!showMemory)loadMemory()}}>🧠 ذاكرة Ganbur</button>{showMemory&&<div className="memory-panel"><div className="memory-head"><strong>ذاكرتك</strong><button onClick={addMemory}>＋</button></div>{memoryBusy?<small>جارٍ التحميل…</small>:memory.length?<div className="memory-list">{memory.map(m=><div key={m.id}><span><b>{m.memory_key}</b><br/>{m.memory_value}</span><button onClick={()=>deleteMemory(m.id)}>×</button></div>)}</div>:<small>لا توجد ذاكرة محفوظة. أضف ما تريد أن يتذكره.</small>}</div>}</div>
   <div className="files-tools"><button className="tool-button" onClick={()=>fileInputRef.current?.click()} disabled={fileBusy}>📎 {fileBusy?"جارٍ التنفيذ…":"رفع ملف"}</button><input ref={fileInputRef} type="file" hidden accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.webp" onChange={e=>uploadFile(e.target.files?.[0])}/>{fileMessage&&<small className="file-message">{fileMessage}</small>}{files.length>0&&<div className="file-list">{files.slice(0,8).map(f=><div key={f.id} className="file-row"><span title={f.name}>{f.name}{f.conversation_id===activeId&&<small style={{display:"block"}}>مرتبط بالمحادثة الحالية</small>}</span><button onClick={()=>analyzeFile(f)} disabled={fileBusy}>{f.status==="analyzed"?"إعادة":"تحليل"}</button><button onClick={()=>window.open("/api/files/download?id="+encodeURIComponent(f.id),"_blank")}>تنزيل</button><button onClick={()=>deleteFile(f)} disabled={fileBusy}>×</button></div>)}</div>}</div>
   <div className="account-box"><div className="muted">{user.email}</div><button className="link-button" onClick={logout}>تسجيل الخروج</button></div>
  </aside>
  <main className="main">
   <header className="topbar"><strong>{activeChat?.title||"محادثة جديدة"}</strong><div className="status"><span className={"dot "+(service==="offline"?"offline":"")}/>{service==="offline"?"غير متاح":"متصل"}</div></header>
   <div className="content"><section className="chat">
    {!messages.length&&<div className="welcome"><div className="welcome-icon">✦</div><h1>مرحباً بك في Ganbur AI</h1><p>ذاكرة اختيارية، محادثات سحابية، وبحث داخل تاريخك.</p><div className="suggestions">{["اكتب لي خطة مشروع احترافية","اشرح لي الذكاء الاصطناعي ببساطة","ساعدني في كتابة كود آمن"].map(s=><button key={s} onClick={()=>send(s)}>{s}</button>)}</div></div>}
    <div className="messages" aria-live="polite">{messages.map((m,i)=><div key={m.id||i} className={"msg-wrap "+(m.role==="user"?"user-wrap":"assistant-wrap")}><div className={"msg "+(m.role==="user"?"user":"assistant")+(m.error?" error":"")}>{m.content}</div>{m.role==="assistant"&&<div className="msg-actions"><button onClick={()=>copyMessage(m.content)}>نسخ</button></div>}</div>)}{loading&&<div className="msg assistant thinking">أفكر…</div>}</div>
    <div className="composer"><button className="attach" title="رفع ملف" onClick={()=>fileInputRef.current?.click()} disabled={loading||fileBusy}>📎</button><textarea value={input} maxLength={8000} aria-label="رسالتك" onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}}} placeholder="اكتب رسالتك هنا…" disabled={loading}/><button className="send" onClick={loading?stop:()=>send()} disabled={!loading&&!input.trim()}>{loading?"إيقاف":"إرسال"}</button></div>
    <div className="footer">قد تخطئ إجابات الذكاء الاصطناعي؛ تحقق من المعلومات المهمة.</div>
   </section></div>
  </main>
 </div>;
}