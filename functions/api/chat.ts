interface Env {
  GEMINI_API_KEY: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const body = await request.json() as { walkContext?: any };
    const { walkContext } = body;

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY が設定されていません。" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (!walkContext) {
      return new Response(JSON.stringify({ error: "条件パラメータが指定されていません。" }), { status: 400 });
    }

    // JSON形式で確実にスケジュールを生成させるためのプロンプト
    const prompt = `
あなたは子育て世帯専門の「お散歩ツアープランナー」です。
以下の条件に基づいて、寄り道ポイントと行動・所要時間を順番に記したお散歩スケジュールを作成してください。

【散歩条件】
・出発/帰宅場所: ${walkContext.location}
・子供の年齢: ${walkContext.childAge}
・子供の体型/体力: ${walkContext.childBuild}
・現在の子供の様子: ${walkContext.childState}
・親の疲労度: ${walkContext.parentFatigue}
・予定お散歩時間: ${walkContext.duration}
・緊急帰宅フラグ: ${walkContext.isEmergency ? 'YES (至急帰宅優先)' : 'NO'}

【回答条件】
以下のJSONフォーマットのみを出力してください。余計な解説テキストは不要です。

{
  "points": [
    {
      "time": "00:00 (スタート)",
      "duration": "移動5分",
      "name": "地点名（例: 出発 / ○○公園）",
      "action": "ここですべき行動やアドバイス（例: ベビーカーを降りて遊具へ。水分の準備。）"
    },
    ...
    {
      "time": "00:45 (ゴール)",
      "duration": "帰宅完了",
      "name": "帰宅地点 (${walkContext.location})",
      "action": "無事帰宅。手洗い・うがいと足を拭いてリラックス。"
    }
  ]
}

※ポイント数は3〜5か所に制限し、必ず最後は出発場所（帰宅）で終わるようにしてください。
※緊急帰宅フラグがYES、または子供がぐずり・眠そうな場合は、途中の工程をカットして最短で帰宅するルートを作成してください。
`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json" // JSONで出力指定
        }
      })
    });

    const data = await geminiResponse.json() as any;

    if (!geminiResponse.ok) {
      const errMsg = data?.error?.message || "Gemini APIエラーが発生しました。";
      return new Response(JSON.stringify({ error: errMsg }), { status: geminiResponse.status });
    }

    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsedPlan = JSON.parse(rawText);

    return new Response(JSON.stringify({ plan: parsedPlan }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "サーバーエラーが発生しました。" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
