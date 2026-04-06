import React, { useEffect, useMemo, useState } from "react"

interface AssetOverviewPanelProps {
  assetId: string
  endpointBase?: string // optional override for API base
}

interface AssetOverview {
  name: string
  priceUsd: number
  supply: number
  holders: number
}

export const AssetOverviewPanel: React.FC<AssetOverviewPanelProps> = ({
  assetId,
  endpointBase = "/api/assets",
}) => {
  const [info, setInfo] = useState<AssetOverview | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const currencyFmt = useMemo(
    () => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 }),
    []
  )
  const numberFmt = useMemo(
    () => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }),
    []
  )

  useEffect(() => {
    let isMounted = true
    const ctrl = new AbortController()

    async function fetchInfo() {
      setIsLoading(true)
      setError(null)
      try {
        const url = `${endpointBase}/${encodeURIComponent(assetId)}`
        const res = await fetch(url, { signal: ctrl.signal })
        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`)
        }
        const json: AssetOverview = await res.json()
        if (isMounted) setInfo(json)
      } catch (e: unknown) {
        if (!isMounted || (e as any)?.name === "AbortError") return
        setError(e instanceof Error ? e.message : "Unknown error")
        setInfo(null)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    fetchInfo()
    return () => {
      isMounted = false
      ctrl.abort()
    }
  }, [assetId, endpointBase])

  if (isLoading && !info) {
    return (
      <div className="p-4 bg-white rounded shadow">
        <h2 className="text-xl font-semibold mb-2">Asset Overview</h2>
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-200 rounded w-2/3" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          <div className="h-4 bg-gray-200 rounded w-1/3" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-white rounded shadow">
        <h2 className="text-xl font-semibold mb-2">Asset Overview</h2>
        <p className="text-red-600 font-medium">Failed to load asset data</p>
        <p className="text-sm text-gray-600">{error}</p>
      </div>
    )
  }

  if (!info) {
    return (
      <div className="p-4 bg-white rounded shadow">
        <h2 className="text-xl font-semibold mb-2">Asset Overview</h2>
        <p>No data available</p>
      </div>
    )
  }

  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-xl font-semibold mb-2">Asset Overview</h2>
      <p><strong>ID:</strong> {assetId}</p>
      <p><strong>Name:</strong> {info.name}</p>
      <p><strong>Price (USD):</strong> {currencyFmt.format(info.priceUsd ?? 0)}</p>
      <p><strong>Circulating Supply:</strong> {numberFmt.format(info.supply)}</p>
      <p><strong>Holders:</strong> {numberFmt.format(info.holders)}</p>
    </div>
  )
}

export default AssetOverviewPanel
