from main import sanitize_usage_post_content


ASSET_ID = "11111111-1111-1111-1111-111111111111"


def test_removes_scripts_and_event_handlers() -> None:
    html = '<p onclick="alert(1)">safe<script>alert(2)</script><img src="x" onerror="alert(3)"></p>'

    cleaned = sanitize_usage_post_content(ASSET_ID, html)

    assert "<script" not in cleaned
    assert "onclick" not in cleaned
    assert "onerror" not in cleaned
    assert "safe" in cleaned


def test_keeps_editor_formatting_and_internal_images() -> None:
    image_url = f"/api/usage-posts/{ASSET_ID}/assets/image.png"
    html = f'<p><strong>bold</strong> <u>underline</u> <span style="color: #c00000">red</span></p><img src="{image_url}" alt="capture">'

    cleaned = sanitize_usage_post_content(ASSET_ID, html)

    assert "<strong>bold</strong>" in cleaned
    assert "<u>underline</u>" in cleaned
    assert "color: #c00000" in cleaned
    assert image_url in cleaned


def test_removes_external_images() -> None:
    cleaned = sanitize_usage_post_content(ASSET_ID, '<img src="https://example.com/tracker.png">')

    assert "https://example.com" not in cleaned
