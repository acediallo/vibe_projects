from arabic_document_translator import glossary as g


def test_empty_files_merge_to_empty(tmp_path):
    gp = tmp_path / "global.json"
    pp = tmp_path / "project.json"
    assert g.merged(gp, pp) == {}


def test_project_overrides_global(tmp_path):
    gp = tmp_path / "global.json"
    pp = tmp_path / "project.json"
    gp.write_text('{"terms": {"الشركة": {"en": "the Company", "source": "global"}}}')
    pp.write_text('{"terms": {"الشركة": {"en": "the Firm", "source": "project"}}}')
    merged = g.merged(gp, pp)
    assert merged["الشركة"]["en"] == "the Firm"


def test_global_only_terms_visible(tmp_path):
    gp = tmp_path / "global.json"
    pp = tmp_path / "project.json"
    gp.write_text('{"terms": {"مجلس الأمن": {"en": "Security Council", "source": "global"}}}')
    merged = g.merged(gp, pp)
    assert merged["مجلس الأمن"]["en"] == "Security Council"


def test_add_project_term_flags_global_conflict(tmp_path):
    gp = tmp_path / "global.json"
    pp = tmp_path / "project.json"
    gp.write_text('{"terms": {"الشركة": {"en": "the Company", "source": "global"}}}')
    added, conflict = g.add_project_term(
        project_path=pp,
        arabic="الشركة",
        english="the Firm",
        first_seen="chunk_0002",
        global_path=gp,
    )
    assert added is True
    assert conflict is not None
    assert "the Company" in conflict


def test_add_project_term_no_conflict_when_agrees(tmp_path):
    gp = tmp_path / "global.json"
    pp = tmp_path / "project.json"
    gp.write_text('{"terms": {"الشركة": {"en": "the Company", "source": "global"}}}')
    added, conflict = g.add_project_term(
        project_path=pp,
        arabic="الشركة",
        english="the Company",
        first_seen="chunk_0002",
        global_path=gp,
    )
    assert added is True
    assert conflict is None


def test_add_project_term_is_idempotent(tmp_path):
    pp = tmp_path / "project.json"
    g.add_project_term(pp, "س", "S", "chunk_0001")
    added, _ = g.add_project_term(pp, "س", "S2", "chunk_0002")
    assert added is False  # already known, not overwritten
    data = g.load_project(pp)
    assert data["terms"]["س"]["en"] == "S"


def test_format_for_prompt():
    text = g.format_for_prompt({"ب": {"en": "B"}, "ا": {"en": "A"}})
    lines = text.splitlines()
    assert lines[0].startswith("- ا")  # sorted
    assert "→" in text
