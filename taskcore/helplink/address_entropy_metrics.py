import math
from typing import List, Dict, Tuple


def _frequency_distribution(items: List[str]) -> Dict[str, int]:
    """
    Count occurrences of unique items in the input list.
    """
    freq: Dict[str, int] = {}
    for item in items:
        if item is None:
            continue
        freq[item] = freq.get(item, 0) + 1
    return freq


def compute_shannon_entropy(addresses: List[str]) -> float:
    """
    Compute Shannon entropy (bits) of a sequence of addresses.

    Args:
        addresses: list of addresses (strings)

    Returns:
        Shannon entropy in bits, rounded to 4 decimals.
    """
    if not addresses:
        return 0.0

    freq = _frequency_distribution(addresses)
    total = sum(freq.values())
    if total == 0:
        return 0.0

    entropy = 0.0
    for count in freq.values():
        p = count / total
        entropy -= p * math.log2(p)
    return round(entropy, 4)


def normalized_entropy(addresses: List[str]) -> float:
    """
    Compute normalized Shannon entropy in [0,1].
    0 means no diversity, 1 means maximum diversity (all unique).
    """
    if not addresses:
        return 0.0

    freq = _frequency_distribution(addresses)
    total = sum(freq.values())
    if total == 0:
        return 0.0

    entropy = compute_shannon_entropy(addresses)
    max_entropy = math.log2(len(freq)) if len(freq) > 0 else 1.0
    return round(entropy / max_entropy, 4) if max_entropy > 0 else 0.0


def entropy_breakdown(addresses: List[str]) -> List[Tuple[str, float]]:
    """
    Return per-address contribution to total entropy.
    """
    if not addresses:
        return []

    freq = _frequency_distribution(addresses)
    total = sum(freq.values())
    if total == 0:
        return []

    breakdown: List[Tuple[str, float]] = []
    for addr, count in freq.items():
        p = count / total
        contribution = -(p * math.log2(p))
        breakdown.append((addr, round(contribution, 6)))
    return breakdown
