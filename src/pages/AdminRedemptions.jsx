import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Check, XCircle, Loader2, ShieldCheck } from 'lucide-react';

async function tryApprove(id) {
  // Try different param names to be compatible with function signature
  const tries = [
    () => supabase.rpc('approve_redemption', { redemption_id: id }),
    () => supabase.rpc('approve_redemption', { p_redemption_id: id }),
    () => supabase.rpc('approve_redemption', { id }),
  ];
  let lastError = null;
  for (const t of tries) {
    const { error } = await t();
    if (!error) return { ok: true };
    lastError = error;
  }
  return { ok: false, error: lastError };
}

async function tryReject(id, reason) {
  const tries = [
    () => supabase.rpc('reject_redemption', { redemption_id: id, reason }),
    () => supabase.rpc('reject_redemption', { p_redemption_id: id, p_reason: reason }),
    () => supabase.rpc('reject_redemption', { id, reason }),
  ];
  let lastError = null;
  for (const t of tries) {
    const { error } = await t();
    if (!error) return { ok: true };
    lastError = error;
  }
  return { ok: false, error: lastError };
}

export default function AdminRedemptions() {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('v_pending_redemptions')
      .select('*');
    if (error) {
      toast({ title: 'Load failed', description: error.message, variant: 'destructive' });
      setRows([]);
    } else {
      setRows(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleApprove = async (id) => {
    setActingId(id);
    const res = await tryApprove(id);
    if (!res.ok) {
      toast({ title: 'Approve failed', description: res.error?.message || 'RPC error', variant: 'destructive' });
    } else {
      toast({ title: 'Approved', description: 'Redemption approved' });
      await load();
    }
    setActingId(null);
  };

  const handleReject = async (id) => {
    const reason = window.prompt('Enter rejection reason (optional):', '');
    if (reason === null) return; // cancelled
    setActingId(id);
    const res = await tryReject(id, reason || '');
    if (!res.ok) {
      toast({ title: 'Reject failed', description: res.error?.message || 'RPC error', variant: 'destructive' });
    } else {
      toast({ title: 'Rejected', description: 'Redemption rejected' });
      await load();
    }
    setActingId(null);
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center">
            <ShieldCheck className="mr-2" /> Admin: Pending Redemptions
          </h1>
          <p className="text-gray-600 text-sm">Approve or reject pending requests</p>
        </div>
        <Button variant="outline" onClick={load}>Refresh</Button>
      </div>

      <div className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-4 shadow-lg">
        {loading ? (
          <div className="py-12 flex items-center justify-center text-gray-600">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mr-2" /> Loading...
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-gray-600">No pending redemptions</div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="p-3 rounded-xl bg-white/70 border border-gray-200/50 flex items-center justify-between text-sm">
                <div>
                  <div className="font-semibold text-gray-800">{r.full_name}</div>
                  <div className="text-gray-600">{r.reward_type}: {r.reward_value}</div>
                  <div className="text-gray-500">Coins: {r.coins_required} • Requested: {new Date(r.requested_at).toLocaleString()}</div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    onClick={() => handleApprove(r.id)}
                    disabled={actingId === r.id}
                    className="bg-green-600 hover:bg-green-700"
                    size="sm"
                  >
                    <Check className="w-4 h-4 mr-1" /> Approve
                  </Button>
                  <Button
                    onClick={() => handleReject(r.id)}
                    disabled={actingId === r.id}
                    variant="outline"
                    className="text-red-600 border-red-300 hover:bg-red-50"
                    size="sm"
                  >
                    <XCircle className="w-4 h-4 mr-1" /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
