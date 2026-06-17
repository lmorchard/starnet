from audio_reference.slug import slugify


def test_basic_artist_title():
    assert slugify("TR/ST", "Icabod") == "trst-icabod"


def test_spaces_and_case():
    assert slugify("Agent Side Grinder", "Stripdown") == "agent-side-grinder-stripdown"


def test_collapses_punctuation_and_runs():
    assert slugify("The Knife!!", "Silent  Shout") == "the-knife-silent-shout"


def test_strips_leading_trailing_hyphens():
    assert slugify("  Goldfrapp  ", "  Systemagic  ") == "goldfrapp-systemagic"
