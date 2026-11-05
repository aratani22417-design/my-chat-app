interface Env {
  GEMINI_API_KEY: string;
}

interface WalkContext {
  mode: 'child' | 'dog';
  location: string;
  // 子どもモード用
  childAge?: string;
  childGender?: string;
  childBuild?: string; // 体型・体力傾向
  purpose?: string;    // 公園で運動 / 景色鑑賞 / 買い物ついで など
  parentFatigue?: string; // 軽度 / 中度 / 重度
  // 犬モード用
  dogSize?: string;
  dogEnergy?: string;
  // 現在の状態（途中変更用）
  currentStatus?: string; // 元気 / ぐずり / 眠そう / 寝た など
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

    // --- システムプロンプトの動的生成 ---
    let systemInstruction = "";
    if (walkContext) {
      if (walkContext.mode === 'child') {
        systemInstruction = `
あなたは子育て世帯に寄り添う親切な「お散歩アドバイザーAI」です。
ユーザー（親）と子どもに最適なお散歩ルートやアドバイスを提案してください。

【基本情報】
・現在地: ${walkContext.location}
・子どもの年齢: ${walkContext.childAge || '未指定'}
・子どもの性別: ${walkContext.childGender || '未指定'}
・子どもの体力・体型傾向: ${walkContext.childBuild || '標準'}
・散歩の目的: ${walkContext.purpose || 'リフレッシュ'}
・親の疲労度: ${walkContext.parentFatigue || '普通'}

【応答プロトコル】
1. **親の疲労度への配慮**: 疲労度が高い場合は、坂道を避け、ベンチやカフェが多いフラットな短距離ルートを優先してください。
2. **子どもの年齢・体格に合わせた提案**:
   - 0〜1歳: ベビーカーで通りやすい舗装路、静かな環境。
   - 2〜3歳: 途中で急に立ち止まっても安全な広い歩道、小公園の遊具。
   - 4歳以上: 体力を消費できるアスレチックや広い公園、探検気分が味わえるルート。
3. **安全面・設備面の配慮**: 交通量が少ない道、授乳室/多目的トイレの有無、日陰の多さを考慮してください。
4. **途中状態変更への対応**:
   現在の状態が「${walkContext.currentStatus || '通常'}」の場合：
   - ぐずり/疲れてきた/眠そう/寝た などの緊急ステータス時は、**即座に最短帰宅ルート**、**ベビーカーで押しやすいスムーズな道**、または**抱っこしやすい休憩スポット**へ導く切り替え提案を行ってください。

【出力フォーマット】
- 提案ルートの概要（所要時間・距離）
- ルートのポイント（寄り道スポット、休憩場所、トイレ情報など）
- 親への労いのひとこと
`;
      } else if (walkContext.mode === 'dog') {
        systemInstruction = `
あなたは優秀な「愛犬お散歩ナビゲーターAI」です。
飼い主と愛犬の安全・健康に配慮した散歩ルートを提案してください。

【基本情報】
・現在地: ${walkContext.location}
・犬のサイズ: ${walkContext.dogSize || '中型犬'}
・犬の運動量/状態: ${walkContext.dogEnergy || '普通'}
・飼い主の疲労度: ${walkContext.parentFatigue || '普通'}

【応答プロトコル】
1. アスファルトの照り返しや足腰への負担（土や草地のあるルートの優先）に配慮してください。
2. 水飲み場や日陰のある公園、犬連れで歩きやすい道を提案してください。
3. 犬の状態（疲れた、他の犬に興奮しやすいなど）に応じた迂回・帰宅ルートを考慮してください。
`;
      }
    }

    // Gemini API リクエストパラメータ構築
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const requestBody: any = {
      contents: contents
    };

    if (systemInstruction) {
      requestBody.systemInstruction = {
        parts: [{ text: systemInstruction }]
      };
    }

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
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
