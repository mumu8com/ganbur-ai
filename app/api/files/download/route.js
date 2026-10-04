import {NextResponse} from "next/server";
import {createClient} from "../../../../lib/supabase/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(req){
  try{
    const supabase=await createClient();
    const {data:claimsData}=await supabase.auth.getClaims();
    const userId=claimsData?.claims?.sub;
    if(!userId)return new NextResponse("يجب تسجيل الدخول أولًا.",{status:401});
    const id=new URL(req.url).searchParams.get("id");
    if(!id)return new NextResponse("معرف الملف غير صالح.",{status:400});
    const {data:file,error}=await supabase.from("files").select("name,storage_path,mime_type").eq("id",id).eq("user_id",userId).single();
    if(error||!file)return new NextResponse("الملف غير موجود.",{status:404});
    const {data:blob,error:downloadError}=await supabase.storage.from("ganbur-files").download(file.storage_path);
    if(downloadError||!blob)return new NextResponse("تعذر قراءة الملف.",{status:500});
    return new NextResponse(blob,{headers:{
      "Content-Type":file.mime_type,
      "Content-Disposition":`attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Cache-Control":"private, no-store"
    }});
  }catch{
    return new NextResponse("حدث خطأ مؤقت.",{status:500});
  }
}