import {NextResponse} from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 8000;
const MAX_TOTAL_LENGTH = 30000;
const TIMEOUT_MS = 25000;

function json(message, status = 200) {
  return NextResponse.json({ message }, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

function normalizeMessages(value) {
  if (!Array.isArray(value)) return null;
  const messages = value.slice(-MAX_MESSAGES).map((item) => ({
    role: item?.role === "assistant" ? "assistant" : "user",
    content: typeof item?.content === "string" ? item.content.trim() : ""
  }));
  if (!messages.length || messages.some((m) => !m.content)) return null;
  if (messages.some((m) => m.content.length > MAX_MESSAGE_LENGTH)) return "MESSAGE_TOO_LONG";
  if (messages.reduce((n, m) => n + m.content.length, 0) > MAX_TOTAL_LENGTH) return "PAYLOAD_TOO_LARGE";
  return messages;
}

export async function POST(req) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return json("نوع الطلب غير صالح.", 415);
    }

    const body = await req.json();
    const messages = normalizeMessages(body?.messages);

    if (messages === "MESSAGE_TOO_LONG") return json("الرسالة طويلة جدًا. الحد الأقصى 8000 حرف.", 413);
    if (messages === "PAYLOAD_TOO_LARGE") return json("حجم المحادثة كبير جدًا. ابدأ محادثة جديدة.", 413);
    if (!messages) return json("أرسل رسالة صحيحة أولاً.", 400);

    const key = process.env.OPENAI_API_KEY;
    if (!key) return json("خدمة الذكاء الاصطناعي غير مفعلة حاليًا.", 503);

    const model = process.env.OPENAI_MODEL || "gpt-5-mini";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let response;
    try {
      response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${key}`
        },
        body: JSON.stringify({
          model,
          instructions:
            "أنت Ganbur AI، مساعد ذكي مفيد ودقيق. أجب بالعربية عندما يكتب المستخدم بالعربية، وبأسلوب واضح ومختصر. لا تدّعِ تنفيذ أفعال لم تنفذها.",
          input: messages.map((m) => ({
            role: m.role,
            content: [{ type: "input_text", text: m.content }]
          }))
        }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }

    const raw = await response.text();
    let data = {};
    try { data = JSON.parse(raw); } catch {}

    if (!response.ok) {
      console.error("Ganbur OpenAI request failed", {
        status: response.status,
        model,
        type: data?.error?.type || null,
        code: data?.error?.code || null
      });
      if (response.status === 401) return json("تعذر التحقق من إعداد خدمة الذكاء الاصطناعي.", 502);
      if (response.status === 429) return json("الخدمة مشغولة حاليًا. حاول بعد قليل.", 503);
      if (response.status >= 500) return json("مزود الذكاء الاصطناعي غير متاح مؤقتًا.", 502);
      return json("تعذر معالجة الطلب حاليًا.", 502);
    }

    const output =
      data.output_text ||
      data.output?.flatMap((x) => x.content || [])
        .find((x) => x.type === "output_text" && x.text)?.text ||
      "لم يصل رد.";

    return json(String(output).trim() || "لم يصل رد.");
  } catch (error) {
    const aborted = error?.name === "AbortError";
    console.error("Ganbur chat server error", {
      name: error?.name || "Error",
      aborted
    });
    return json(
      aborted ? "استغرق الطلب وقتًا أطول من اللازم. حاول مرة أخرى." : "حدث خطأ مؤقت في الخادم.",
      aborted ? 504 : 500
    );
  }
}

export function GET() {
  return json("استخدم POST لهذا المسار.", 405);
}
