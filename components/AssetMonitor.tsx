
"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AlertCircle, Trash2, ExternalLink, RefreshCw, Loader2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import algosdk from "algosdk"

interface AssetMonitorProps {
  network: "mainnet" | "testnet"
  onMonitorCountChange: (count: number) => void
}

interface Asset {
  index: number
  params: {
    name: string
    "unit-name": string
    total: number
    url: string
    creator: string
    decimals: number
  }
}

interface AddressMonitor {
  id: string
  address: string
  assets: Asset[]
  isLoading: boolean
  error?: string
}

export default function AssetMonitor({ network, onMonitorCountChange }: AssetMonitorProps) {
  const [monitors, setMonitors] = useState<AddressMonitor[]>([])
  const [newAddress, setNewAddress] = useState("")

  useEffect(() => {
    onMonitorCountChange(monitors.length)
  }, [monitors.length, onMonitorCountChange])

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
        const assets = response["created-assets"] || response.assets || []

        setMonitors((prev) =>
          prev.map((m) => (m.id === monitorId ? { ...m, assets, isLoading: false } : m)),
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
    [network],
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
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

