import {NextResponse} from "next/server";

export const runtime="edge";

export async function POST(req){
  try{
    const body=await req.json();
    const messages=Array.isArray(body?.messages)?body.messages.slice(-20):[];
    if(!messages.length)return NextResponse.json({message:"اكتب رسالة أولاً."},{status:400});

    const key=process.env.OPENAI_API_KEY;
    if(!key){
      return NextResponse.json({message:"واجهة Ganbur AI جاهزة. أضف OPENAI_API_KEY في إعدادات Vercel لتفعيل الردود الذكية الفعلية."});
    }

    const model=process.env.OPENAI_MODEL||"gpt-5-mini";
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),25000);

    let response;
    try{
      response=await fetch("https://api.openai.com/v1/responses",{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "Authorization":`Bearer ${key}`
        },
        body:JSON.stringify({
          model,
          instructions:"أنت Ganbur AI، مساعد ذكي مفيد ودقيق. أجب بالعربية عندما يكتب المستخدم بالعربية، وبأسلوب واضح ومختصر.",
          input:messages.map(m=>({
            role:m.role==="assistant"?"assistant":"user",
            content:[{type:"input_text",text:String(m.content??"")}]
          }))
        }),
        signal:controller.signal
      });
    }finally{
      clearTimeout(timeout);
    }

    const raw=await response.text();
    let data={};
    try{data=JSON.parse(raw)}catch{}

    if(!response.ok){
      console.error("Ganbur OpenAI request failed",{
        status:response.status,
        model,
        error:data?.error?.message||"Unknown provider error",
        type:data?.error?.type||null,
        code:data?.error?.code||null
      });
      return NextResponse.json(
        {message:"تعذر الحصول على رد من مزود الذكاء الاصطناعي. تحقق من مفتاح OpenAI وصلاحية النموذج ثم حاول مرة أخرى."},
        {status:502}
      );
    }

    const output=data.output_text||
      data.output?.flatMap(x=>x.content||[]).find(x=>x.type==="output_text"&&x.text)?.text||
      "لم يصل رد.";

    return NextResponse.json({message:output});
  }catch(error){
    console.error("Ganbur chat server error",{
      name:error?.name||"Error",
      message:error?.message||"Unknown server error"
    });
    return NextResponse.json({message:"حدث خطأ في الخادم."},{status:500});
  }
}
