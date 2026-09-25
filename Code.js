const GEMINI_API_KEY = "AQ.Ab8RN6LROawV1lhMgYhmN4nRwkJ3h7lPhsCp7VVLot5WumR7Xw"; // Google AI Studioのキー
const SPREADSHEET_ID = "1j6q6n3KP70AJmyPLJTeIJgeOsYRo5Fffo5Osqdhe7i0"; // 指定のスプレッドシートID

// Web画面を表示する
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Gemini 日報アシスタント')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// 調査用。原因確認後に削除する。
function saveGeminiDebugLog(type, response) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName('GeminiDebugLog');
    if (!sheet) {
      sheet = ss.insertSheet('GeminiDebugLog');
      sheet.appendRow(['日時', '種類', 'HTTPステータス', 'finishReason', 'APIレスポンス全体']);
    }

    const candidate = response.candidates?.[0];
    sheet.appendRow([
      new Date(),
      type,
      response.httpStatus || '',
      candidate?.finishReason || '',
      response.rawText || ''
    ]);
  } catch (e) {
    Logger.log('Gemini debug log save failed: %s', e.message);
  }
}

function getGeminiText(response, type) {
  const candidate = response.candidates?.[0];
  if (!candidate) {
    throw new Error(`${type}の応答にcandidatesがありません`);
  }

  const finishReason = candidate.finishReason || '';
  const text = (candidate.content?.parts || [])
    .map(part => part.text || '')
    .join('')
    .trim();

  if (finishReason === 'MAX_TOKENS') {
    throw new Error(`${type}の回答が出力上限で途中終了しました`);
  }
  if (!text) {
    throw new Error(`${type}の回答本文が空です（finishReason: ${finishReason || '不明'}）`);
  }

  return text;
}

function fetchGeminiResponse(url, payload, type) {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    const responseText = response.getContentText();
    const httpStatus = response.getResponseCode();
    let parsed;

    try {
      parsed = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`${type}のAPI応答をJSONとして解釈できませんでした（HTTP ${httpStatus}）`);
    }

    const errorMessage = parsed.error?.message || '';
    const isTemporaryError = [429, 500, 502, 503, 504].includes(httpStatus)
      || /high demand|temporarily unavailable|try again later/i.test(errorMessage);

    if (!parsed.error || !isTemporaryError || attempt === maxAttempts) {
      return { responseText, httpStatus, parsed };
    }

    Utilities.sleep(1000 * Math.pow(2, attempt - 1));
  }

  throw new Error(`${type}のAPI呼び出しに失敗しました`);
}

// AIとの通常会話（簡潔・高速化）
function chatWithGemini(userMessage) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const prompt = `あなたは効率的な日報作成アシスタントです。ユーザーの入力に対し、相槌と短い確認の言葉を1〜2文程度で短く簡潔に返答してください。質問は多くて1つだけにしてください。\n\nユーザー: ${userMessage}`;
  
  const payload = {
    "contents": [{ "parts": [{ "text": prompt }] }],
    "generationConfig": {
      "maxOutputTokens": 1024
    }
  };
  
  try {
    const result = fetchGeminiResponse(url, payload, 'Gemini会話');
    const responseText = result.responseText;
    Logger.log('Gemini chat HTTP status: %s', result.httpStatus);
    Logger.log('Gemini chat raw response: %s', responseText);

    const res = result.parsed;
    saveGeminiDebugLog('chat', {
      httpStatus: result.httpStatus,
      rawText: responseText,
      ...res
    });
    if (res.error) throw new Error(`API Error (${res.error.code}): ${res.error.message}`);
    Logger.log('Gemini chat finishReason: %s', res.candidates?.[0]?.finishReason || '(なし)');
    
    return getGeminiText(res, 'Gemini会話');
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
      "responseMimeType": "application/json",
      "maxOutputTokens": 2048
    }
  };
  
  try {
    const result = fetchGeminiResponse(url, payload, '日報');
    const responseText = result.responseText;
    Logger.log('Gemini report HTTP status: %s', result.httpStatus);
    Logger.log('Gemini report raw response: %s', responseText);

    const res = result.parsed;
    saveGeminiDebugLog('report', {
      httpStatus: result.httpStatus,
      rawText: responseText,
      ...res
    });
    if (res.error) throw new Error(res.error.message);
    Logger.log('Gemini report finishReason: %s', res.candidates?.[0]?.finishReason || '(なし)');

    const rawText = getGeminiText(res, '日報');
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