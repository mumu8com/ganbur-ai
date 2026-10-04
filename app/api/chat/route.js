import {NextResponse} from "next/server";

export const runtime="edge";

export async function POST(req){
  try{
    const body=await req.json();
    const messages=Array.isArray(body?.messages)?body.messages.slice(-20):[];
    if(!messages.length)return NextResponse.json({message:"اكتب رسالة أولاً."},{status:400});
    const key=process.env.OPENAI_API_KEY;
    if(!key)return NextResponse.json({message:"واجهة Ganbur AI جاهزة. أضف OPENAI_API_KEY في إعدادات Vercel لتفعيل الردود الذكية الفعلية."});
    const response=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":`Bearer ${key}`},
      body:JSON.stringify({
        model:process.env.OPENAI_MODEL||"gpt-5-mini",
        instructions:"أنت Ganbur AI، مساعد ذكي مفيد ودقيق. أجب بالعربية عندما يكتب المستخدم بالعربية، وبأسلوب واضح ومختصر.",
        input:messages.map(m=>({role:m.role,content:[{type:"input_text",text:String(m.content)}]}))
      })
    });
    const data=await response.json();
    if(!response.ok)return NextResponse.json({message:"تعذر الحصول على رد من مزود الذكاء الاصطناعي."},{status:502});
    const output=data.output_text||data.output?.flatMap(x=>x.content||[]).find(x=>x.text)?.text||"لم يصل رد.";
    return NextResponse.json({message:output});
  }catch{return NextResponse.json({message:"حدث خطأ في الخادم."},{status:500})}
}
