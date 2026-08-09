from arabic_document_translator.manifest import (
    ChunkEntry,
    Manifest,
    STATUS_PENDING,
    STATUS_TRANSLATED,
    load,
    save,
)


def _sample() -> Manifest:
    return Manifest(
        source_file="source/x.txt",
        chunk_size_target_words=1500,
        model="claude-sonnet-5",
        chunks=[
            ChunkEntry(
                id="chunk_0001",
                status=STATUS_PENDING,
                source_path="chunks/chunk_0001.txt",
                translated_path="translated/chunk_0001.txt",
                word_count_src=100,
            )
        ],
    )


def test_roundtrip(tmp_path):
    m = _sample()
    path = tmp_path / "manifest.json"
    save(m, path)
    loaded = load(path)
    assert loaded.source_file == m.source_file
    assert loaded.model == m.model
    assert loaded.chunks[0].id == "chunk_0001"
    assert loaded.chunks[0].status == STATUS_PENDING


def test_status_mutation_survives_save(tmp_path):
    m = _sample()
    path = tmp_path / "manifest.json"
    save(m, path)
    m.chunks[0].status = STATUS_TRANSLATED
    m.chunks[0].attempts = 1
    save(m, path)
    loaded = load(path)
    assert loaded.chunks[0].status == STATUS_TRANSLATED
    assert loaded.chunks[0].attempts == 1


def test_atomic_save_leaves_no_tmp_files(tmp_path):
    m = _sample()
    path = tmp_path / "manifest.json"
    save(m, path)
    save(m, path)
    stragglers = [p for p in tmp_path.iterdir() if p.name != "manifest.json"]
    assert stragglers == []


def test_get_raises_for_unknown_id(tmp_path):
    import pytest
    m = _sample()
    with pytest.raises(KeyError):
        m.get("chunk_9999")
