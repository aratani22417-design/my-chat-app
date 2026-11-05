interface Env {
  GEMINI_API_KEY: string;
}

interface WalkContext {
  mode: 'child' | 'dog';
  location: string;
  childAge?: string;
  childBuild?: string;
  purpose?: string;
  parentFatigue?: string;
  dogSize?: string;
  dogEnergy?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const body = await request.json() as { contents?: any[]; walkContext?: WalkContext };
    const { contents, walkContext } = body;

    if (!contents || !Array.isArray(contents) || contents.length === 0) {
      return new Response(JSON.stringify({ error: "会話データが空です。" }), {
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

    // お散歩モード時のみシステムプロンプトを挿入
    let systemInstruction = "";
    if (walkContext) {
      if (walkContext.mode === 'child') {
        systemInstruction = `
あなたは子育て世帯に寄り添う親切な「お散歩アドバイザーAI」です。
【条件】
・出発/現在地: ${walkContext.location}
・子どもの年齢: ${walkContext.childAge || '未指定'}
・体型/体力傾向: ${walkContext.childBuild || '標準'}
・目的: ${walkContext.purpose || 'お散歩'}
・親の疲労度: ${walkContext.parentFatigue || '普通'}

【回答ルール】
1. 親の疲労度が高い場合は、フラットで短いルートを提案してください。
2. 年齢・体格に合わせた安全な道（ベビーカーの押しやすさ、公園の遊具、日陰、休憩スポットなど）を提案してください。
3. ぐずり・睡眠などの状態変化の通知があった場合は、最優先で最短帰宅ルートや休憩場所を案内してください。
`;
      } else {
        systemInstruction = `
あなたは「愛犬お散歩ナビゲーターAI」です。
【条件】
・出発/現在地: ${walkContext.location}
・犬サイズ: ${walkContext.dogSize || '中型犬'}
・運動量: ${walkContext.dogEnergy || '標準'}
・飼い主の疲労度: ${walkContext.parentFatigue || '普通'}

【回答ルール】
土や草地のある歩道、日陰、水飲み場などを意識した安全なルートを提案してください。
`;
      }
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

    const requestBody: any = { contents };
    if (systemInstruction) {
      requestBody.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });

    const data = await geminiResponse.json() as any;

    if (!geminiResponse.ok) {
      const errMsg = data?.error?.message || "Gemini APIエラー";
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
