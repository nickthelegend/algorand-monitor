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
import { AlgorandClient } from "@algorandfoundation/algokit-utils"

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
  startTime?: Date
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
  const intervalIdsRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  useEffect(() => {
    const activeCount = monitors.filter((m) => m.isActive).length
    onMonitorCountChange(activeCount)
  }, [monitors, onMonitorCountChange])

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

  const startWalletMonitoring = async (monitor: WalletMonitorConfig) => {
    const monitorStartTime = new Date()

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

    const fetchTransactions = async () => {
      try {
        const response = await algorand.client.indexer
          .lookupAccountTransactions(monitor.address)
          .afterTime(monitorStartTime.toISOString())
          .do()

        const newTransactions: Transaction[] = response.transactions.map((tx: any) => {
          console.log("Parsing transaction:", tx)
          const txDetails = tx["paymentTransaction"] || tx["assetTransferTransaction"] || {}
          return {
            id: tx.id,
            type:
              tx["txType"] === "pay"
                ? "Payment"
                : tx["txType"] === "axfer"
                ? "Asset Transfer"
                : tx["txType"],
            amount: txDetails.amount || 0n,
            sender: tx.sender,
            receiver: txDetails.receiver || "",
            timestamp: tx["roundTime"] ? new Date(tx["roundTime"] * 1000) : new Date(0),
            fee: tx.fee || 0n,
            assetId: tx["assetTransferTransaction"]?.["assetId"],
          }
        })

        if (newTransactions.length > 0) {
          setMonitors((prev) =>
            prev.map((m) => {
              if (m.id === monitor.id) {
                const existingTxIds = new Set(m.transactions.map((t) => t.id))
                const uniqueNewTransactions = newTransactions.filter((t) => !existingTxIds.has(t.id))

                if (uniqueNewTransactions.length === 0) return m

                return {
                  ...m,
                  transactions: [...uniqueNewTransactions, ...m.transactions].slice(0, 50),
                }
              }
              return m
            }),
          )
        }
      } catch (error) {
        console.error(`Failed to fetch transactions for ${monitor.name}:`, error)
      }
    }

    fetchTransactions()
    const intervalId = setInterval(fetchTransactions, 6000) // 2 minutes
    intervalIdsRef.current.set(monitor.id, intervalId)

    setMonitors((prev) =>
      prev.map((m) => (m.id === monitor.id ? { ...m, isActive: true, startTime: monitorStartTime } : m)),
    )

    console.log(`Started monitoring wallet ${monitor.name} (${monitor.address}) on ${network}`)
  }

  const stopWalletMonitoring = (monitor: WalletMonitorConfig) => {
    const intervalId = intervalIdsRef.current.get(monitor.id)
    if (intervalId) {
      clearInterval(intervalId)
      intervalIdsRef.current.delete(monitor.id)
    }
    setMonitors((prev) => prev.map((m) => (m.id === monitor.id ? { ...m, isActive: false } : m)))
    console.log(`Stopped monitoring ${monitor.name}`)
  }

  const toggleMonitor = async (id: string) => {
    const monitor = monitors.find((m) => m.id === id)
    if (!monitor) return

    if (monitor.isActive) {
      stopWalletMonitoring(monitor)
    } else {
      startWalletMonitoring(monitor)
    }
  }

  const removeMonitor = useCallback((id: string) => {
    const intervalId = intervalIdsRef.current.get(id)
    if (intervalId) {
      clearInterval(intervalId)
      intervalIdsRef.current.delete(id)
    }
    setMonitors((prev) => prev.filter((m) => m.id !== id))
  }, [])

  const formatAddress = (address: string) => {
    if (!address) return "N/A"
    return `${address.slice(0, 6)}...${address.slice(-6)}`
  }

  const formatAmount = (amount: bigint, assetId?: bigint) => {
    // This is a simplification. In a real app, you'd want to fetch asset decimals.
    const decimals = 6 // Assuming 6 decimals for both ALGO and assets for simplicity
    const divisor = 10 ** decimals
    const formattedAmount = parseFloat((Number(amount) / divisor).toFixed(decimals)).toString()

    if (assetId) {
      return `${formattedAmount} (Asset ID: ${assetId})`
    }
    return `${formattedAmount} ALGO`
  }

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      intervalIdsRef.current.forEach((intervalId) => {
        clearInterval(intervalId)
      })
    }
  }, [])

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
                          {monitor.transactions
                            .slice()
                            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
                            .map((tx) => (
                              <div key={tx.id} className="border rounded-lg p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <Badge variant="outline">{tx.type}</Badge>
                                  <span className="text-sm text-slate-500">{tx.timestamp.toUTCString()}</span>
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
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-semibold">{formatAmount(tx.amount, tx.assetId)}</span>
                                  <div className="flex gap-2">
                                    <Button size="sm" variant="ghost" asChild>
                                      <a
                                        href={`https://${network === "mainnet" ? "" : "testnet."}algoexplorer.io/tx/${tx.id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                      </a>
                                    </Button>
                                    <Button size="sm" variant="ghost" asChild>
                                      <a
                                        href={`https://lora.algokit.io/testnet/transaction/${tx.id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        Lora
                                      </a>
                                    </Button>
                                  </div>
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
