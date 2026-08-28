from pathlib import Path

from backend.routers import upload as upload_router


def test_delete_uploaded_file_urls_removes_matching_images(tmp_path, monkeypatch):
    monkeypatch.setattr(upload_router, "IMAGE_DIR", tmp_path)
    target = tmp_path / "pending.png"
    target.write_bytes(b"test")

    deleted = upload_router.delete_uploaded_files(["/assets/flow-images/pending.png"])

    assert deleted == 1
    assert not target.exists()
