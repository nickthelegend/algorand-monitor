"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AlertCircle, Play, Square, Trash2, ExternalLink } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface ContractMonitorProps {
  network: "mainnet" | "testnet"
  onMonitorCountChange: (count: number) => void
}

interface ContractMonitorConfig {
  id: string
  appId: string
  name: string
  methodSignatures: string[]
  isActive: boolean
  events: ContractEvent[]
  transactions: Transaction[]
  frequencyInSeconds: number
  subscriber?: any
  startTime?: Date
}

interface ContractEvent {
  id: string
  eventName: string
  methodSignature: string
  sender: string
  timestamp: Date
  args: any[]
  txnId: string
  appArgs?: Uint8Array[]
}

interface Transaction {
  id: string
  type: string
  sender: string
  timestamp: Date
  fee: bigint
}

export default function ContractMonitor({ network, onMonitorCountChange }: ContractMonitorProps) {
  const [monitors, setMonitors] = useState<ContractMonitorConfig[]>([])
  const [newAppId, setNewAppId] = useState("")
  const [newName, setNewName] = useState("")
  const [frequency, setFrequency] = useState("5")
  const [isLoading, setIsLoading] = useState(false)

  const watermarksRef = useRef<Map<string, bigint>>(new Map())

  useEffect(() => {
    const activeCount = monitors.filter((m) => m.isActive).length
    onMonitorCountChange(activeCount)
  }, [monitors.length, monitors.map((m) => m.isActive).join(","), onMonitorCountChange])

  const addMonitor = async () => {
    if (!newAppId.trim() || !newName.trim()) return

    setIsLoading(true)

    const newMonitor: ContractMonitorConfig = {
      id: Date.now().toString(),
      appId: newAppId.trim(),
      name: newName.trim(),
      methodSignatures: [],
      isActive: false,
      events: [],
      transactions: [],
      frequencyInSeconds: Number.parseInt(frequency),
    }

    setMonitors((prev) => [...prev, newMonitor])
    setNewAppId("")
    setNewName("")
    setIsLoading(false)
  }

  const toggleMonitor = async (id: string) => {
    setMonitors((prev) =>
      prev.map((monitor) => {
        if (monitor.id === id) {
          const updatedMonitor = { ...monitor, isActive: !monitor.isActive }

          if (updatedMonitor.isActive) {
            startContractMonitoring(updatedMonitor)
          } else {
            stopContractMonitoring(updatedMonitor)
          }

          return updatedMonitor
        }
        return monitor
      }),
    )
  }

  const startContractMonitoring = useCallback(
    async (monitor: ContractMonitorConfig) => {
      const monitorStartTime = new Date()
      try {
        const { AlgorandClient } = await import("@algorandfoundation/algokit-utils")
        const { AlgorandSubscriber } = await import("@algorandfoundation/algokit-subscriber")
        const algosdk = await import("algosdk")
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
              .searchForTransactions()
              .applicationID(Number(monitor.appId))
              .afterTime(monitorStartTime.toISOString())
              .do()

            const newTransactions: Transaction[] = response.transactions.map((tx: any) => {
              console.log("Parsing contract transaction:", tx)
              return {
                id: tx.id,
                type: tx["txType"],
                sender: tx.sender,
                timestamp: new Date(tx["roundTime"] * 1000),
                fee: tx.fee || 0n,
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
                      transactions: [...uniqueNewTransactions, ...m.transactions].slice(0, 100),
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
        const intervalId = setInterval(fetchTransactions, monitor.frequencyInSeconds * 1000)

        setMonitors((prev) =>
          prev.map((m) =>
            m.id === monitor.id
              ? { ...m, isActive: true, startTime: monitorStartTime, subscriber: intervalId }
              : m,
          ),
        )

        console.log(`Started monitoring contract ${monitor.name} (${monitor.appId}) on ${network}`)
      } catch (error) {
        console.error("Failed to start contract monitoring:", error)
      }
    },
    [network],
  )

  const stopContractMonitoring = useCallback((monitor: ContractMonitorConfig) => {
    if (monitor.subscriber) {
      clearInterval(monitor.subscriber)
      console.log(`Stopped monitoring ${monitor.name}`)
    }
  }, [])

  const removeMonitor = useCallback(
    (id: string) => {
      const monitor = monitors.find((m) => m.id === id)
      if (monitor?.subscriber) {
        clearInterval(monitor.subscriber)
      }
      watermarksRef.current.delete(id)
      setMonitors((prev) => prev.filter((m) => m.id !== id))
    },
    [monitors],
  )

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-6)}`
  }

  const formatArgs = (args: Uint8Array[]) => {
    return args.map((arg) => {
      try {
        return new TextDecoder().decode(arg)
      } catch {
        return `0x${Array.from(arg)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")}`
      }
    })
  }

  useEffect(() => {
    return () => {
      monitors.forEach((monitor) => {
        if (monitor.subscriber) {
          clearInterval(monitor.subscriber)
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
            <CardTitle>Add Contract Monitor</CardTitle>
            <Badge variant={network === "mainnet" ? "destructive" : "default"}>
              {network === "mainnet" ? "MainNet" : "TestNet"}
            </Badge>
          </div>
          <CardDescription>
            Monitor real smart contract interactions and method calls on {network === "mainnet" ? "MainNet" : "TestNet"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contract-name">Monitor Name</Label>
              <Input
                id="contract-name"
                placeholder="e.g., DeFi Protocol Monitor"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="app-id">Application ID</Label>
              <Input
                id="app-id"
                placeholder="Enter App ID..."
                value={newAppId}
                onChange={(e) => setNewAppId(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="frequency">Polling Frequency</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 second</SelectItem>
                <SelectItem value="5">5 seconds</SelectItem>
                <SelectItem value="10">10 seconds</SelectItem>
                <SelectItem value="30">30 seconds</SelectItem>
                <SelectItem value="60">1 minute</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={addMonitor}
            disabled={!newAppId.trim() || !newName.trim() || isLoading}
            className="w-full"
          >
            Add Contract Monitor
          </Button>
        </CardContent>
      </Card>

      {monitors.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-slate-400 mb-4" />
            <p className="text-slate-600 dark:text-slate-400 text-center">
              No contract monitors configured. Add your first monitor above.
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
                      App ID: {monitor.appId} • {monitor.methodSignatures.length} methods • Poll every{" "}
                      {monitor.frequencyInSeconds}s
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

              <CardContent>
                <div className="space-y-4">
                  {monitor.isActive && (
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
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <Button size="sm" variant="ghost" asChild>
                                      <a
                                        href={`https://lora.algokit.io/${network === "mainnet" ? "mainnet" : "testnet"}/transaction/${tx.id}`}
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
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
