from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
YT = ROOT.parent / 'youtube-downloader'

src = (YT / 'content' / 'content.css').read_text(encoding='utf-8')
out = src
for old, new in [
    ('#yt-dl-panel', '#xhs-dl-panel'),
    ('#yt-dl-toggle', '#xhs-dl-toggle'),
    ('#yt-dl-menu', '#xhs-dl-menu'),
    ('#yt-dl-close', '#xhs-dl-close'),
    ('#yt-dl-home', '#xhs-dl-home'),
    ('#yt-dl-page', '#xhs-dl-page'),
    ('#yt-dl-store-rating', '#xhs-dl-store-rating'),
    ('#yt-dl-progress-pct', '#xhs-dl-progress-pct'),
    ('yt-dl-', 'xhs-dl-'),
    ('--ytd-', '--xhsd-'),
]:
    out = out.replace(old, new)
out = out.replace("content: '频道 · ';", "content: '作者 · ';")

extra = """

#xhs-dl-panel-root.is-hidden {
  display: none !important;
}

.xhs-dl-thumb {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  object-fit: cover;
  background: var(--xhsd-surface);
  flex-shrink: 0;
}

.xhs-dl-thumb-ph {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--xhsd-bg);
  color: var(--xhsd-text-muted);
  flex-shrink: 0;
}

.xhs-dl-text-preview {
  max-height: 180px;
  overflow-y: auto;
  margin-bottom: 10px;
  padding: 10px 12px;
  border: 1px solid var(--xhsd-border);
  border-radius: 12px;
  background: var(--xhsd-surface);
  font-size: 12px;
  line-height: 1.55;
  color: var(--xhsd-text);
  white-space: pre-wrap;
  word-break: break-word;
}

.xhs-dl-text-preview.is-empty {
  color: var(--xhsd-text-muted);
  text-align: center;
}

.xhs-dl-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.xhs-dl-btn-secondary {
  margin-top: 0;
}
"""
(ROOT / 'content' / 'content.css').write_text(out + extra, encoding='utf-8')

popup = (YT / 'popup' / 'popup.css').read_text(encoding='utf-8')
popup = popup.replace('--ytd-', '--xhsd-').replace("content: 'UP · ';", "content: '作者 · ';")
(ROOT / 'popup' / 'popup.css').write_text(popup, encoding='utf-8')
print('ok')
