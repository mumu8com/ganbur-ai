"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {createClient} from "../../../lib/supabase/client";
export default function ResetPage(){
 const router=useRouter(),[password,setPassword]=useState(""),[confirm,setConfirm]=useState(""),[message,setMessage]=useState(""),[ready,setReady]=useState(false),[busy,setBusy]=useState(false);
 useEffect(()=>{const s=createClient();s.auth.getSession().then(({data})=>setReady(Boolean(data.session)));},[]);
 async function save(e){e.preventDefault();if(password.length<8)return setMessage("كلمة المرور يجب أن تكون 8 أحرف على الأقل.");if(password!==confirm)return setMessage("كلمتا المرور غير متطابقتين.");setBusy(true);setMessage("");try{const s=createClient();const {error}=await s.auth.updateUser({password});if(error)throw error;setMessage("تم تحديث كلمة المرور بنجاح.");setTimeout(()=>router.replace("/"),700);}catch(e){setMessage(e?.message||"تعذر تحديث كلمة المرور.");}finally{setBusy(false);}}
 return <main className="auth-page"><div className="auth-card"><div className="brand">Ganbur <span>AI</span></div><h1>تغيير كلمة المرور</h1>{ready?<form onSubmit={save}><input type="password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)} placeholder="كلمة المرور الجديدة" autoComplete="new-password"/><input type="password" minLength={8} required value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="تأكيد كلمة المرور" autoComplete="new-password"/><button disabled={busy}>{busy?"جارٍ الحفظ…":"حفظ كلمة المرور"}</button></form>:<p>جارٍ التحقق من جلسة الحساب…</p>}{message&&<div className="auth-message">{message}</div>}<button className="link-button" onClick={()=>router.replace("/login")}>العودة لتسجيل الدخول</button></div></main>;
}