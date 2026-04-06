from typing import List, Dict, Optional, TypedDict
import math


class VolumeBurstEvent(TypedDict):
    index: int
    previous: float
    current: float
    ratio: float
    baseline: float


def _safe_ratio(prev: float, curr: float) -> float:
    """
    Compute curr/prev safely. If prev <= 0:
      - return +inf when curr > 0
      - return 1.0 when curr <= 0 (treat as no change)
    """
    if prev > 0:
        return curr / prev
    return math.inf if curr > 0 else 1.0


def _rolling_mean(values: List[float], end_idx: int, window: int) -> float:
    """
    Mean of the last `window` values ending at end_idx-1 (exclusive of end_idx).
    Falls back to values[end_idx-1] if not enough history.
    """
    if window <= 0 or end_idx <= 0:
        return values[end_idx - 1]
    start = max(0, end_idx - window)
    if start == end_idx:
        return values[end_idx - 1]
    segment = values[start:end_idx]
    return sum(segment) / len(segment)


def detect_volume_bursts(
    volumes: List[float],
    threshold_ratio: float = 1.5,
    min_interval: int = 1,
    window: int = 0,
    min_current: float = 0.0
) -> List[VolumeBurstEvent]:
    """
    Identify indices where volume jumps by `threshold_ratio` against a baseline.

    Baseline:
      - If window == 0 (default): previous value at i-1
      - If window  > 0: rolling mean of the last `window` values before i

    Args:
        volumes: sequence of volume values
        threshold_ratio: trigger when current / baseline >= threshold_ratio
        min_interval: minimal index distance between consecutive events
        window: baseline window size; 0 means use previous value
        min_current: minimum absolute current volume to consider (filters tiny spikes)

    Returns:
        List of events: {index, previous, current, ratio, baseline}
    """
    if threshold_ratio <= 0:
        raise ValueError("threshold_ratio must be > 0")
    if min_interval < 1:
        min_interval = 1
    if len(volumes) < 2:
        return []

    events: List[VolumeBurstEvent] = []
    last_idx = -min_interval

    for i in range(1, len(volumes)):
        prev = volumes[i - 1]
        curr = volumes[i]
        if curr < min_current:
            continue

        baseline = _rolling_mean(volumes, i, window)
        ratio = _safe_ratio(baseline, curr)

        if ratio >= threshold_ratio and (i - last_idx) >= min_interval:
            events.append(
                VolumeBurstEvent(
                    index=i,
                    previous=float(prev),
                    current=float(curr),
                    ratio=round(ratio, 4),
                    baseline=float(baseline),
                )
            )
            last_idx = i

    return events
