"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AlertCircle, Play, Square, Trash2, ExternalLink, TrendingUp } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import algosdk from "algosdk"

interface AssetMonitorProps {
  network: "mainnet" | "testnet"
  onMonitorCountChange: (count: number) => void
}

interface AssetMonitorConfig {
  id: string
  assetId: string
  name: string
  minAmount: number
  isActive: boolean
  transfers: AssetTransfer[]
  totalVolume: number
  subscriber?: any
}

interface AssetTransfer {
  id: string
  sender: string
  receiver: string
  amount: bigint
  timestamp: Date
  txnId: string
  note?: string
  assetId: bigint
}

const POPULAR_ASSETS = {
  mainnet: [
    { id: "31566704", name: "USDC", decimals: 6 },
    { id: "312769", name: "Tether USDt", decimals: 6 },
    { id: "465865291", name: "STBL", decimals: 6 },
    { id: "287867876", name: "USDt", decimals: 6 },
  ],
  testnet: [
    { id: "10458941", name: "TestNet USDC", decimals: 6 },
    { id: "21582668", name: "TestNet Token", decimals: 6 },
    { id: "16026728", name: "Test Asset", decimals: 6 },
  ],
}

export default function AssetMonitor({ network, onMonitorCountChange }: AssetMonitorProps) {
  const [monitors, setMonitors] = useState<AssetMonitorConfig[]>([])
  const [newAssetId, setNewAssetId] = useState("")
  const [newName, setNewName] = useState("")
  const [minAmount, setMinAmount] = useState("1")
  const [isLoading, setIsLoading] = useState(false)

  const watermarksRef = useRef<Map<string, bigint>>(new Map())

  useEffect(() => {
    const activeCount = monitors.filter((m) => m.isActive).length
    onMonitorCountChange(activeCount)
  }, [monitors.length, monitors.map((m) => m.isActive).join(","), onMonitorCountChange])

  const addMonitor = async () => {
    if (!newAssetId.trim() || !newName.trim()) return

    setIsLoading(true)

    const newMonitor: AssetMonitorConfig = {
      id: Date.now().toString(),
      assetId: newAssetId.trim(),
      name: newName.trim(),
      minAmount: Number.parseFloat(minAmount) || 1,
      isActive: false,
      transfers: [],
      totalVolume: 0,
    }

    setMonitors((prev) => [...prev, newMonitor])
    setNewAssetId("")
    setNewName("")
    setMinAmount("1")
    setIsLoading(false)
  }

  const selectPopularAsset = (asset: any) => {
    setNewAssetId(asset.id)
    setNewName(asset.name)
  }

  const toggleMonitor = async (id: string) => {
    setMonitors((prev) =>
      prev.map((monitor) => {
        if (monitor.id === id) {
          const updatedMonitor = { ...monitor, isActive: !monitor.isActive }

          if (updatedMonitor.isActive) {
            startAssetMonitoring(updatedMonitor)
          } else {
            stopAssetMonitoring(updatedMonitor)
          }

          return updatedMonitor
        }
        return monitor
      }),
    )
  }

  const startAssetMonitoring = useCallback(
    async (monitor: AssetMonitorConfig) => {
      try {
        // Dynamic import to avoid SSR issues
        const { AlgorandClient } = await import("@algorandfoundation/algokit-utils")
        const { AlgorandSubscriber, } = await import("@algorandfoundation/algokit-subscriber")

        // Initialize Algorand client based on network
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

        const subscriber = new AlgorandSubscriber(
          {
            filters: [
              {
                name: `asset-${monitor.assetId}`,
                filter: {
                  type: "axfer",
                  assetId: BigInt(monitor.assetId),
                  minAmount: BigInt(monitor.minAmount * 1_000_000), // Convert to microunits
                },
              },
            ],
            waitForBlockWhenAtTip: true,
            syncBehaviour: "skip-sync-newest",
            watermarkPersistence: {
              get: async () => watermarksRef.current.get(monitor.id) || 0n,
              set: async (newWatermark) => {
                watermarksRef.current.set(monitor.id, newWatermark)
              },
            },
          },
          algorand.client.algod,
          algorand.client.indexer,
        )

        subscriber.on(`asset-${monitor.assetId}`, (transfer: any) => {
          console.log("Asset transfer received:", transfer);
          const newTransfer: AssetTransfer = {
            id: transfer.id,
            sender: transfer.sender,
            receiver: transfer.assetTransferTransaction?.receiver || "",
            amount: transfer.assetTransferTransaction?.amount || 0n,
            timestamp: transfer.roundTime ? new Date(transfer.roundTime * 1000) : new Date(),
            txnId: transfer.id,
            assetId: BigInt(monitor.assetId),
            note: transfer.note ? new TextDecoder().decode(transfer.note) : undefined,
          };
          setMonitors((prev) =>
            prev.map((m) =>
              m.id === monitor.id
                ? {
                    ...m,
                    transfers: [newTransfer, ...m.transfers.slice(0, 49)],
                    totalVolume: m.totalVolume + Number(newTransfer.amount) / 1_000_000,
                  }
                : m,
            ),
          );
        })

        subscriber.onError((e: any) => {
          console.error(`Asset monitor error for ${monitor.name}:`, e)
        })

        await subscriber.start()

        // Update monitor with subscriber reference
        setMonitors((prev) => prev.map((m) => (m.id === monitor.id ? { ...m, subscriber } : m)))

        console.log(`Started monitoring ${monitor.name} (${monitor.assetId}) on ${network}`)
      } catch (error) {
        console.error("Failed to start asset monitoring:", error)
      }
    },
    [network],
  )

  const stopAssetMonitoring = useCallback((monitor: AssetMonitorConfig) => {
    if (monitor.subscriber) {
      monitor.subscriber.stop()
      console.log(`Stopped monitoring ${monitor.name}`)
    }
  }, [])

  const removeMonitor = useCallback(
    (id: string) => {
      const monitor = monitors.find((m) => m.id === id)
      if (monitor?.subscriber) {
        monitor.subscriber.stop()
      }
      watermarksRef.current.delete(id)
      setMonitors((prev) => prev.filter((m) => m.id !== id))
    },
    [monitors],
  )

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-6)}`
  }

  const formatAmount = (amount: bigint, decimals = 6) => {
    return (Number(amount) / Math.pow(10, decimals)).toFixed(decimals)
  }

  useEffect(() => {
    return () => {
      // Cleanup all subscribers on unmount
      monitors.forEach((monitor) => {
        if (monitor.subscriber) {
          monitor.subscriber.stop()
        }
      })
      watermarksRef.current.clear()
    }
  }, [monitors])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Add Asset Monitor</CardTitle>
            <Badge variant={network === "mainnet" ? "destructive" : "default"}>
              {network === "mainnet" ? "MainNet" : "TestNet"}
            </Badge>
          </div>
          <CardDescription>
            Monitor real asset transfers with minimum amount thresholds on{" "}
            {network === "mainnet" ? "MainNet" : "TestNet"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Popular {network === "mainnet" ? "MainNet" : "TestNet"} Assets</Label>
            <div className="flex flex-wrap gap-2">
              {POPULAR_ASSETS[network].map((asset) => (
                <Button key={asset.id} variant="outline" size="sm" onClick={() => selectPopularAsset(asset)}>
                  {asset.name}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="asset-name">Asset Name</Label>
              <Input
                id="asset-name"
                placeholder="e.g., USDC"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="asset-id">Asset ID</Label>
              <Input
                id="asset-id"
                placeholder="Enter Asset ID..."
                value={newAssetId}
                onChange={(e) => setNewAssetId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="min-amount">Min Amount</Label>
              <Input
                id="min-amount"
                type="number"
                placeholder="1.0"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
              />
            </div>
          </div>

          <Button onClick={addMonitor} disabled={!newAssetId.trim() || !newName.trim() || isLoading} className="w-full">
            Add Asset Monitor
          </Button>
        </CardContent>
      </Card>

      {monitors.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-slate-400 mb-4" />
            <p className="text-slate-600 dark:text-slate-400 text-center">
              No asset monitors configured. Add your first monitor above.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {monitors.map((monitor) => (
            <Card key={monitor.id} className="overflow-hidden">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {monitor.name}
                      <Badge variant={monitor.isActive ? "default" : "secondary"}>
                        {monitor.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {network === "mainnet" ? "MainNet" : "TestNet"}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      Asset ID: {monitor.assetId} • Min Amount: {monitor.minAmount}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={monitor.isActive ? "destructive" : "default"}
                      onClick={() => toggleMonitor(monitor.id)}
                    >
                      {monitor.isActive ? (
                        <>
                          <Square className="h-4 w-4 mr-1" />
                          Stop
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-1" />
                          Start
                        </>
                      )}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => removeMonitor(monitor.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {monitor.isActive && (
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <Card>
                        <CardContent className="flex items-center gap-3 p-4">
                          <TrendingUp className="h-5 w-5 text-green-600" />
                          <div>
                            <p className="text-sm text-slate-600 dark:text-slate-400">Total Volume</p>
                            <p className="text-lg font-bold">
                              {monitor.totalVolume.toFixed(2)} {monitor.name}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="flex items-center gap-3 p-4">
                          <ExternalLink className="h-5 w-5 text-blue-600" />
                          <div>
                            <p className="text-sm text-slate-600 dark:text-slate-400">Transfers</p>
                            <p className="text-lg font-bold">{monitor.transfers.length}</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">Recent Transfers</h4>
                      <Badge variant="outline">{monitor.transfers.length} transfers</Badge>
                    </div>

                    {monitor.transfers.length === 0 ? (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>Monitoring active. Waiting for asset transfers...</AlertDescription>
                      </Alert>
                    ) : (
                      <ScrollArea className="h-64">
                        <div className="space-y-3">
                          {monitor.transfers
                            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
                            .map((transfer) => (
                              <div key={transfer.id} className="border rounded-lg p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <Badge variant="default">Transfer</Badge>
                                  <span className="text-sm text-slate-500">{transfer.timestamp.toLocaleTimeString()}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <p className="text-slate-600 dark:text-slate-400">From:</p>
                                    <p className="font-mono">{formatAddress(transfer.sender)}</p>
                                  </div>
                                  <div>
                                    <p className="text-slate-600 dark:text-slate-400">To:</p>
                                    <p className="font-mono">{formatAddress(transfer.receiver)}</p>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-lg">
                                    {formatAmount(transfer.amount)} {monitor.name}
                                  </span>
                                  <Button size="sm" variant="ghost" asChild>
                                    <a
                                      href={`https://${network === "mainnet" ? "" : "testnet."}algoexplorer.io/tx/${transfer.txnId}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  </Button>
                                </div>
                                {transfer.note && (
                                  <p className="text-sm text-slate-600 dark:text-slate-400 italic">
                                    Note: {transfer.note}
                                  </p>
                                )}
                              </div>
                            ))}
                        </div>
                      </ScrollArea>
                    )}
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
