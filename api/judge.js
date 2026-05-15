// api/judge.js
// Darling Hero - 感情判定API（Vercel Functions）

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', phase: 'shizu' });
  }

  try {
    const { text } = req.body || {};

    if (!text || typeof text !== 'string' || text.length > 200) {
      return res.status(400).json({ error: 'Invalid text', phase: 'shizu' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY not set');
      return res.status(200).json({ phase: 'shizu' });
    }

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

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 50,
        system: systemPrompt,
        messages: [
          { role: 'user', content: text }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', response.status, errorText);
      return res.status(200).json({ phase: 'shizu' });
    }

    const data = await response.json();
    const aiText = (data.content && data.content[0] && data.content[0].text) ? data.content[0].text.trim() : '';

    const validPhases = ['ikari', 'ai', 'yorokobi', 'shaa', 'tsukare', 'nozomi', 'ai_love', 'shizu'];

    function stripCodeFences(s) {
      return s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    }

    function extractPhaseFromModelText(raw) {
      if (!raw) return null;
      const s = stripCodeFences(raw);

      try {
        const parsed = JSON.parse(s);
        if (parsed && typeof parsed.phase === 'string' && validPhases.includes(parsed.phase.trim())) {
          return parsed.phase.trim();
        }
      } catch (_) {
        /* fall through */
      }

      const brace = s.match(/\{[\s\S]*?\}/);
      if (brace) {
        try {
          const parsed = JSON.parse(brace[0]);
          if (parsed && typeof parsed.phase === 'string' && validPhases.includes(parsed.phase.trim())) {
            return parsed.phase.trim();
          }
        } catch (_) {
          /* fall through */
        }
      }

      const m =
        s.match(/"phase"\s*:\s*"([a-z_]+)"/i) ||
        s.match(/"phase"\s*:\s*'([a-z_]+)'/i) ||
        s.match(/'phase'\s*:\s*'([a-z_]+)'/i) ||
        s.match(/\bphase\b\s*[:=]\s*['"]?([a-z_]+)/i);
      if (m && validPhases.includes(m[1])) return m[1];

      return null;
    }

    let phase = extractPhaseFromModelText(aiText) || 'shizu';
    if (!validPhases.includes(phase)) phase = 'shizu';

    return res.status(200).json({ phase });

  } catch (error) {
    console.error('Handler error:', error.message);
    return res.status(200).json({ phase: 'shizu' });
  }
}