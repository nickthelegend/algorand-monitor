

add a new tab New Account Monitor tab..

in that i want the user to enter the Address to check ask for the Custodian Wallet then Add the monitor...

Add this logic

fetch all the txns 

const response = await algorand.client.indexer
          .lookupAccountTransactions(monitor.address)
          .afterTime(monitorStartTime.toISOString())
          .do()


like this ...
 * const maxBalance = 100000;
     * const accountTxns = await indexerClient
     *        .lookupAccountTransactions(address)
     *        .currencyLessThan(maxBalance)
     *        .do();

you get the number of Accounts the addresss  has interacted with show them only




Use           .afterTime(monitorStartTime.toISOString())
and .beforeTime()

and find this 
Add time frame of Day,per week, month, and year




