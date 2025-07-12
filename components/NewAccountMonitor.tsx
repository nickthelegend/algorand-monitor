
import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy } from 'lucide-react';
import algosdk from 'algosdk';

const NewAccountMonitor = ({ network }: { network: 'mainnet' | 'testnet' }) => {
  const [address, setAddress] = useState('');
  const [timeFrame, setTimeFrame] = useState('day');
  const [interactedAccounts, setInteractedAccounts] = useState<string[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const indexerClient = useMemo(() => {
    if (network === 'mainnet') {
      return new algosdk.Indexer('', 'https://mainnet-idx.algonode.cloud', '');
    }
    return new algosdk.Indexer('', 'https://testnet-idx.algonode.cloud', '');
  }, [network]);

  const handleAddMonitor = useCallback(async () => {
    if (!address) {
      setError('Please enter an address.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setInteractedAccounts(null);

    try {
      const now = new Date();
      const monitorStartTime = new Date();

      switch (timeFrame) {
        case 'day':
          monitorStartTime.setDate(now.getDate() - 1);
          break;
        case 'week':
          monitorStartTime.setDate(now.getDate() - 7);
          break;
        case 'month':
          monitorStartTime.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          monitorStartTime.setFullYear(now.getFullYear() - 1);
          break;
        default:
          break;
      }

      const response = await indexerClient
        .lookupAccountTransactions(address)
        .txType('pay')
        .afterTime(monitorStartTime.toISOString())
        .do();
      console.log(response)
      const accounts = new Set<string>();
      response.transactions.forEach((tx: any) => {
        if (tx['paymentTransaction'] && tx['paymentTransaction'].receiver) {
            accounts.add(tx['paymentTransaction'].receiver);
        }
      });

      setInteractedAccounts(Array.from(accounts));
    } catch (e: any) {
      setError(`Error fetching transactions: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [address, timeFrame, indexerClient]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>New Account Monitor</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter address"
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="time-frame">Time Frame</Label>
          <Select value={timeFrame} onValueChange={setTimeFrame} disabled={isLoading}>
            <SelectTrigger id="time-frame">
              <SelectValue placeholder="Select time frame" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Day</SelectItem>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="year">Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleAddMonitor} disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Monitor Account'}
        </Button>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        {interactedAccounts && interactedAccounts.length > 0 && (
          <div className="pt-4">
            <p className="font-semibold">
              Found {interactedAccounts.length} unique account(s) that received payments from this address in the last {timeFrame}.
            </p>
            <h4 className="font-semibold mt-4">Receiver Addresses:</h4>
            <ul className="list-disc pl-5 mt-2 max-h-48 overflow-y-auto">
              {interactedAccounts.map((acc, index) => (
                <li key={index} className="font-mono text-sm flex items-center justify-between">{acc} <Button variant="ghost" size="icon" onClick={() => navigator.clipboard.writeText(acc)}><Copy className="h-4 w-4" /></Button></li>
              ))}
            </ul>
          </div>
        )}
        {interactedAccounts && interactedAccounts.length === 0 && (
            <div className="pt-4">
                <p>No payment transactions found for this address in the last {timeFrame}.</p>
            </div>
        )}
      </CardContent>
    </Card>
  );
};

export default NewAccountMonitor;

