# Upstream Sync Tracker — 9router v0.5.123 (phạm vi thu hẹp)

> Phạm vi sync này đã được Tan thu hẹp ngày 2026-11-26 03:19 +07: **chỉ port
> các cập nhật OpenCode và NVIDIA**. Các commit còn lại trong dải v0.5.119 →
> v0.5.123 được BỎ QUA theo yêu cầu này, KHÔNG phải vì lý do kỹ thuật — xem
> mục "Bỏ qua do thu hẹp phạm vi".

## Tổng quan

| Mục | Giá trị |
|---|---|
| Upstream | 9router `v0.5.123`, SHA `5ae63d22` (2026-11-22) |
| ToolnetAPI trước sync | `8401a08c` (origin/main lúc bắt đầu) |
| ToolnetAPI sau sync | `c229ddca` (HEAD nhánh sync) |
| Nhánh | `sync/9router-v0.5.123-20261126` |
| Dải upstream | v0.5.119 → v0.5.123: **34 commit** |
| Đã port trong sync này | **3 commit** (chỉ opencode + nvidia) |
| Bỏ qua | **31 commit** (do thu hẹp phạm vi) |
| Commit đã có sẵn trên nhánh trước sync này | 27 commit (OpenCode Free/Go/Zen và các port trước đó, HEAD `0b4b01a8`) |
| Tổng commit trên nhánh so với origin/main | 31 commit (30 code + 1 tracker này) |

## Commit đã port (3)

| Upstream | Fork | Nội dung |
|---|---|---|
| `ba3bba47` | `76920cb9` | fix(nvidia): Nemotron 3 Ultra 550B — tools:false → true, context 128k → 1M (maxOutput giữ 8192, đã verify bằng fixture 2026-11-13). Fork chưa hề có entry ultra nên thêm mới thay vì sửa. |
| `bf5c4192` | `7b32baa4` | fix(validate): probe opencode-go gửi header `x-opencode-session` (session id = `validate-` + sha256(apiKey) 16 ký tự). Giữ endpoint zen của fork (`zen/go/v1/chat/completions`), không đổi sang URL `inference/go/openai` của upstream. |
| `a851a89c` | `c229ddca` | feat(nvidia): 8 embedding model live + `input_type` (xem chi tiết dưới). |

### Chi tiết `a851a89c` — nvidia embeddings

- Registry: **xóa** `nvidia/nv-embedqa-e5-v5` (đã bị xóa upstream); **thêm 8 model
  embedding live**: `nemotron-3.5-embed-8b` (4096 dim), `nemotron-3.5-embed-1b`
  (2048), `nemotron-3-embed-1b` (2048), `nv-embedqa-mistral-7b-v2` (4096),
  `embed-qa-4` (1024), `llama-3.2-nemoretriever-1b-vlm-embed-v1` (2048),
  `llama-3.2-nv-embedqa-1b-v1` (2048), `nvclip` (1024). 7 model asymmetric khai
  `params: ["input_type"]`, nvclip không.
- `open-sse/config/embeddingParams.js` (mới): nguồn duy nhất cho giá trị
  `input_type` và giá trị mặc định, dùng chung cho core và dashboard card.
- `embeddingsCore` resolve `input_type` một lần trước khi build request nên
  lần retry 401/403 dùng lại cùng payload; model không khai param giữ body
  y hệt cũ.
- Dashboard `EmbeddingExampleCard`: thêm select Input Type, chỉ hiện với model
  có khai param.
- **Backport tối thiểu (chỉ phạm vi nvidia)** vì test `nvidia-params.test.js`
  mới cần các tính năng nvidia cũ hơn mà fork chưa có: transport
  `timeoutMs: 90000` + quirk `dropClientMetadata`, registry models
  `meta/llama-3.3-70b-instruct` / `nvidia/nemotron-3.5-bolt-e4b` /
  `poolside/laguna-xs-2.1`, capability tools flags (llama-3.3/bolt/laguna =
  true, minimax-m3 = false), nvidia strip rule + rename/drop message-field
  engine trong `paramSupport.js` (`reasoning` → `reasoning_content` trên
  assistant message), strip `stream_options` khi request không stream trong
  `DefaultExecutor`, và rule fallback DEGRADED model-scoped
  (`errorConfig.js` + tham số provider/`modelScoped` trong
  `checkFallbackError`: 400 "DEGRADED…" → fallback, modelScoped, cooldown
  15 phút, chỉ khóa model đó, không khóa API key).
