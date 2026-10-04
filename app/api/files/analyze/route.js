import {NextResponse} from "next/server";
import {createClient} from "../../../../lib/supabase/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

const MAX_EXTRACTED=120000;
const TIMEOUT=50000;

function json(data,status=200){return NextResponse.json(data,{status,headers:{"Cache-Control":"no-store"}});}
function clip(s,n=MAX_EXTRACTED){return (s||"").replace(/\u0000/g," ").trim().slice(0,n);}

async function aiText(prompt){
 const key=process.env.OPENROUTER_API_KEY;if(!key)return null;
 const model=process.env.OPENROUTER_MODEL||"openrouter/free";
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),TIMEOUT);
 try{
  const r=await fetch("https://openrouter.ai/api/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${key}`,"HTTP-Referer":"https://ganbur-ai.vercel.app","X-Title":"Ganbur AI"},body:JSON.stringify({model,messages:[
   {role:"system",content:"أنت Ganbur AI. حلل الملف المرفق/النص المستخرج بدقة. لا تخترع معلومات غير موجودة. قدم خلاصة واضحة ثم أهم النقاط والملاحظات."},
   {role:"user",content:prompt}
  ],temperature:.2}),signal:controller.signal});
  const d=await r.json().catch(()=>({}));
  const out=d?.choices?.[0]?.message?.content;
  return r.ok&&typeof out==="string"&&out.trim()?out.trim():null;
 }finally{clearTimeout(timer)}
}

async function aiImage(mime,buffer){
 const key=process.env.OPENROUTER_API_KEY;if(!key)return null;
 const model=process.env.OPENROUTER_VISION_MODEL||"openrouter/free";
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),TIMEOUT);
 try{
  const r=await fetch("https://openrouter.ai/api/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${key}`,"HTTP-Referer":"https://ganbur-ai.vercel.app","X-Title":"Ganbur AI"},body:JSON.stringify({model,messages:[{role:"user",content:[
   {type:"text",text:"حلل هذه الصورة بالعربية. صف محتواها بدقة، واقرأ النص الظاهر إن أمكن، واستخرج أهم البيانات أو الملاحظات. لا تخترع تفاصيل غير واضحة."},
   {type:"image_url",image_url:{url:`data:${mime};base64,${buffer.toString("base64")}`}}
  ]}],temperature:.2}),signal:controller.signal});
  const d=await r.json().catch(()=>({}));
  const out=d?.choices?.[0]?.message?.content;
  return r.ok&&typeof out==="string"&&out.trim()?out.trim():null;
 }finally{clearTimeout(timer)}
}

async function extract(mime,name,buffer){
 if(mime==="text/plain")return clip(buffer.toString("utf8"));
 if(mime==="application/pdf"){
  const {PDFParse}=await import("pdf-parse");
  const parser=new PDFParse({data:buffer});
  try{const result=await parser.getText();return clip(result.text)}finally{await parser.destroy()}
 }
 if(mime==="application/vnd.openxmlformats-officedocument.wordprocessingml.document"){
  const mammoth=await import("mammoth");const result=await mammoth.extractRawText({buffer});return clip(result.value);
 }
 if(mime==="application/msword")return "ملف DOC قديم. يرجى تحويله إلى DOCX لإتاحة استخراج النص بأعلى توافق.";
 if(mime==="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"||mime==="application/vnd.ms-excel"){
  const ExcelJS=(await import("@andreeewill/exceljs")).default||await import("@andreeewill/exceljs");
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(buffer);
  const parts=[];
  workbook.eachSheet((sheet)=>{
   const rows=[];
   sheet.eachRow((row)=>{rows.push(row.values.slice(1).map(v=>typeof v==="object"&&v!==null?(v.text||v.result||""):v).join(" | "))});
   parts.push(`[ورقة: ${sheet.name}]\n${rows.join("\n")}`);
  });
  return clip(parts.join("\n\n"));
 }
 if(mime.startsWith("image/"))return null;
 throw new Error("UNSUPPORTED");
}

export async function POST(req){
 try{
  const supabase=await createClient();
  const {data:claimsData}=await supabase.auth.getClaims();const userId=claimsData?.claims?.sub;
  if(!userId)return json({message:"يجب تسجيل الدخول أولًا."},401);
  const body=await req.json().catch(()=>({}));const id=body?.id;
  if(typeof id!=="string")return json({message:"معرف الملف غير صالح."},400);
  const {data:file,error:fe}=await supabase.from("files").select("id,name,storage_path,mime_type,size_bytes").eq("id",id).eq("user_id",userId).single();
  if(fe||!file)return json({message:"الملف غير موجود."},404);
  if(file.size_bytes>10*1024*1024)return json({message:"حجم الملف يتجاوز الحد المسموح."},400);
  const {data:blob,error:de}=await supabase.storage.from("ganbur-files").download(file.storage_path);
  if(de||!blob)return json({message:"تعذر قراءة الملف بأمان."},500);
  const buffer=Buffer.from(await blob.arrayBuffer());
  let extracted=null;let analysis=null;
  if(file.mime_type.startsWith("image/")){
    analysis=await aiImage(file.mime_type,buffer);
    if(!analysis)return json({message:"تعذر تحليل الصورة حاليًا. حاول مرة أخرى."},502);
  }else{
    extracted=await extract(file.mime_type,file.name,buffer);
    if(!extracted)return json({message:"لم يتم العثور على نص قابل للاستخراج من الملف."},422);
    analysis=await aiText(`اسم الملف: ${file.name}\n\nالنص/البيانات المستخرجة:\n${extracted}\n\nحلل المحتوى وقدّم ملخصًا عمليًا.`);
    if(!analysis)return json({message:"تم استخراج النص لكن تعذر إكمال تحليل الذكاء الاصطناعي."},502);
  }
  const {error:ue}=await supabase.from("files").update({status:"analyzed",extracted_text:extracted,updated_at:new Date().toISOString()}).eq("id",id).eq("user_id",userId);
  if(ue)return json({message:"تم التحليل لكن تعذر حفظ نتيجة الاستخراج."},500);
  return json({ok:true,fileId:id,name:file.name,analysis,extracted:extracted?extracted.slice(0,12000):null});
 }catch(error){
  console.error("Ganbur file analysis error",{name:error?.name||"Error",message:error?.message||"unknown"});
  if(error?.name==="AbortError")return json({message:"استغرق تحليل الملف وقتًا أطول من اللازم."},504);
  if(error?.message==="UNSUPPORTED")return json({message:"نوع الملف غير مدعوم للتحليل."},415);
  return json({message:"حدث خطأ مؤقت أثناء تحليل الملف."},500);
 }
}
