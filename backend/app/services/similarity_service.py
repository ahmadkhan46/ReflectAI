"""Semantic similarity service using sentence-transformers.

Uses sentence-transformers/all-MiniLM-L6-v2 (~80 MB) to find journal entries
with similar emotional/thematic content.

Privacy guarantee: all computation is local — raw text never leaves the server.
The model is lazy-loaded and cached in a module-level variable.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

_sentence_model: Any = None


class SimilarityServiceError(Exception):
    """Raised when the similarity model is unavailable."""


def _get_model() -> Any:
    """Lazy-load and cache the sentence-transformers model."""
    global _sentence_model
    if _sentence_model is None:
        try:
            from sentence_transformers import SentenceTransformer  # type: ignore[import]
            logger.info("Loading sentence model: sentence-transformers/all-MiniLM-L6-v2")
            _sentence_model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
            logger.info("Sentence model loaded")
        except Exception as exc:
            logger.warning(f"Sentence model unavailable: {exc}")
            raise SimilarityServiceError("Sentence model not installed.") from exc
    return _sentence_model


def find_similar(
    texts_by_id: dict[str, str],
    query_id: str,
    top_n: int = 3,
) -> list[tuple[str, float]]:
    """Return the top-N entries most semantically similar to the query entry.

    Args:
        texts_by_id: Mapping of entry_id -> decrypted plaintext.
        query_id: The ID of the entry to compare against.
        top_n: Number of similar entries to return.

    Returns:
        List of (entry_id, similarity_score) sorted by score descending,
        excluding the query entry itself.

    Raises:
        SimilarityServiceError: If the model is not available.
    """
    if query_id not in texts_by_id or len(texts_by_id) < 2:
        return []

    model = _get_model()

    from sentence_transformers import util  # type: ignore[import]

    ids = list(texts_by_id.keys())
    texts = [texts_by_id[i] for i in ids]

    embeddings = model.encode(texts, convert_to_tensor=True, show_progress_bar=False)
    query_idx = ids.index(query_id)
    scores = util.cos_sim(embeddings[query_idx], embeddings)[0]

    results = [
        (ids[i], float(scores[i]))
        for i in range(len(ids))
        if ids[i] != query_id
    ]
    results.sort(key=lambda x: x[1], reverse=True)
    return results[:top_n]
