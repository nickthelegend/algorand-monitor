
"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AlertCircle, Trash2, ExternalLink, RefreshCw, Loader2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import algosdk from "algosdk"

interface AssetMonitorProps {
  network: "mainnet" | "testnet"
  onMonitorCountChange: (count: number) => void
}

interface Asset {
  index: number | bigint
  params: {
    name: string
    "unit-name": string
    total: number | bigint
    url: string
    creator: string
    decimals: number
  }
  creationTime?: Date
}

interface AssetCreationStats {
  weekly: number
  monthly: number
  yearly: number
  total: number
}

interface AddressMonitor {
  id: string
  address: string
  assets: Asset[]
  creationStats?: AssetCreationStats
  assetsWithTime?: Asset[]
  isLoading: boolean
  error?: string
}

export default function AssetMonitor({ network, onMonitorCountChange }: AssetMonitorProps) {
  const [monitors, setMonitors] = useState<AddressMonitor[]>([])
  const [newAddress, setNewAddress] = useState("")

  useEffect(() => {
    onMonitorCountChange(monitors.length)
  }, [monitors.length, onMonitorCountChange])

  const fetchAssetCreationStats = useCallback(
    async (assets: Asset[], indexerClient: any): Promise<{ stats: AssetCreationStats; assetsWithTime: Asset[] }> => {
      const now = new Date()
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)

      let weekly = 0
      let monthly = 0
      let yearly = 0
      let total = 0
      const assetsWithTime: Asset[] = []

      for (const asset of assets) {
        try {
          const assetId = typeof asset.index === 'bigint' ? Number(asset.index) : asset.index
          const response = await indexerClient
            .lookupAssetTransactions(assetId)
            .txType("acfg")
            .limit(2)
            .do()
          console.log(response)
          if (response.transactions && response.transactions.length > 0) {
            const tx = response.transactions[0];
            const roundTimeRaw = tx["roundTime"];
            if (typeof roundTimeRaw === 'number' && !isNaN(roundTimeRaw)) {
              const creationTime = new Date(roundTimeRaw * 1000);
              console.log(`Asset ${assetId} created at:`, creationTime);
              
              const assetWithTime = { ...asset, creationTime }
              assetsWithTime.push(assetWithTime)
              total++

              if (creationTime >= oneWeekAgo) weekly++
              if (creationTime >= oneMonthAgo) monthly++
              if (creationTime >= oneYearAgo) yearly++
            } else {
              console.warn(`Asset ${assetId} has invalid or missing round-time. Transaction object:`, tx);
              assetsWithTime.push(asset) // Add without creation time
            }
          } else {
            assetsWithTime.push(asset) // Add without creation time
          }
        } catch (error) {
          console.error(`Failed to fetch creation time for asset ${asset.index}:`, error)
          assetsWithTime.push(asset) // Add without creation time
        }
      }

      return { 
        stats: { weekly, monthly, yearly, total },
        assetsWithTime 
      }
    },
    [],
  )

  const refreshMonitor = useCallback(
    async (monitorId: string, address: string) => {
      setMonitors((prev) =>
        prev.map((m) => (m.id === monitorId ? { ...m, isLoading: true, error: undefined } : m)),
      )

      try {
        const { AlgorandClient } = await import("@algorandfoundation/algokit-utils")
        const algorand =
        network === "mainnet"
          ? AlgorandClient.fromConfig({
              algodConfig: {
                server: "https://mainnet-api.algonode.cloud",
                token: "",
              },
              indexerConfig: {
                server: "https://mainnet-idx.algonode.cloud",
                token: "",
              },
            })
          : AlgorandClient.fromConfig({
              algodConfig: {
                server: "https://testnet-api.algonode.cloud",
                token: "",
              },
              indexerConfig: {
                server: "https://testnet-idx.algonode.cloud",
                token: "",
              },
            })
  

        const indexerClient = algorand.client.indexer
        const response = await indexerClient.lookupAccountCreatedAssets(address).do()
        const assets: Asset[] = (response.assets || []).map((asset: any) => ({
          index: asset.index,
          params: {
            name: asset.params.name || "",
            "unit-name": asset.params["unit-name"] || "",
            total: asset.params.total,
            url: asset.params.url || "",
            creator: asset.params.creator,
            decimals: asset.params.decimals,
          },
        }))

        // Fetch creation statistics
        const { stats: creationStats, assetsWithTime } = await fetchAssetCreationStats(assets, indexerClient)
        
        setMonitors((prev) =>
          prev.map((m) => (m.id === monitorId ? { ...m, assets, creationStats, assetsWithTime, isLoading: false } : m)),
        )
      } catch (error: any) {
        console.error(`Failed to fetch assets for ${address}:`, error)
        setMonitors((prev) =>
          prev.map((m) =>
            m.id === monitorId
              ? { ...m, isLoading: false, error: error.message || "Failed to fetch assets" }
              : m,
          ),
        )
      }
    },
    [network, fetchAssetCreationStats],
  )

  const addMonitor = async () => {
    const address = newAddress.trim()
    if (!address || !algosdk.isValidAddress(address)) return

    setNewAddress("")

    const monitorId = Date.now().toString()
    const newMonitor: AddressMonitor = {
      id: monitorId,
      address: address,
      assets: [],
      isLoading: true,
    }
    setMonitors((prev) => [newMonitor, ...prev])

    await refreshMonitor(monitorId, address)
  }

  const removeMonitor = (id: string) => {
    setMonitors((prev) => prev.filter((m) => m.id !== id))
  }

  const formatAmount = (amount: number, decimals: number) => {
    return (amount / Math.pow(10, decimals)).toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  }

  const AssetList = ({ assets, network }: { assets: Asset[], network: "mainnet" | "testnet" }) => {
    if (assets.length === 0) {
      return (
        <div className="text-center py-8 text-slate-500">
          No assets found in this time period.
        </div>
      )
    }

    return (
      <ScrollArea className="h-80">
        <div className="space-y-4">
          {assets.map((asset) => (
            <div key={asset.index} className="border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-lg">
                    {asset.params.name || "Unnamed Asset"}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {asset.params["unit-name"]}
                  </p>
                  {asset.creationTime && (
                    <p className="text-xs text-slate-400 mt-1">
                      Created: {asset.creationTime.toLocaleDateString()} at {asset.creationTime.toLocaleTimeString()}
                    </p>
                  )}
                </div>
                <Button size="sm" variant="ghost" asChild>
                  <a
                    href={`https://${
                      network === "mainnet" ? "" : "testnet."
                    }algoexplorer.io/asset/${asset.index}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
                <div>
                  <p className="text-slate-600 dark:text-slate-400">Asset ID:</p>
                  <p className="font-mono">{asset.index}</p>
                </div>
                <div>
                  <p className="text-slate-600 dark:text-slate-400">Total Supply:</p>
                  <p>
                    {formatAmount(Number(asset.params.total), asset.params.decimals)}
                  </p>
                </div>
              </div>
              {asset.params.url && (
                <div className="mt-2">
                  <p className="text-slate-600 dark:text-slate-400 text-sm">
                    URL:
                  </p>
                  <a
                    href={asset.params.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-500 hover:underline break-all"
                  >
                    {asset.params.url}
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Monitor Created Assets</CardTitle>
            <Badge variant={network === "mainnet" ? "destructive" : "default"}>
              {network === "mainnet" ? "MainNet" : "TestNet"}
            </Badge>
          </div>
          <CardDescription>
            Enter an Algorand address to see all assets created by it on{" "}
            {network === "mainnet" ? "MainNet" : "TestNet"}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter Algorand address..."
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addMonitor()}
            />
            <Button
              onClick={addMonitor}
              disabled={!newAddress.trim() || !algosdk.isValidAddress(newAddress.trim())}
            >
              Fetch Assets
            </Button>
          </div>
        </CardContent>
      </Card>

      {monitors.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-slate-400 mb-4" />
            <p className="text-slate-600 dark:text-slate-400 text-center">
              No addresses being monitored. Add an address to start.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {monitors.map((monitor) => (
            <Card key={monitor.id} className="overflow-hidden">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg font-mono break-all">
                      {monitor.address}
                    </CardTitle>
                    <CardDescription>
                      {monitor.isLoading
                        ? "Loading assets..."
                        : `Found ${monitor.assets.length} assets.`}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => refreshMonitor(monitor.id, monitor.address)}
                      disabled={monitor.isLoading}
                    >
                      {monitor.isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => removeMonitor(monitor.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {monitor.isLoading && (
                <CardContent>
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                  </div>
                </CardContent>
              )}

              {monitor.error && (
                <CardContent>
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{monitor.error}</AlertDescription>
                  </Alert>
                </CardContent>
              )}

              {!monitor.isLoading && !monitor.error && monitor.assets.length > 0 && (
                <CardContent>
                  <ScrollArea className="h-80">
                    <div className="space-y-4">
                      {monitor.assets.map((asset) => (
                        <div key={asset.index} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-bold text-lg">
                                {asset.params.name || "Unnamed Asset"}
                              </p>
                              <p className="text-sm text-slate-500 dark:text-slate-400">
                                {asset.params["unit-name"]}
                              </p>
                            </div>
                            <Button size="sm" variant="ghost" asChild>
                              <a
                                href={`https://${
                                  network === "mainnet" ? "" : "testnet."
                                }algoexplorer.io/asset/${asset.index}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
                            <div>
                              <p className="text-slate-600 dark:text-slate-400">Asset ID:</p>
                              <p className="font-mono">{asset.index}</p>
                            </div>
                            <div>
                              <p className="text-slate-600 dark:text-slate-400">Total Supply:</p>
                              <p>
                                {formatAmount(Number(asset.params.total), asset.params.decimals)}
                              </p>
                            </div>
                          </div>
                          {asset.params.url && (
                            <div className="mt-2">
                              <p className="text-slate-600 dark:text-slate-400 text-sm">
                                URL:
                              </p>
                              <a
                                href={asset.params.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-500 hover:underline break-all"
                              >
                                {asset.params.url}
                              </a>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              )}

              {!monitor.isLoading && !monitor.error && monitor.assets.length === 0 && (
                <CardContent>
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>No assets created by this address.</AlertDescription>
                  </Alert>
                </CardContent>
              )}

              {!monitor.isLoading && !monitor.error && monitor.creationStats && monitor.assetsWithTime && (
                <CardContent>
                  <div className="border-t pt-4">
                    <h3 className="text-lg font-semibold mb-4">Asset Creation Timeline</h3>
                    <Tabs defaultValue="week" className="w-full">
                      <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="week">Week ({monitor.creationStats.weekly})</TabsTrigger>
                        <TabsTrigger value="month">Month ({monitor.creationStats.monthly})</TabsTrigger>
                        <TabsTrigger value="year">Year ({monitor.creationStats.yearly})</TabsTrigger>
                        <TabsTrigger value="all">All ({monitor.creationStats.total})</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="week" className="mt-4">
                        <AssetList 
                          assets={monitor.assetsWithTime.filter(asset => {
                            if (!asset.creationTime) return false
                            const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                            return asset.creationTime >= oneWeekAgo
                          })}
                          network={network}
                        />
                      </TabsContent>
                      
                      <TabsContent value="month" className="mt-4">
                        <AssetList 
                          assets={monitor.assetsWithTime.filter(asset => {
                            if (!asset.creationTime) return false
                            const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                            return asset.creationTime >= oneMonthAgo
                          })}
                          network={network}
                        />
                      </TabsContent>
                      
                      <TabsContent value="year" className="mt-4">
                        <AssetList 
                          assets={monitor.assetsWithTime.filter(asset => {
                            if (!asset.creationTime) return false
                            const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
                            return asset.creationTime >= oneYearAgo
                          })}
                          network={network}
                        />
                      </TabsContent>
                      
                      <TabsContent value="all" className="mt-4">
                        <AssetList 
                          assets={monitor.assetsWithTime}
                          network={network}
                        />
                      </TabsContent>
                    </Tabs>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