- Giữ nguyên các entry của fork khác với upstream parent: TIER_FALLBACKS trong
  `providerModels.js`, deepseek id có ngày, riva context lengths, cửa sổ
  minimax-m3/glm-5.2.

### Model mới / thay đổi

- **Không có provider mới.**
- Model mới: 8 model embedding nvidia (trên) + 3 model registry backport
  (bolt-e4b, laguna-xs-2.1, llama-3.3-70b-instruct).
- Model xóa: `nvidia/nv-embedqa-e5-v5`.
- Model sửa capabilities: `nvidia/nemotron-3-ultra-550b-a55b` (tools true, 1M
  context), `minimaxai/minimax-m3` (tools false).
- OpenCode: chỉ có probe validate opencode-go gửi `x-opencode-session`.
  OpenCode Free/Go/Zen đã được port từ trước trong 27 commit nền
  (`0b4b01a8`), không nằm trong 3 commit này.

### File thay đổi (16 file, +389/−9 so với `0b4b01a8`)

- `open-sse/config/embeddingParams.js` (mới), `open-sse/config/errorConfig.js`,
  `open-sse/executors/default.js`, `open-sse/handlers/embeddingProviders/openai.js`,
  `open-sse/handlers/embeddingsCore.js`, `open-sse/providers/capabilities.js`,
  `open-sse/providers/models/schema.js`, `open-sse/providers/registry/nvidia.js`,
  `open-sse/providers/schema.js`, `open-sse/services/accountFallback.js`,
  `open-sse/translator/concerns/paramSupport.js`,
  `src/app/(dashboard)/dashboard/media-providers/[kind]/[id]/components/EmbeddingExampleCard.js`,
  `src/app/api/providers/validate/route.js`,
  `tests/unit/embeddingsCore.test.js`, `tests/unit/nvidia-nemotron-ultra-caps.test.js` (mới),
  `tests/unit/nvidia-params.test.js` (mới).
- Không commit `node_modules` (symlink tới production, đã có trong `.gitignore`).

## Bỏ qua do thu hẹp phạm vi (31 commit)

Tất cả các commit dưới đây đều chưa được port, theo yêu cầu của Tan
("chỉ update opencode và nvidia"). Nếu sau này cần, port riêng từng commit.

