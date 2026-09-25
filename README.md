# Gemini 日報アシスタント

Google Apps Script と Gemini API を使った、対話形式の日報作成ツールです。

ユーザーが業務内容を入力すると、Gemini が短い確認メッセージを返します。会話終了後に「今日の日報保存」を実行すると、会話ログから日報とナレッジを生成し、Google スプレッドシートへ保存します。

## 機能

- Google Apps Script のWebアプリとして動作
- Gemini API による業務内容の対話確認
- 会話ログから以下の日報項目を自動生成
  - 業務内容
  - 成果・課題と対応
  - 明日の予定
  - ナレッジ・ノウハウ
- 生成した日報をGoogleスプレッドシートへ追記
- Gemini APIの一時的なエラーに対する最大3回の再試行
- APIレスポンスの空本文・出力上限到達の検出

## ファイル構成

| ファイル | 役割 |
| --- | --- |
| `Code.js` | Webアプリ、Gemini API呼び出し、日報保存処理 |
| `Index.html` | チャット画面のHTML・CSS・ブラウザ側処理 |
| `appsscript.json` | GASのランタイム、権限、Webアプリ設定 |
| `.clasp.json` | claspとApps Scriptプロジェクトの紐付け |

## 前提条件

- Googleアカウント
- Google Apps Scriptプロジェクトを操作できる権限
- Google AI Studioで発行したGemini APIキー
- 日報保存先のGoogleスプレッドシート
- Node.js と clasp

claspは次のコマンドでインストールできます。

```bash
npm install -g @google/clasp
```

## セットアップ

1. リポジトリを取得します。

```bash
git clone https://github.com/aosakabe-lang/nippo-gas-project.git
cd nippo-gas-project
```

2. claspへログインします。

```bash
clasp login
```

3. `Code.js` の次の値を環境に合わせて設定します。

```javascript
const GEMINI_API_KEY = "あなたのGemini APIキー";
const SPREADSHEET_ID = "保存先スプレッドシートのID";
```

スプレッドシートIDは、スプレッドシートURLの `/d/` と `/edit` の間にある文字列です。

4. Apps Scriptへコードをアップロードします。

```bash
clasp push
```

初回実行時は、Apps Scriptエディタで `testAuth` を実行し、スプレッドシートと外部リクエストの権限を承認してください。

## デプロイ

デプロイを作成するには、次を実行します。

```bash
clasp deploy --description "日報アシスタント更新"
```

デプロイ一覧は次で確認できます。

```bash
clasp deployments
```

Webアプリとして利用する場合は、Apps Scriptの「デプロイ」画面でWebアプリの実行ユーザーとアクセス権を確認してください。現在の設定は `appsscript.json` で次のとおりです。

- 実行ユーザー: デプロイしたユーザー
- アクセス: 自分のみ

## スプレッドシートへの保存

保存先スプレッドシートの先頭シートが使用されます。シートが空の場合、次のヘッダーが自動作成されます。

```text
投稿日時 | 業務内容 | 成果・課題 | 明日の予定 | ナレッジ・ノウハウ
```

Geminiの調査用ログは、必要に応じて `GeminiDebugLog` シートへ保存されます。

## セキュリティに関する注意

- Gemini APIキーをGitHubへコミットしないでください。
- 現在の実装は `Code.js` にAPIキーを設定する方式です。共有リポジトリで利用する場合は、Google Apps Scriptのスクリプトプロパティなど安全な保管場所へ移行してください。
- APIレスポンス全体をデバッグログへ保存するため、業務情報や個人情報が含まれる可能性があります。調査終了後はデバッグログ機能を無効化するか、保存内容を制限してください。
- APIキーを誤って公開した場合は、Google AI Studioでキーを無効化して新しいキーを発行してください。

## GitHubへの反映

変更を確認してコミット・プッシュします。

```bash
git status
git add .
git commit -m "Update GAS project"
git push origin master
```
