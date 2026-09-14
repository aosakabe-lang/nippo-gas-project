const GEMINI_API_KEY = "AQ.Ab8RN6LROawV1lhMgYhmN4nRwkJ3h7lPhsCp7VVLot5WumR7Xw"; // Google AI Studioのキー
const SPREADSHEET_ID = "1j6q6n3KP70AJmyPLJTeIJgeOsYRo5Fffo5Osqdhe7i0"; // 指定のスプレッドシートID

// Web画面を表示する
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Gemini 日報アシスタント')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// AIとの通常会話（簡潔・高速化）
function chatWithGemini(userMessage) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const prompt = `あなたは効率的な日報作成アシスタントです。ユーザーの入力に対し、相槌と短い確認の言葉を1〜2文程度で短く簡潔に返答してください。質問は多くて1つだけにしてください。\n\nユーザー: ${userMessage}`;
  
  const payload = {
    "contents": [{ "parts": [{ "text": prompt }] }],
    "generationConfig": {
      "maxOutputTokens": 150
    }
  };
  
  try {
    const response = UrlFetchApp.fetch(url, {
      "method": "post",
      "contentType": "application/json",
      "payload": JSON.stringify(payload),
      "muteHttpExceptions": true
    });

    const res = JSON.parse(response.getContentText());
    if (res.error) throw new Error(`API Error (${res.error.code}): ${res.error.message}`);
    
    return res.candidates[0].content.parts[0].text;
  } catch (e) {
    throw new Error(`Gemini通信エラー: ${e.message}`);
  }
}

// 【トリガー】日報化してGoogleスプレッドシートに保存する
function saveDailyReport(fullConversationLog) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const prompt = `
以下の対話ログから日報とナレッジを作成し、指定のJSON形式のみで出力してください。Markdownの装飾コード（\`\`\`json 等）は含めないでください。

【対話ログ】
${fullConversationLog}

【JSON形式】
{
  "work_content": "本日の業務内容",
  "issues_solutions": "成果・課題と対応",
  "tomorrow_plan": "明日の予定",
  "knowledge": "抽出されたナレッジ・ノウハウ（なければ「特になし」）"
}
`;

  const payload = {
    "contents": [{ "parts": [{ "text": prompt }] }],
    "generationConfig": {
      "responseMimeType": "application/json"
    }
  };
  
  try {
    const response = UrlFetchApp.fetch(url, {
      "method": "post",
      "contentType": "application/json",
      "payload": JSON.stringify(payload),
      "muteHttpExceptions": true
    });

    const res = JSON.parse(response.getContentText());
    if (res.error) throw new Error(res.error.message);

    const rawText = res.candidates[0].content.parts[0].text.trim();
    const data = JSON.parse(rawText);

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheets()[0];
    
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["投稿日時", "業務内容", "成果・課題", "明日の予定", "ナレッジ・ノウハウ"]);
    }

    const now = Utilities.formatDate(new Date(), "JST", "yyyy/MM/dd HH:mm");
    sheet.appendRow([
      now,
      data.work_content,
      data.issues_solutions,
      data.tomorrow_plan,
      data.knowledge
    ]);

    return ss.getUrl();
  } catch (e) {
    throw new Error(`保存処理に失敗しました: ${e.message}`);
  }
}

// 【権限承認のための専用テスト関数】
function testAuth() {
  SpreadsheetApp.openById("1j6q6n3KP70AJmyPLJTeIJgeOsYRo5Fffo5Osqdhe7i0");
}