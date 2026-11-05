interface Env {
  GEMINI_API_KEY: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const body = await request.json() as {
      walkContext?: any;
      contents?: any[];
      botConsultMode?: boolean;
    };

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY が設定されていません。" }), { status: 500 });
    }

    // ----------------------------------------------------
    // モードA: 子育て相談ロボット（対話チャット）
    // ----------------------------------------------------
    if (body.botConsultMode && body.contents) {
      const systemInstruction = `
あなたは優しく親身な「子育て相談専門アシスタントAI」です。
お散歩中や日常の子育てで悩む親御さんに対して、親切・丁寧で実用的なアドバイスを短く分かりやすく提供してください。
`;

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const geminiResponse = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: body.contents,
          systemInstruction: { parts: [{ text: systemInstruction }] }
        })
      });

      const data = await geminiResponse.json() as any;
      const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "応答を得られませんでした。";

      return new Response(JSON.stringify({ reply: replyText }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // ----------------------------------------------------
    // モードB: お散歩ルート・スケジュール生成 (JSON)
    // ----------------------------------------------------
    const { walkContext } = body;
    if (!walkContext) {
      return new Response(JSON.stringify({ error: "パラメータ不足です。" }), { status: 400 });
    }

    // 未設定項目の処理
    const travelMethod = walkContext.travelMethod !== "指定なし" ? `移動手段: ${walkContext.travelMethod}` : "";
    const visitType = walkContext.visitType !== "指定なし" ? `希望立ち寄り場所: ${walkContext.visitType}` : "";
    const facilityPref = walkContext.facilityPref !== "指定なし" ? `優先要件: ${walkContext.facilityPref}` : "";

    const prompt = `
あなたは子育て世帯専門の「お散歩ツアープランナー」です。
以下の条件に基づいて、立ち寄りスポットと行動・所要時間を順番に記したお散歩スケジュールを作成してください。

【散歩条件】
・出発/帰宅場所: ${walkContext.location}
・子供の年齢: ${walkContext.childAge}
・子供の体型/体力: ${walkContext.childBuild}
・現在の子供の様子: ${walkContext.childState}
・親の疲労度: ${walkContext.parentFatigue}
・予定お散歩時間: ${walkContext.duration}
${travelMethod ? '・' + travelMethod : ''}
${visitType ? '・' + visitType : ''}
${facilityPref ? '・' + facilityPref : ''}
・緊急帰宅フラグ: ${walkContext.isEmergency ? 'YES (至急帰宅優先)' : 'NO'}

【回答フォーマット】
以下のJSONフォーマットのみを出力してください。余計な解説文は不要です。

{
  "points": [
    {
      "time": "00:00 (スタート)",
      "duration": "移動5分",
      "name": "地点名 (例: ${walkContext.location}近郊の歩道 / ○○公園)",
      "action": "ここですべき行動やポイント (例: 安全な歩道でお花を見つけながら歩く)"
    },
    ...
    {
      "time": "00:45 (ゴール)",
      "duration": "帰宅完了",
      "name": "帰宅地点 (${walkContext.location})",
      "action": "無事帰宅。しっかり休もう。"
    }
  ]
}

※ポイント数は3〜5か所に制限し、最後は必ず帰宅（${walkContext.location}）で終わるようにしてください。
※緊急帰宅フラグがYES、または子供がぐずり・眠そうな場合は、工程を短縮して即座に帰宅する安全ルートを作成してください。
`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    const data = await geminiResponse.json() as any;
    if (!geminiResponse.ok) {
      return new Response(JSON.stringify({ error: "Gemini APIエラー" }), { status: geminiResponse.status });
    }

    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsedPlan = JSON.parse(rawText);

    return new Response(JSON.stringify({ plan: parsedPlan }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "サーバーエラー" }), { status: 500 });
  }
};
