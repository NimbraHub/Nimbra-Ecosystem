from typing import List, Tuple


def _truncate_pairs(timestamps: List[int], counts: List[int]) -> List[Tuple[int, int]]:
    """
    Align timestamps and counts to the same length and drop None entries.
    """
    n = min(len(timestamps), len(counts))
    pairs: List[Tuple[int, int]] = []
    for i in range(n):
        t, c = timestamps[i], counts[i]
        if t is None or c is None:
            continue
        pairs.append((int(t), int(c)))
    return pairs


def _normalize_series(values: List[float]) -> List[float]:
    """
    Normalize a list of non-negative values to [0.0, 1.0] with 4-decimal rounding.
    """
    if not values:
        return []
    m = max(values) or 1.0
    return [round(v / m, 4) for v in values]


def generate_activity_heatmap(
    timestamps: List[int],
    counts: List[int],
    buckets: int = 10,
    normalize: bool = True
) -> List[float]:
    """
    Bucket activity counts into 'buckets' time intervals, returning either raw counts
    or normalized values in [0.0–1.0].

    Args:
        timestamps: list of epoch-ms timestamps
        counts: list of integer counts per timestamp
        buckets: number of buckets (>= 1)
        normalize: if True, scale bucket totals to [0, 1]

    Returns:
        List of length 'buckets' with bucket totals (normalized if requested)
    """
    if buckets < 1:
        raise ValueError("buckets must be >= 1")
    if not timestamps or not counts:
        return [0.0] * buckets if normalize else [0] * buckets

    pairs = _truncate_pairs(timestamps, counts)
    if not pairs:
        return [0.0] * buckets if normalize else [0] * buckets

    # Determine span and bucket size (handle zero-span safely)
    t_vals = [t for t, _ in pairs]
    t_min, t_max = min(t_vals), max(t_vals)
    span = max(1, t_max - t_min)
    bucket_size = span / buckets

    # Aggregate counts per bucket
    agg = [0] * buckets
    for t, c in pairs:
        # Clamp to last bucket for max timestamp
        idx = min(buckets - 1, int((t - t_min) / bucket_size))
        if c > 0:
            agg[idx] += c

    return _normalize_series([float(v) for v in agg]) if normalize else agg


def explain_activity_buckets(
    timestamps: List[int],
    counts: List[int],
    buckets: int = 10
) -> List[Tuple[Tuple[int, int], int]]:
    """
    Return per-bucket ((start_ms, end_ms), raw_total) for diagnostics and debugging.
    """
    if buckets < 1:
        raise ValueError("buckets must be >= 1")
    if not timestamps or not counts:
        return [((0, 0), 0) for _ in range(buckets)]

    pairs = _truncate_pairs(timestamps, counts)
    if not pairs:
        return [((0, 0), 0) for _ in range(buckets)]

    t_vals = [t for t, _ in pairs]
    t_min, t_max = min(t_vals), max(t_vals)
    span = max(1, t_max - t_min)
    bucket_size = span / buckets

    agg = [0] * buckets
    for t, c in pairs:
        idx = min(buckets - 1, int((t - t_min) / bucket_size))
        if c > 0:
            agg[idx] += c

    result: List[Tuple[Tuple[int, int], int]] = []
    for i in range(buckets):
        start = int(t_min + i * bucket_size)
        end = int(t_min + (i + 1) * bucket_size) if i < buckets - 1 else int(t_max)
        result.append(((start, end), agg[i]))
    return result
