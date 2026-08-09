from arabic_document_translator.splitter import split_blocks


def test_single_paragraph_becomes_single_chunk():
    blocks = [("paragraph", "hello world")]
    chunks = split_blocks(blocks, target_words=100)
    assert len(chunks) == 1
    assert chunks[0].id == "chunk_0001"
    assert chunks[0].text == "hello world"
    assert chunks[0].word_count == 2


def test_heading_starts_new_chunk():
    blocks = [
        ("paragraph", "one two three"),
        ("heading", "Section 2"),
        ("paragraph", "four five"),
    ]
    chunks = split_blocks(blocks, target_words=100)
    assert len(chunks) == 2
    assert chunks[1].starts_with_heading is True
    assert chunks[1].text.startswith("Section 2")


def test_greedy_cut_at_target():
    # 5 paragraphs of 3 words each = 15 words, target 6 → cut after target reached
    blocks = [("paragraph", "a a a") for _ in range(5)]
    chunks = split_blocks(blocks, target_words=6)
    # First chunk hits 6 words (2 paragraphs = 6), third paragraph starts new chunk
    assert len(chunks) >= 2
    total_words = sum(c.word_count for c in chunks)
    assert total_words == 15


def test_paragraph_never_split_mid():
    blocks = [("paragraph", "one two three four five six seven eight nine ten")]
    chunks = split_blocks(blocks, target_words=3)
    # Even though target is 3, the single paragraph stays whole.
    assert len(chunks) == 1
    assert chunks[0].word_count == 10


def test_ids_are_sequential_and_padded():
    blocks = [("paragraph", "x") for _ in range(3)]
    chunks = split_blocks(blocks, target_words=1)
    ids = [c.id for c in chunks]
    assert ids == ["chunk_0001", "chunk_0002", "chunk_0003"]
