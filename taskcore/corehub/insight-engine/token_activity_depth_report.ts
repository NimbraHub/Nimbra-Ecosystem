/**
 * Orchestrated analysis & signing pipeline with basic validation and timing
 * Assumes the following globals/classes are available in the project:
 *  - TokenActivityAnalyzer
 *  - TokenDepthAnalyzer
 *  - detectVolumePatterns
 *  - ExecutionEngine
 *  - SigningEngine
 */

(async () => {
  const ACTIVITY_RPC = process.env.SOLANA_RPC_ENDPOINT || "https://solana.rpc"
  const DEX_API = process.env.DEX_API_ENDPOINT || "https://dex.api"
  const MINT = process.env.MINT_PUBKEY || "MintPubkeyHere"
  const MARKET = process.env.MARKET_PUBKEY || "MarketPubkeyHere"

  const time = () => Date.now()
  const since = (t: number) => `${Date.now() - t}ms`

  try {
    // 1) Analyze activity
    const t1 = time()
    const activityAnalyzer = new TokenActivityAnalyzer(ACTIVITY_RPC)
    const records = await activityAnalyzer.analyzeActivity(MINT, 20)
    if (!Array.isArray(records)) {
      throw new Error("Activity analyzer returned a non-array result")
    }
    console.log(`[1] activity analyzed: ${records.length} records in ${since(t1)}`)

    // 2) Analyze depth
    const t2 = time()
    const depthAnalyzer = new TokenDepthAnalyzer(DEX_API, MARKET)
    const depthMetrics = await depthAnalyzer.analyze(30)
    if (!depthMetrics) {
      throw new Error("Depth analyzer returned no metrics")
    }
    console.log(`[2] depth analyzed in ${since(t2)}`)

    // 3) Detect patterns
    const t3 = time()
    const volumes = records.map(r => r.amount)
    const patterns = detectVolumePatterns(volumes, 5, 100)
    console.log(`[3] patterns detected: ${patterns.length} in ${since(t3)}`)

    // 4) Execute a custom task via engine
    const t4 = time()
    const engine = new ExecutionEngine()
    engine.register("report", async (params: { records: any[] }) => ({
      records: params.records.length,
      hasPatterns: patterns.length > 0,
    }))
    engine.enqueue("task1", "report", { records })
    const taskResults = await engine.runAll()
    console.log(`[4] task engine completed ${taskResults.length} task(s) in ${since(t4)}`)

    // 5) Sign and verify the results
    const t5 = time()
    const signer = new SigningEngine()
    const payload = JSON.stringify({ depthMetrics, patterns, taskResults })
    const signature = await signer.sign(payload)
    const signatureValid = await signer.verify(payload, signature)
    if (!signatureValid) {
      throw new Error("Signature verification failed")
    }
    console.log(`[5] signing complete in ${since(t5)}`)

    // Final report
    console.log(
      JSON.stringify(
        {
          recordsCount: records.length,
          depthMetrics,
          patternsCount: patterns.length,
          taskResults,
          signatureValid,
        },
        null,
        2
      )
    )
  } catch (err: any) {
    console.error(`[pipeline] error: ${err?.message || String(err)}`)
    if (process && typeof process.exitCode !== "undefined") {
      process.exitCode = 1
    }
  }
})()