| Upstream | Nội dung |
|---|---|
| `db83e88b` | feat(providers): OpenDesign Go + DeepRelay, quota tracking |
| `dbe446d0` | fix(providers): Alibaba Token Plan dual-endpoint + usage |
| `fdd942de` | feat(token-saver): REA allow prompt toggle |
| `c0feb3a0` | chore(i18n): dịch chuỗi/comment tiếng Việt còn lại sang tiếng Anh |
| `e180e752` | chore(deps): bump next toolchain, node-forge, vitest |
| `374e17b8` | feat(codex): GPT 6.2 Sol và Astra |
| `c779db2b` | fix(antigravity): rewrite OpenClaw prompt header, live model catalog |
| `bb399170` | fix(antigravity): strip Hermes prompt lines gây fake 429 |
| `ef55a10c` | fix(qoder): sign image uploads với multipart length |
| `46f488b1` | fix(cloudflare-ai): System One — clef, clef-omni, clairic + custom upstreamModelId (#5748). Lưu ý: System One hoàn toàn chưa có trong fork (không có handler/router/route), port commit này một mình sẽ đăng ký model mà không có executor. |
| `05fa58b8` | fix(antigravity): bump fingerprint lên Hub 2.33.0 |
| `e37cb78e` | feat(antigravity): lead generation với official identity prompt |
| `971ae638` | fix(translator): billing header khỏi cached Claude system prompt |
| `0957919c` | feat(kiro): CreateResponse (/v1/responses) fallback khi 429 (#5631) |
| `7d32657c` | fix(kimi): K3.1 Code context limits |
| `72ad720c` | feat(elevenlabs): refresh TTS models, live model list, voice field |
| `213558f1` | fix(mistral): text_delta dạng string + pin Large 4 limits |
| `6e3c16a1` | fix(usage): format B/T trên usage charts |
| `4e548583` | fix(models): combo seat context limits + opencode free-model windows. **Lưu ý:** nửa sau của commit này (opencode free-model windows trong `/v1/models`) đúng là về opencode, nhưng commit còn sửa logic combo-seat chung nên không port theo tiêu chí "thuần opencode/nvidia" — nếu Tan muốn phần opencode này thì port riêng. |
| `f5f3d396` | fix(proxy-pools): upload Cloudflare worker dạng multipart tự build |
| `1ca07616` | fix(cli-tools): cấu hình Pi model input/reasoning/thinking levels |
| `35b920c6` | fix(systemone): unwrap Cloudflare result envelope (cùng lý do System One như `46f488b1`) |
| `ecb4d49e` | fix(cloudflare-ai): prune model deprecated + thêm model thay thế (#5735) |
| `ada236da` | fix(kiro): Kiro IDE 1.4.154 + Gemini 4 Hydrogen tiers |
| `109e4816` | feat(antigravity): Gemini 4 Hydrogen, long decode, prompt-rejection recovery |
| `bc3a88b9` | test(antigravity): hydrogen pricing + injected-identity expectations |
| `767d7aeb` | fix(antigravity): sửa Gemini 4 và Claude 5.5 model ids + thinking tiers |
| `9fb84c94` | fix(cli-tools): commandcode/claude live catalogs trong pickers |
| `1da78e2b` | fix(kiro): IDE identity khi token refresh + Hydrogen changelog |
| `6b8b7ceb` | fix(antigravity): align client identity với live IDE, giữ UA shape |
| `5ae63d22` | **Version bump lên v0.5.123 — CHƯA ÁP DỤNG** (chỉ bump version khi đóng sync đầy đủ; sync này chỉ port 3/34 commit nên số version giữ nguyên). |

## Kiểm thử (2026-11-26, trên bản sync copy)

- **Full test suite (vitest): 20 test lỗi / 2,535 test pass** — bằng đúng baseline
  trước sync (16 file / 20 test lỗi có sẵn, 2,528 pass). Không có regression
  mới. Số pass tăng +7 nhờ test mới (ultra 1 + embeddingsCore input_type).
  Vitest báo thêm 1 file lỗi là `tests/unit/nvidia-params.test.js` — file này
  dùng `node:test` nên vitest báo "No test suite found"; chạy bằng
  `node --test` thì **9/9 pass**. Đây là hành vi đã biết của file node:test,
  không phải regression.
- **Lint (`npm run lint`): 0 error**, 38 warning có sẵn (không file nào trong
  số file sync này bị lỗi; eslint bỏ qua `open-sse/` và `tests/`).
  Lint trên CI cũng **pass**.
- **CI job test: FAIL** — 24 test lỗi / 2,531 pass (xem mục PR/CI).
- **Build (`npm run build`): `next build` biên dịch thành công**
  (`.next/BUILD_ID` đã tạo). Bước `postbuild` (`copy-standalone-assets.mjs`)
  lỗi `ERR_FS_CP_EINVAL` (src và dest trùng nhau tại
  `.next/standalone/node_modules/node-pty/build`) — do `node_modules` của bản
  sync là symlink tới `/root/ToolnetAPI/node_modules` (production), không liên
  quan tới 3 commit này; lỗi này có sẵn theo cấu hình sync copy, cần kiểm tra
  riêng trước khi dựa vào standalone output.
- **Chưa chạy:** integration test riêng; kiểm tra post-update chi tiết xem mục
  dưới.

## Kiểm tra sau cập nhật (post-update, trên bản sync copy / test)

- API endpoints: chưa kiểm tra bằng server live (không restart production).
  Các route đổi trong sync này (`/api/providers/validate` — probe opencode-go)
  đã qua test đơn vị liên quan; embeddings core qua `embeddingsCore.test.js`
  45/45.
- `/v1/models`: chưa kiểm tra live; registry nvidia mới (8 embedding model,
  ultra 1M) đã qua test `nvidia-params` 9/9 và ultra-caps 1/1.
- OpenCode Free/Go/Zen: không đổi trong sync này (đã port ở 27 commit nền).
  Test tập trung: `opencode-go-session`, `opencode-session`,
  `opencode-go-models`, `opencode-zen-models`, `opencode-zen-free-tier`,
  `opencode-free-routing` — 6 file, 82 test, **pass hết**; thêm 4 file
  opencode fingerprint/proxy — 51 test pass.
- Streaming / tool calling: ultra tools:true + strip `stream_options`
  non-stream đã qua test đơn vị (`nvidia-params` 9/9, `DefaultExecutor`
  transformRequest); chưa kiểm tra live.
- Provider cũ: full suite không regression mới (20 lỗi = đúng baseline);
  `provider-validation` pass.
- OAuth refresh / API key cũ / database / dashboard UI / CLI config cũ:
  không đụng tới trong sync này, không có thay đổi tương ứng.

## Trạng thái PR / CI / merge

- **PR: https://github.com/LBT-AI/toolnetapi/pull/9** (mở 2026-11-26, base `main`,
  head `sync/9router-v0.5.123-20261126`). Trạng thái: OPEN, MERGEABLE (không
  conflict).
- **CI: lint PASS, GitGuardian PASS, test FAIL — KHÔNG MERGE.**
  - Job test trên CI: 24 test lỗi / 2,531 pass (18 file lỗi). Trong đó 20 test
    lỗi giống hệt baseline của nhánh (đã có từ trước sync này, xem dưới), 4
    test chỉ lỗi trên CI:
    - `golden-url-header` cline/clinepass/kimi headers (3): snapshot ghi
      `X-PLATFORM-VERSION: v22.23.1` (Node 22, máy tạo snapshot) nhưng CI chạy
      Node 20 → `v20.20.2`. Lệch phiên bản Node giữa snapshot và CI, có sẵn
      từ 27 commit nền (snapshot được tạo lại trên VPS Node 22).
    - `devin-cli-executor` XDG_CONFIG_HOME (1): test yêu cầu env
      `XDG_CONFIG_HOME` không được set, nhưng runner GitHub set sẵn
      `/home/runner/.config`. Lỗi môi trường CI, code devin không hề đụng tới.
  - Cả 4 lỗi CI-only đều không liên quan tới 3 commit này (không file nào
    trong diff chạm tới header builder, devin executor hay snapshot).
  - 20 test lỗi còn lại (golden-request Kiro, golden-url-header claude +
    freebuff, cursor, headroom, hermes, jina, kiro-terminal, kiro-usage ×7,
    mimo-free.live ×2, cộng các file lỗi mức file: saml,
    custom-server-peer-headers, db-benchmark, embeddings.cloud, kimchi,
    kimchi-strip-reasoning) đã lỗi y hệt ở baseline `0b4b01a8` trước sync này
    và lỗi y hệt trên CI — không phải regression mới.
  - Vì job test đỏ nên **không merge** theo quy tắc (chỉ merge khi CI xanh).
    Muốn CI xanh phải sửa 20 lỗi có sẵn + 4 lỗi môi trường — nằm ngoài phạm vi
    sync opencode+nvidia này, cần quyết định riêng.
- **Chưa merge.**

## Production `/root/ToolnetAPI`

- **Hiện tại: KHÔNG cần pull / rebuild / restart.** Chưa có gì merge hay deploy.
- Sau khi PR được merge vào main: **cần** `git pull` + rebuild, vì PM2 gateway
  chạy từ `.next-prod` và `npm run start` tại đó sẽ lỗi cho tới khi build lại
  (thư mục `.next` đã bị xóa trong đợt dọn disk 2026-11-26).
