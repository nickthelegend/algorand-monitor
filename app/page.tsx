"use client"

import React, { useState, useCallback, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Activity, Wallet, FileCodeIcon as FileContract, Coins, Globe } from "lucide-react"
import WalletMonitor from "../components/WalletMonitor"
import ContractMonitor from "../components/ContractMonitor"
import AssetMonitor from "../components/AssetMonitor"
import { ChartContainer } from "@/components/ui/chart"
import * as RechartsPrimitive from "recharts"

const ACCOUNTS_API = {
  day: "https://metrics.allo.info/api/v1/analytics/day/charts/accounts/new?interval=short&format=JSONColumns",
  week: "https://metrics.allo.info/api/v1/analytics/week/charts/addresses/new?interval=short&format=JSONColumns",
  month: "https://metrics.allo.info/api/v1/analytics/month/charts/addresses/new?interval=short&format=JSONColumns",
  year: "https://metrics.allo.info/api/v1/analytics/year/charts/accounts/new?interval=short&format=JSONColumns",
}

function AccountsMonitorTab() {
  const [range, setRange] = useState<'day' | 'week' | 'month' | 'year'>('week')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fetchedRef = React.useRef<{ [k: string]: any }>({})

  useEffect(() => {
    if (fetchedRef.current[range]) {
      setData(fetchedRef.current[range])
      return
    }
    setLoading(true)
    setError(null)
    fetch(ACCOUNTS_API[range])
      .then((res) => res.json())
      .then((json) => {
        setData(json)
        fetchedRef.current[range] = json
      })
      .catch((e) => setError('Failed to fetch data'))
      .finally(() => setLoading(false))
  }, [range])

  const chartData = React.useMemo(() => {
    if (!data) return []
    return data.ts.map((ts: string, i: number) => ({
      ts,
      new: Number(data.newAddresses?.[i] || data.newAccounts?.[i] || 0),
      total: Number(data.totalAddresses?.[i] || data.totalAccounts?.[i] || 0),
    }))
  }, [data])

  return (
    <div className="space-y-4">
      <div className="flex gap-2 mb-2">
        {(['day', 'week', 'month', 'year'] as const).map((r) => (
          <Button key={r} variant={range === r ? 'default' : 'outline'} size="sm" onClick={() => setRange(r)}>
            {r.charAt(0).toUpperCase() + r.slice(1)}
          </Button>
        ))}
      </div>
      {loading ? (
        <div>Loading...</div>
      ) : error ? (
        <div className="text-red-500">{error}</div>
      ) : data ? (
        <ChartContainer
          config={{
            new: { label: 'New Accounts', color: '#3b82f6' },
            total: { label: 'Total Accounts', color: '#10b981' },
          }}
          className="w-full h-96"
        >
          <RechartsPrimitive.LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
            <RechartsPrimitive.CartesianGrid strokeDasharray="3 3" />
            <RechartsPrimitive.XAxis dataKey="ts" minTickGap={32} tickFormatter={(v: string) => v.slice(5, 16)} />
            <RechartsPrimitive.YAxis yAxisId="left" orientation="left" tickFormatter={(v: number) => v.toLocaleString()} />
            <RechartsPrimitive.YAxis yAxisId="right" orientation="right" tickFormatter={(v: number) => v.toLocaleString()} />
            <RechartsPrimitive.Tooltip />
            <RechartsPrimitive.Legend />
            <RechartsPrimitive.Line yAxisId="left" type="monotone" dataKey="new" stroke="#3b82f6" dot={false} name="New Accounts" />
            <RechartsPrimitive.Line yAxisId="right" type="monotone" dataKey="total" stroke="#10b981" dot={false} name="Total Accounts" />
          </RechartsPrimitive.LineChart>
        </ChartContainer>
      ) : null}
    </div>
  )
}

export default function AlgorandMonitorDashboard() {
  const [activeMonitors, setActiveMonitors] = useState({
    wallet: 0,
    contract: 0,
    asset: 0,
  })

  const [network, setNetwork] = useState<"mainnet" | "testnet">("testnet")

  const toggleNetwork = () => {
    setNetwork((prev) => (prev === "mainnet" ? "testnet" : "mainnet"))
  }

  const handleWalletMonitorCountChange = useCallback((count: number) => {
    setActiveMonitors((prev) => ({ ...prev, wallet: count }))
  }, [])

  const handleContractMonitorCountChange = useCallback((count: number) => {
    setActiveMonitors((prev) => ({ ...prev, contract: count }))
  }, [])

  const handleAssetMonitorCountChange = useCallback((count: number) => {
    setActiveMonitors((prev) => ({ ...prev, asset: count }))
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Activity className="h-8 w-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Algorand Monitor Dashboard</h1>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-slate-600" />
                <span className="text-sm text-slate-600 dark:text-slate-400">Network:</span>
                <Badge variant={network === "mainnet" ? "default" : "secondary"} className="text-xs">
                  {network === "mainnet" ? "MainNet" : "TestNet"}
                </Badge>
              </div>

              <Button
                onClick={toggleNetwork}
                variant="outline"
                size="sm"
                className={`${
                  network === "mainnet"
                    ? "border-green-500 text-green-700 hover:bg-green-50"
                    : "border-blue-500 text-blue-700 hover:bg-blue-50"
                }`}
              >
                Switch to {network === "mainnet" ? "TestNet" : "MainNet"}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <p className="text-slate-600 dark:text-slate-400 text-lg">
              Real-time monitoring for Algorand wallets, smart contracts, and assets
            </p>
            <Badge variant={network === "mainnet" ? "destructive" : "default"} className="ml-2">
              {network === "mainnet" ? "🔴 LIVE" : "🧪 TEST"}
            </Badge>
          </div>

          <div className="flex gap-4 mt-4">
            <Card className="flex-1">
              <CardContent className="flex items-center gap-3 p-4">
                <Wallet className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Wallet Monitors</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{activeMonitors.wallet}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="flex-1">
              <CardContent className="flex items-center gap-3 p-4">
                <FileContract className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Contract Monitors</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{activeMonitors.contract}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="flex-1">
              <CardContent className="flex items-center gap-3 p-4">
                <Coins className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Asset Monitors</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{activeMonitors.asset}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Tabs defaultValue="wallet" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="wallet" className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Wallet Monitor
            </TabsTrigger>
            <TabsTrigger value="contract" className="flex items-center gap-2">
              <FileContract className="h-4 w-4" />
              Contract Monitor
            </TabsTrigger>
            <TabsTrigger value="asset" className="flex items-center gap-2">
              <Coins className="h-4 w-4" />
              Asset Monitor
            </TabsTrigger>
            <TabsTrigger value="accounts" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Accounts Monitor
            </TabsTrigger>
          </TabsList>

          <TabsContent value="wallet">
            <WalletMonitor network={network} onMonitorCountChange={handleWalletMonitorCountChange} />
          </TabsContent>

          <TabsContent value="contract">
            <ContractMonitor network={network} onMonitorCountChange={handleContractMonitorCountChange} />
          </TabsContent>

          <TabsContent value="asset">
            <AssetMonitor network={network} onMonitorCountChange={handleAssetMonitorCountChange} />
          </TabsContent>

          <TabsContent value="accounts">
            <AccountsMonitorTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
