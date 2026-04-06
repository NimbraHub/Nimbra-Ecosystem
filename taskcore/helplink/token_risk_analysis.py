import math
from typing import Dict, Any


def _normalize_value(value: float, min_val: float, max_val: float) -> float:
    """
    Normalize a numeric value into the range [0, 1].
    """
    if max_val == min_val:
        return 0.0
    return max(0.0, min(1.0, (value - min_val) / (max_val - min_val)))


def _flag_penalty(flags_mask: int, weight: int = 5) -> int:
    """
    Compute the penalty score from risk flags.
    Each set bit in the mask contributes `weight` points.
    """
    return bin(flags_mask).count("1") * weight


def calculate_risk_score(price_change_pct: float, liquidity_usd: float, flags_mask: int) -> float:
    """
    Compute a 0–100 risk score based on volatility, liquidity, and flagged risks.

    Parameters:
        price_change_pct: Percent change over period (e.g. +5.0 for +5%).
        liquidity_usd: Total liquidity in USD.
        flags_mask: Integer bitmask of risk flags; each set bit adds a penalty.

    Returns:
        Risk score as a float in the range [0, 100].
    """
    # volatility component (max 50)
    volatility_intensity = abs(price_change_pct) / 10
    vol_score = min(volatility_intensity, 1) * 50

    # liquidity component: more liquidity reduces risk
    if liquidity_usd > 0:
        liq_factor = math.log10(liquidity_usd)
        liq_score = max(0.0, 30 - (liq_factor * 5))
    else:
        liq_score = 30.0

    # flag penalty
    flag_score = _flag_penalty(flags_mask)

    raw_score = vol_score + liq_score + flag_score
    return min(round(raw_score, 2), 100.0)


def explain_risk_breakdown(price_change_pct: float, liquidity_usd: float, flags_mask: int) -> Dict[str, Any]:
    """
    Provide a detailed breakdown of the risk components for transparency.
    """
    volatility_intensity = abs(price_change_pct) / 10
    vol_score = min(volatility_intensity, 1) * 50

    if liquidity_usd > 0:
        liq_factor = math.log10(liquidity_usd)
        liq_score = max(0.0, 30 - (liq_factor * 5))
    else:
        liq_score = 30.0

    flag_score = _flag_penalty(flags_mask)
    total = min(round(vol_score + liq_score + flag_score, 2), 100.0)

    return {
        "volatility_component": vol_score,
        "liquidity_component": liq_score,
        "flags_component": flag_score,
        "final_score": total,
    }
