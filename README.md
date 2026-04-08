# Morning Room

寮生活の朝を豊かにする、片付け × 朝準備 × ゲーミフィケーションのスマホ向けWebアプリです。

## アプリ仕様
- スマホアプリ利用を想定した仕様は `APP_SPEC.md` を参照してください。
- PWA対応（ホーム画面追加 / スタンドアロン表示 / キャッシュ）に対応しています。

## 機能
- 理想の机画像と現在の机画像を比較して差分を表示
- 差分スコアに応じたポイント加算 / 散らかり時の減点
- ポイントでマイルーム用アイテム購入
- 天気情報に基づく服装・日焼け止めアドバイス
- 寮食PDFを読み込み、当日メニュー候補を表示
- LocalStorageにすべて保存（GitHub Pages対応）

## ローカル起動
```bash
python3 -m http.server 8080
```

ブラウザで `http://localhost:8080` を開いて確認してください。

## スマホ確認
- 同一Wi-Fiのスマホから `http://<PCのローカルIP>:8080` にアクセスすると確認できます。
- カメラ・位置情報・PDFの安定動作のため、GitHub PagesのHTTPS公開での確認を推奨します。

## GitHub Pages 自動公開
このリポジトリには `.github/workflows/deploy-pages.yml` を追加済みです。`main` または `work` ブランチに push すると自動デプロイされます。

### 初回だけ必要な設定
1. GitHubリポジトリの `Settings` → `Pages` を開く  
2. `Build and deployment` の `Source` を **GitHub Actions** に変更

### 公開URL
デプロイ成功後、`Actions` の `Deploy static site to GitHub Pages` から公開URLを確認できます。
