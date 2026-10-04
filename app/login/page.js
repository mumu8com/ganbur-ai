"use client";

import {useState} from "react";
import {useRouter} from "next/navigation";
import {createClient} from "../../lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function forgot() {
    const normalized = email.trim();
    if (!normalized) {
      setMessage("أدخل بريدك الإلكتروني أولاً.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const supabase = createClient();
      const {error} = await supabase.auth.resetPasswordForEmail(normalized, {
        redirectTo: window.location.origin + "/auth/reset"
      });
      if (error) throw error;
      setMessage("إذا كان البريد مسجلاً، فستصلك رسالة لإعادة تعيين كلمة المرور.");
    } catch {
      setMessage("تعذر إرسال طلب إعادة التعيين. حاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const supabase = createClient();
      if (mode === "signup") {
        const {data, error} = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {data: {full_name: name.trim()}}
        });
        if (error) throw error;
        if (data.session) router.replace("/");
        else setMessage("تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتأكيد الحساب.");
      } else {
        const {error} = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });
        if (error) throw error;
        router.replace("/");
        router.refresh();
      }
    } catch (error) {
      setMessage(error?.message || "تعذر تنفيذ العملية.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="brand">Ganbur <span>AI</span></div>
        <h1>{mode === "login" ? "تسجيل الدخول" : "إنشاء حساب"}</h1>
        <p>{mode === "login" ? "ادخل إلى محادثاتك وذاكرتك السحابية." : "أنشئ حسابك واحفظ محادثاتك بأمان."}</p>
        <form onSubmit={submit}>
          {mode === "signup" && (
            <input value={name} onChange={e => setName(e.target.value)} placeholder="الاسم" maxLength={80} required />
          )}
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="البريد الإلكتروني" required autoComplete="email" />
          <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="كلمة المرور" minLength={8} required autoComplete={mode === "login" ? "current-password" : "new-password"} />
          <button disabled={busy}>{busy ? "جارٍ التنفيذ…" : mode === "login" ? "دخول" : "إنشاء الحساب"}</button>
        </form>
        {message && <div className="auth-message">{message}</div>}
        {mode === "login" && <button type="button" className="link-button" onClick={forgot} disabled={busy}>نسيت كلمة المرور؟</button>}
        <button type="button" className="link-button" onClick={() => {setMode(mode === "login" ? "signup" : "login"); setMessage("");}}>
          {mode === "login" ? "ليس لديك حساب؟ إنشاء حساب" : "لديك حساب؟ تسجيل الدخول"}
        </button>
      </div>
    </main>
  );
}