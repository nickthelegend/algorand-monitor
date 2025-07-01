// Updated script with network configuration
import { AlgorandClient } from "@algorandfoundation/algokit-utils"
import { AlgorandSubscriber, TransactionType } from "@algorandfoundation/algokit-subscriber"

// Network Configuration
const NETWORK_CONFIG = {
  mainnet: {
    algodServer: "https://mainnet-api.algonode.cloud",
    algodToken: "",
    indexerServer: "https://mainnet-idx.algonode.cloud",
    indexerToken: "",
  },
  testnet: {
    algodServer: "https://testnet-api.algonode.cloud",
    algodToken: "",
    indexerServer: "https://testnet-idx.algonode.cloud",
    indexerToken: "",
  },
}

// Initialize Algorand client for specific network
export function getAlgorandClient(network = "testnet") {
  const config = NETWORK_CONFIG[network]

  return AlgorandClient.fromClients({
    algod: {
      server: config.algodServer,
      token: config.algodToken,
    },
    indexer: {
      server: config.indexerServer,
      token: config.indexerToken,
    },
  })
}

// Example: Network-aware Wallet Monitor Setup
export function setupWalletMonitor(walletAddress, network, onTransaction) {
  const algorand = getAlgorandClient(network)
  let watermark = 0n

  console.log(`Setting up wallet monitor for ${walletAddress} on ${network.toUpperCase()}`)

  const subscriber = new AlgorandSubscriber(
    {
      events: [
        {
          eventName: "wallet-activity",
          filter: {
            sender: walletAddress,
          },
        },
        {
          eventName: "wallet-received",
          filter: {
            receiver: walletAddress,
          },
        },
      ],
      frequencyInSeconds: network === "mainnet" ? 10 : 5, // Slower polling on mainnet
      maxRoundsToSync: network === "mainnet" ? 50 : 100,
      syncBehaviour: "catchup-with-indexer",
      watermarkPersistence: {
        get: async () => watermark,
        set: async (newWatermark) => {
          watermark = newWatermark
        },
      },
    },
    algorand.client.algod,
    algorand.client.indexer,
  )

  subscriber.onBatch("wallet-activity", async (events) => {
    events.forEach((event) => onTransaction(event, network))
  })

  subscriber.onBatch("wallet-received", async (events) => {
    events.forEach((event) => onTransaction(event, network))
  })

  subscriber.onError((e) => {
    console.error(`Wallet monitor error on ${network}:`, e)
  })

  return subscriber
}

// Example: Network-aware Contract Monitor Setup
export function setupContractMonitor(appId, methodSignatures, network, onEvent) {
  const algorand = getAlgorandClient(network)
  let watermark = 0n

  console.log(`Setting up contract monitor for App ID ${appId} on ${network.toUpperCase()}`)

  const filters = methodSignatures.map((signature, index) => ({
    name: `method-${index}`,
    filter: {
      type: TransactionType.appl,
      appId: BigInt(appId),
      methodSignature: signature,
    },
  }))

  filters.push({
    name: "app-call-fallback",
    filter: {
      type: TransactionType.appl,
      appId: BigInt(appId),
    },
  })

  const subscriber = new AlgorandSubscriber(
    {
      filters,
      frequencyInSeconds: network === "mainnet" ? 10 : 5,
      maxRoundsToSync: network === "mainnet" ? 20 : 50,
      syncBehaviour: "catchup-with-indexer",
      watermarkPersistence: {
        get: async () => watermark,
        set: async (newWatermark) => {
          watermark = newWatermark
        },
      },
    },
    algorand.client.algod,
    algorand.client.indexer,
  )

  methodSignatures.forEach((signature, index) => {
    subscriber.onBatch(`method-${index}`, async (events) => {
      events.forEach((event) => onEvent(event, signature, network))
    })
  })

  subscriber.onBatch("app-call-fallback", async (events) => {
    events.forEach((event) => onEvent(event, "fallback", network))
  })

  subscriber.onError((e) => {
    console.error(`Contract monitor error on ${network}:`, e)
  })

  return subscriber
}

// Example: Network-aware Asset Monitor Setup
export function setupAssetMonitor(assetId, minAmount, network, onTransfer) {
  const algorand = getAlgorandClient(network)
  let watermark = 0n

  console.log(`Setting up asset monitor for Asset ID ${assetId} on ${network.toUpperCase()}`)

  const subscriber = new AlgorandSubscriber(
    {
      events: [
        {
          eventName: "asset-transfer",
          filter: {
            type: TransactionType.axfer,
            assetId: BigInt(assetId),
            minAmount: BigInt(minAmount * 1000000),
          },
        },
      ],
      waitForBlockWhenAtTip: true,
      syncBehaviour: "skip-sync-newest",
      watermarkPersistence: {
        get: async () => watermark,
        set: async (newWatermark) => {
          watermark = newWatermark
        },
      },
    },
    algorand.client.algod,
  )

  subscriber.on("asset-transfer", (transfer) => {
    onTransfer(transfer, network)
  })

  subscriber.onError((e) => {
    console.error(`Asset monitor error on ${network}:`, e)
  })

  return subscriber
}

// Usage examples with network selection:
/*
// TestNet monitoring
const testnetWalletSubscriber = setupWalletMonitor(
  'YOUR_TESTNET_WALLET_ADDRESS',
  'testnet',
  (transaction, network) => {
    console.log(`[${network.toUpperCase()}] Wallet transaction:`, transaction)
  }
)
testnetWalletSubscriber.start()

// MainNet monitoring  
const mainnetAssetSubscriber = setupAssetMonitor(
  31566704, // USDC on MainNet
  1000, // Minimum 1000 USDC
  'mainnet',
  (transfer, network) => {
    console.log(`[${network.toUpperCase()}] Large USDC transfer:`, transfer)
  }
)
mainnetAssetSubscriber.start()
*/
