/**
 * Web App エントリーポイント
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Gemini 日報アシスタント')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * スプレッドシートのURLを取得（既存シートの参照用）
 */
function getSpreadsheetUrl() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getUrl();
}

/**
 * 収集した対話ナレッジデータをスプレッドシートへ保存し、URLを返す
 */
function saveKnowledgeChat(payload) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('業務ナレッジデータ');
    
    if (!sheet) {
      sheet = ss.insertSheet('業務ナレッジデータ');
      sheet.appendRow([
        '登録日時', 
        '担当者', 
        '対象業務名', 
        '作業手順', 
        '判断基準・注意点', 
        '対話ログ全文', 
        'ステータス'
      ]);
      sheet.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#E5F3FF');
    }

    const userEmail = Session.getActiveUser().getEmail() || '匿名ユーザー';
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');

    sheet.appendRow([
      timestamp,
      userEmail,
      payload.taskName || '',
      payload.steps || '',
      payload.tips || '',
      payload.fullLog || '',
      '未整理（マニュアルの種）'
    ]);

    return { 
      success: true, 
      url: ss.getUrl() 
    };
  } catch (e) {
    return { success: false, message: e.message };
  }
}