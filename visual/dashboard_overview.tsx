import React from "react"
import SentimentGauge from "./SentimentGauge"
import AssetOverviewPanel from "./AssetOverviewPanel"
import WhaleTrackerCard from "./WhaleTrackerCard"

export const AnalyticsDashboard: React.FC = () => (
  <div className="p-8 bg-gray-100 min-h-screen">
    <header className="mb-8">
      <h1 className="text-4xl font-bold text-gray-900">Analytics Dashboard</h1>
      <p className="text-gray-600 mt-2">
        Market sentiment, asset metrics, and whale activity at a glance
      </p>
    </header>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <section className="col-span-1">
        <SentimentGauge symbol="SOL" />
      </section>
      <section className="col-span-1">
        <AssetOverviewPanel assetId="SOL-01" />
      </section>
      <section className="col-span-1">
        <WhaleTrackerCard />
      </section>
    </div>
  </div>
)

export default AnalyticsDashboard
