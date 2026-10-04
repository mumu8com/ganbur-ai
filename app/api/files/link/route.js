import {NextResponse} from "next/server";
import {createClient} from "../../../../lib/supabase/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function POST(req){
  try{
    const supabase=await createClient();
    const {data:claimsData}=await supabase.auth.getClaims();
    const userId=claimsData?.claims?.sub;
    if(!userId)return NextResponse.json({message:"يجب تسجيل الدخول أولًا."},{status:401});
    const body=await req.json().catch(()=>({}));
    const fileId=typeof body?.fileId==="string"?body.fileId:null;
    const conversationId=typeof body?.conversationId==="string"?body.conversationId:null;
    if(!fileId||!conversationId)return NextResponse.json({message:"بيانات الربط غير صالحة."},{status:400});
    const {data:conversation}=await supabase.from("conversations").select("id").eq("id",conversationId).eq("user_id",userId).single();
    if(!conversation)return NextResponse.json({message:"المحادثة غير موجودة."},{status:404});
    const {data:file}=await supabase.from("files").select("id").eq("id",fileId).eq("user_id",userId).single();
    if(!file)return NextResponse.json({message:"الملف غير موجود."},{status:404});
    const {data,error}=await supabase.from("files").update({conversation_id:conversationId,updated_at:new Date().toISOString()}).eq("id",fileId).eq("user_id",userId).select("id,conversation_id").single();
    if(error||!data)return NextResponse.json({message:"تعذر ربط الملف بالمحادثة."},{status:500});
    return NextResponse.json({ok:true,file:data},{headers:{"Cache-Control":"no-store"}});
  }catch{
    return NextResponse.json({message:"حدث خطأ مؤقت."},{status:500});
  }
}