"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AlertCircle, Play, Square, Trash2, ExternalLink } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface WalletMonitorProps {
  network: "mainnet" | "testnet"
  onMonitorCountChange: (count: number) => void
}

interface WalletMonitorConfig {
  id: string
  address: string
  name: string
  isActive: boolean
  transactions: Transaction[]
  subscriber?: any
}

interface Transaction {
  id: string
  type: string
  amount: bigint
  sender: string
  receiver: string
  timestamp: Date
  fee: bigint
  assetId?: bigint
}

export default function WalletMonitor({ network, onMonitorCountChange }: WalletMonitorProps) {
  const [monitors, setMonitors] = useState<WalletMonitorConfig[]>([])
  const [newAddress, setNewAddress] = useState("")
  const [newName, setNewName] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const watermarksRef = useRef<Map<string, bigint>>(new Map())

  useEffect(() => {
    const activeCount = monitors.filter((m) => m.isActive).length
    onMonitorCountChange(activeCount)
  }, [monitors.length, monitors.map((m) => m.isActive).join(","), onMonitorCountChange])

  const addMonitor = async () => {
    if (!newAddress.trim() || !newName.trim()) return

    setIsLoading(true)

    const newMonitor: WalletMonitorConfig = {
      id: Date.now().toString(),
      address: newAddress.trim(),
      name: newName.trim(),
      isActive: false,
      transactions: [],
    }

    setMonitors((prev) => [...prev, newMonitor])
    setNewAddress("")
    setNewName("")
    setIsLoading(false)
  }

  const toggleMonitor = async (id: string) => {
    setMonitors((prev) =>
      prev.map((monitor) => {
        if (monitor.id === id) {
          const updatedMonitor = { ...monitor, isActive: !monitor.isActive }

          if (updatedMonitor.isActive) {
            startWalletMonitoring(updatedMonitor)
          } else {
            stopWalletMonitoring(updatedMonitor)
          }

          return updatedMonitor
        }
        return monitor
      }),
    )
  }

  const startWalletMonitoring = useCallback(
    async (monitor: WalletMonitorConfig) => {
      try {
        const { AlgorandClient } = await import("@algorandfoundation/algokit-utils")
        const { AlgorandSubscriber } = await import("@algorandfoundation/algokit-subscriber")

        const algorand =
          network === "mainnet"
            ? AlgorandClient.fromClients({
                algod: {
                  server: "https://mainnet-api.algonode.cloud",
                  token: "",
                },
                indexer: {
                  server: "https://mainnet-idx.algonode.cloud",
                  token: "",
                },
              })
            : AlgorandClient.fromClients({
                algod: {
                  server: "https://testnet-api.algonode.cloud",
                  token: "",
                },
                indexer: {
                  server: "https://testnet-idx.algonode.cloud",
                  token: "",
                },
              })

        const subscriber = new AlgorandSubscriber(
          {
            events: [
              {
                eventName: "wallet-sent",
                filter: {
                  sender: monitor.address,
                },
              },
              {
                eventName: "wallet-received",
                filter: {
                  receiver: monitor.address,
                },
              },
            ],
            frequencyInSeconds: network === "mainnet" ? 10 : 5,
            maxRoundsToSync: 100,
            syncBehaviour: "catchup-with-indexer",
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

        const handleTransaction = (transaction: any, direction: "sent" | "received") => {
          console.log(`Wallet ${direction}:`, transaction)

          const newTransaction: Transaction = {
            id: transaction.id,
            type:
              transaction.type === "pay"
                ? "Payment"
                : transaction.type === "axfer"
                  ? "Asset Transfer"
                  : transaction.type,
            amount: transaction.paymentTransaction?.amount || transaction.assetTransferTransaction?.amount || 0n,
            sender: transaction.sender,
            receiver: transaction.paymentTransaction?.receiver || transaction.assetTransferTransaction?.receiver || "",
            timestamp: new Date(),
            fee: transaction.fee || 0n,
            assetId: transaction.assetTransferTransaction?.assetId,
          }

          setMonitors((prev) =>
            prev.map((m) =>
              m.id === monitor.id ? { ...m, transactions: [newTransaction, ...m.transactions.slice(0, 49)] } : m,
            ),
          )
        }

        subscriber.onBatch("wallet-sent", async (events) => {
          events.forEach((event) => handleTransaction(event, "sent"))
        })

        subscriber.onBatch("wallet-received", async (events) => {
          events.forEach((event) => handleTransaction(event, "received"))
        })

        subscriber.onError((e: any) => {
          console.error(`Wallet monitor error for ${monitor.name}:`, e)
        })

        await subscriber.start()

        setMonitors((prev) => prev.map((m) => (m.id === monitor.id ? { ...m, subscriber } : m)))

        console.log(`Started monitoring wallet ${monitor.name} (${monitor.address}) on ${network}`)
      } catch (error) {
        console.error("Failed to start wallet monitoring:", error)
      }
    },
    [network],
  )

  const stopWalletMonitoring = useCallback((monitor: WalletMonitorConfig) => {
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

  const formatAmount = (amount: bigint, assetId?: bigint) => {
    if (assetId) {
      return (Number(amount) / 1_000_000).toFixed(6) // Assume 6 decimals for assets
    }
    return (Number(amount) / 1_000_000).toFixed(6) + " ALGO"
  }

  useEffect(() => {
    return () => {
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
            <CardTitle>Add Wallet Monitor</CardTitle>
            <Badge variant={network === "mainnet" ? "destructive" : "default"}>
              {network === "mainnet" ? "MainNet" : "TestNet"}
            </Badge>
          </div>
          <CardDescription>
            Monitor real transactions for specific Algorand wallet addresses on{" "}
            {network === "mainnet" ? "MainNet" : "TestNet"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="wallet-name">Monitor Name</Label>
              <Input
                id="wallet-name"
                placeholder="e.g., Custodian Wallet"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wallet-address">Wallet Address</Label>
              <Input
                id="wallet-address"
                placeholder="Enter Algorand address..."
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={addMonitor} disabled={!newAddress.trim() || !newName.trim() || isLoading} className="w-full">
            Add Wallet Monitor
          </Button>
        </CardContent>
      </Card>

      {monitors.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-slate-400 mb-4" />
            <p className="text-slate-600 dark:text-slate-400 text-center">
              No wallet monitors configured. Add your first monitor above.
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
                    <CardDescription className="font-mono">{formatAddress(monitor.address)}</CardDescription>
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
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">Recent Transactions</h4>
                      <Badge variant="outline">{monitor.transactions.length} transactions</Badge>
                    </div>

                    {monitor.transactions.length === 0 ? (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>Monitoring active. Waiting for transactions...</AlertDescription>
                      </Alert>
                    ) : (
                      <ScrollArea className="h-64">
                        <div className="space-y-3">
                          {monitor.transactions.map((tx) => (
                            <div key={tx.id} className="border rounded-lg p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <Badge variant="outline">{tx.type}</Badge>
                                <span className="text-sm text-slate-500">{tx.timestamp.toLocaleTimeString()}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <p className="text-slate-600 dark:text-slate-400">From:</p>
                                  <p className="font-mono">{formatAddress(tx.sender)}</p>
                                </div>
                                <div>
                                  <p className="text-slate-600 dark:text-slate-400">To:</p>
                                  <p className="font-mono">{formatAddress(tx.receiver)}</p>
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="font-semibold">{formatAmount(tx.amount, tx.assetId)}</span>
                                <Button size="sm" variant="ghost" asChild>
                                  <a
                                    href={`https://${network === "mainnet" ? "" : "testnet."}algoexplorer.io/tx/${tx.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </Button>
                              </div>
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
