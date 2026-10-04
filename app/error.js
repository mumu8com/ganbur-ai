"use client";

export default function Error({reset}) {
  return (
    <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24,textAlign:"center"}}>
      <div>
        <h1>حدث خطأ مؤقت</h1>
        <p>تعذر تحميل هذه الصفحة بشكل صحيح.</p>
        <button onClick={() => reset()} style={{padding:"10px 16px",cursor:"pointer"}}>
          المحاولة مرة أخرى
        </button>
      </div>
    </main>
  );
}
