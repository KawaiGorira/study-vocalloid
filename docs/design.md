# Stem Reference Studio 設計書（MVP）

## 1. スコープ

### 1.1 目標
以下を「まずはシンプルに」成立させる。

1. Webで動作する
2. DAWライクな画面でマルチトラック表示
3. 各曲に対して
   - stem管理
   - マーカー管理
   - トラックメモ
   - 小節ごとのコード進行
   - BPM管理
4. データを横断検索・集計できる

### 1.2 非目標（MVPではやらない）
- 高度な音声編集（タイムストレッチ、ピッチ補正、オートメーション）
- リアルタイム協調編集
- 機械学習による自動解析

---

## 2. 想定ユーザーフロー

1. 曲を新規作成（タイトル、アーティスト、BPM）
2. stemをアップロード（drums / bass / vocals ...）
3. タイムライン上で波形を確認
4. セクションマーカーを追加（小節範囲指定）
5. 各トラックにメモを記入
6. 小節ごとにコードを入力（例: `| C | G/B | Am7 | F |`）
7. ライブラリ全体で検索
   - 「Am7が多い曲」
   - 「"サビでギター歪ませる"メモを含む曲」
   - 「BPM 120〜130 かつ chorus が長い曲」

---

## 3. 画面設計（MVP）

## 3.1 曲ライブラリ画面
- 曲一覧（最大1000曲をページング）
- カラム: タイトル / アーティスト / BPM / 更新日 / タグ
- 検索バー（全文 + 条件フィルタ）

## 3.2 曲詳細（DAWライク）
- 上部: トランスポート（再生/停止、再生位置、ズーム）
- 中央: マルチトラックタイムライン
  - 各トラックの波形（概要表示）
  - セクションマーカー帯（小節範囲）
  - 小節グリッド
- 右ペイン: トラックメモ / 曲メモ / タグ
- 下部: コード進行エディタ（小節単位）

## 3.3 統計・検索画面
- コード頻出ランキング（例: C, G, Am, F）
- BPM分布
- セクション長（Intro/Verse/Chorus）平均
- メモのキーワード検索

---

## 4. データモデル（初期案）

### 4.1 エンティティ

#### Song
- `id`
- `title`
- `artist`
- `bpm`
- `time_signature`（MVPは 4/4 をデフォルト）
- `notes`（曲全体メモ）
- `created_at`, `updated_at`

#### StemTrack
- `id`
- `song_id`
- `name`（drums, bass, vocalなど）
- `file_path`
- `duration_sec`
- `sample_rate`
- `peak_cache_path`（波形描画用）
- `note`

#### SectionMarker
- `id`
- `song_id`
- `name`（Intro/Verse/Chorus/Bridgeなど）
- `start_bar`
- `end_bar`
- `color`

#### BarChord
- `id`
- `song_id`
- `bar_index`
- `chord_symbol`（C, Am7, G/B ...）
- `comment`

#### Tag
- `id`
- `name`

#### SongTag
- `song_id`
- `tag_id`

### 4.2 インデックス戦略
- `songs(title, artist)` に全文検索インデックス
- `songs(bpm)` にB-Tree
- `bar_chords(chord_symbol)` にB-Tree
- `stem_tracks(note)` に全文検索インデックス
- `section_markers(name, start_bar)` に複合インデックス

1000曲規模なら、SQLite + 適切なインデックスで十分運用可能。

---

## 5. 技術構成（シンプル構成）

## 5.1 推奨スタック
- フロントエンド: React + TypeScript + Vite
- UI: Tailwind CSS（または shadcn/ui）
- 波形表示: Wavesurfer.js（各stemを読み込み）
- バックエンド: Node.js (Fastify または Express)
- DB: SQLite（将来PostgreSQLに移行可能なスキーマで）
- ORM: Prisma
- 検索: SQLite FTS5（MVP）

## 5.2 アーキテクチャ
- SPA（フロント） + REST API（バック） + SQLite
- 音源ファイルはローカルまたはS3互換ストレージ
- 波形はアップロード時にピークデータを事前計算し保存

---

## 6. API設計（MVP）

### 曲
- `POST /songs` 曲作成
- `GET /songs` 曲一覧（検索・フィルタ・ページング）
- `GET /songs/:id` 曲詳細
- `PATCH /songs/:id` 曲更新

### stem
- `POST /songs/:id/stems` stemアップロード
- `PATCH /stems/:stemId` stem名/メモ更新
- `DELETE /stems/:stemId` 削除

### マーカー
- `POST /songs/:id/markers`
- `PATCH /markers/:markerId`
- `DELETE /markers/:markerId`

### コード
- `PUT /songs/:id/chords`（配列で一括保存）
- `GET /songs/:id/chords`

### 検索・統計
- `GET /search`（q, bpm_min, bpm_max, chord, marker_name など）
- `GET /stats/chords`
- `GET /stats/bpm`
- `GET /stats/sections`

---

## 7. パフォーマンス方針（1000曲対応）

- 曲一覧は必ずページング（例: 50件/ページ）
- 曲詳細の波形は
  - 初回は低解像度ピーク表示
  - ズーム時のみ詳細ピークを遅延取得
- 検索はDBインデックスを前提
- メモ全文検索はFTSテーブルを利用

---

## 8. 実装フェーズ

### Phase 1（最短で価値を出す）
- 曲CRUD
- stemアップロード
- 波形表示（再生・停止）
- マーカーCRUD
- BPM、トラックメモ、小節コード入力

### Phase 2
- 横断検索（コード、メモ、BPM）
- 統計ダッシュボード
- タグ管理

### Phase 3
- UX改善（ショートカット、ドラッグ編集）
- エクスポート（CSV/JSON）
- PostgreSQL移行オプション

---

## 9. 受け入れ基準（MVP）

1. 1000曲登録しても一覧表示・検索が実用速度で動作する
2. 1曲に複数stemを紐付け、波形を表示できる
3. 小節単位でコード進行を保存・再表示できる
4. マーカー（開始/終了小節）を編集できる
5. メモ・コードで横断検索できる

---

## 10. 次のステップ

設計合意後、以下の順序で実装着手する。

1. DBスキーマとAPIの雛形作成
2. 曲一覧 + 曲詳細画面の骨組み
3. stemアップロード + 波形表示
4. マーカー/コード/メモの編集機能
5. 検索と統計画面
