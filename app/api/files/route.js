import {NextResponse} from "next/server";
import {createClient} from "../../../lib/supabase/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const MAX_SIZE=10*1024*1024;
const ALLOWED=new Set([
 "application/pdf",
 "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
 "application/msword",
 "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
 "application/vnd.ms-excel",
 "text/plain","image/png","image/jpeg","image/webp"
]);

function json(data,status=200){return NextResponse.json(data,{status,headers:{"Cache-Control":"no-store"}});}
function validPath(path,userId){
 return typeof path==="string" && path.startsWith(userId+"/") && path.length<=500 && !path.includes("..") && !path.includes("\\");
}

export async function GET(){
 const supabase=await createClient();
 const {data:claimsData}=await supabase.auth.getClaims();
 const userId=claimsData?.claims?.sub;
 if(!userId)return json({message:"يجب تسجيل الدخول أولًا."},401);
 const {data,error}=await supabase.from("files").select("id,name,mime_type,size_bytes,status,created_at,updated_at").eq("user_id",userId).order("created_at",{ascending:false}).limit(50);
 if(error)return json({message:"تعذر قراءة الملفات."},500);
 return json({files:data||[]});
}

export async function POST(req){
 const supabase=await createClient();
 const {data:claimsData}=await supabase.auth.getClaims();
 const userId=claimsData?.claims?.sub;
 if(!userId)return json({message:"يجب تسجيل الدخول أولًا."},401);
 if(!(req.headers.get("content-type")||"").includes("application/json"))return json({message:"نوع الطلب غير صالح."},415);
 const body=await req.json();
 const name=typeof body?.name==="string"?body.name.trim().slice(0,255):"";
 const storagePath=body?.storagePath;
 const mimeType=body?.mimeType;
 const sizeBytes=Number(body?.sizeBytes);
 if(!name||!validPath(storagePath,userId)||!ALLOWED.has(mimeType)||!Number.isInteger(sizeBytes)||sizeBytes<1||sizeBytes>MAX_SIZE)
   return json({message:"بيانات الملف غير صالحة أو تتجاوز القيود المسموحة."},400);
 const ext=(name.split(".").pop()||"").toLowerCase();
 const allowedExt=["pdf","docx","doc","xlsx","xls","txt","png","jpg","jpeg","webp"];
 if(!allowedExt.includes(ext))return json({message:"امتداد الملف غير مسموح."},400);
 const {data,error}=await supabase.from("files").insert({user_id:userId,name,storage_path:storagePath,mime_type:mimeType,size_bytes:sizeBytes}).select("id,name,mime_type,size_bytes,status,created_at").single();
 if(error)return json({message:"تعذر تسجيل الملف."},500);
 return json({file:data});
}

export async function DELETE(req){
 const supabase=await createClient();
 const {data:claimsData}=await supabase.auth.getClaims();
 const userId=claimsData?.claims?.sub;
 if(!userId)return json({message:"يجب تسجيل الدخول أولًا."},401);
 const body=await req.json().catch(()=>({}));
 const id=body?.id;
 if(typeof id!=="string")return json({message:"معرف الملف غير صالح."},400);
 const {data:file,error:fe}=await supabase.from("files").select("id,storage_path").eq("id",id).eq("user_id",userId).single();
 if(fe||!file)return json({message:"الملف غير موجود."},404);
 const {error:se}=await supabase.storage.from("ganbur-files").remove([file.storage_path]);
 if(se)return json({message:"تعذر حذف الملف من التخزين."},500);
 const {error:de}=await supabase.from("files").delete().eq("id",id).eq("user_id",userId);
 if(de)return json({message:"تم حذف الملف من التخزين لكن تعذر حذف سجله."},500);
 return json({ok:true});
}

export function PATCH(){return json({message:"استخدم المسارات المدعومة فقط."},405);}
