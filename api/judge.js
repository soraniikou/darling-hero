// api/judge.js
// Darling Hero - 感情判定API（Vercel Functions）
// 入力された日本語テキストから、8つの「相」のどれに最も近いかをClaudeで判定する

export default async function handler(req, res) {
  // CORS設定（同じVercelドメインからのアクセスは自動で許可される）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // OPTIONSリクエスト（プリフライト）への応答
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // POSTリクエストのみ受け付ける
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string' || text.length > 200) {
      return res.status(400).json({ error: 'Invalid text' });
    }

    // 環境変数からAPIキーを取得（Vercel側で設定）
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    // Claudeに判定を依頼するプロンプト
    const systemPrompt = `あなたは日本語の感情を読み取る専門家です。入力されたテキストを以下の8つの「相」のどれに最も近いか判定してください。

【8つの相】
- ikari（怒）：怒り、憤り、苛立ち、不満
- ai（哀）：悲しみ、寂しさ、虚しさ、喪失感
- yorokobi（喜）：喜び、楽しさ、達成感、ワクワク
- shaa（謝）：感謝、ありがたさ、申し訳なさ
- tsukare（疲）：疲労、しんどさ、糸が切れる感じ、「どうでもいい」という諦め
- nozomi（望）：希望、目標、頑張る気持ち、いつかへの想い
- ai_love（愛）：愛しさ、恋しさ、好き、誰かを大切に想う気持ち、家族や恋人への情
- shizu（静）：上記のどれにも明確に当てはまらない、平穏、淡々とした日常

返答は必ず以下のJSON形式のみで返してください。説明や前置きは一切不要です。

{"phase": "ikari" または "ai" または "yorokobi" または "shaa" または "tsukare" または "nozomi" または "ai_love" または "shizu"}`;

    // Anthropic APIへリクエスト
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 50,
        system: systemPrompt,
        messages: [
          { role: 'user', content: text }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', errorText);
      return res.status(500).json({ error: 'AI judgment failed', phase: 'shizu' });
    }

    const data = await response.json();
    const aiText = data.content[0]?.text?.trim() || '{}';

    // JSON抽出（前後に余計な文字があっても対応）
    let phase = 'shizu';
    try {
      const match = aiText.match(/\{[^}]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        const validPhases = ['ikari', 'ai', 'yorokobi', 'shaa', 'tsukare', 'nozomi', 'ai_love', 'shizu'];
        if (validPhases.includes(parsed.phase)) {
          phase = parsed.phase;
        }
      }
    } catch (e) {
      console.error('Parse error:', e, aiText);
    }

    return res.status(200).json({ phase });

  } catch (error) {
    console.error('Handler error:', error);
    // エラー時は静の相にフォールバック
    return res.status(200).json({ phase: 'shizu' });
  }
}