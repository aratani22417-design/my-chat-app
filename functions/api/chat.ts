interface Env {
  GEMINI_API_KEY: string;
}

export const onRequestPost: PagesFunction<{ GEMINI_API_KEY: string }> = async (context) => {
  try {
    const { request, env } = context;
    const body = await request.json() as { message?: string };
    const userMessage = body.message;

    if (!userMessage) {
      return new Response(JSON.stringify({ error: "メッセージが空です。" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY が設定されていません。" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 利用可能なモデル名（gemini-2.5-flash 等）を指定
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: userMessage }]
          }
        ]
      })
    });

    const data = await geminiResponse.json() as any;

    if (!geminiResponse.ok) {
      const errMsg = data?.error?.message || "Gemini APIでエラーが発生しました。";
      return new Response(JSON.stringify({ error: errMsg }), {
        status: geminiResponse.status,
        headers: { "Content-Type": "application/json" }
      });
    }

    const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "応答を得られませんでした。";

    return new Response(JSON.stringify({ reply: replyText }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "サーバーエラーが発生しました。" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
