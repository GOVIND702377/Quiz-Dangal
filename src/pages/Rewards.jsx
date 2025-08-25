import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Gift, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Rewards() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from('reward_catalog')
        .select('*')
        .eq('is_active', true);
      if (!mounted) return;
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
      setRewards(data || []);
      setLoading(false);
    }
    load();
    return () => { mounted = false; };
  }, [toast]);

  const handleRedeem = async (catalogId) => {
    if (!user) return;
    setRedeeming(catalogId);
    try {
      // Prefer RPC redeem_from_catalog(user_id, catalog_id)
      const { error } = await supabase.rpc('redeem_from_catalog', {
        p_user_id: user.id,
        p_catalog_id: catalogId,
      });
      if (error) throw error;
      toast({ title: 'Redemption requested', description: 'Your reward request is submitted.' });
      navigate('/redemptions');
    } catch (e) {
      toast({ title: 'Redeem failed', description: e.message, variant: 'destructive' });
    } finally {
      setRedeeming(null);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center">
            <Gift className="mr-2" /> Rewards Catalog
          </h1>
          <p className="text-gray-600 text-sm">Redeem your coins for rewards</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/redemptions')}>My Redemptions</Button>
      </div>

      <div className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-4 shadow-lg">
        {loading ? (
          <div className="py-12 flex items-center justify-center text-gray-600">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mr-2" /> Loading rewards...
          </div>
        ) : rewards.length === 0 ? (
          <div className="py-12 text-center text-gray-600">No rewards available</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rewards.map((r) => (
              <div key={r.id} className="p-4 rounded-xl bg-white/70 border border-gray-200/50 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-gray-800">{r.reward_type}: {r.reward_value}</div>
                  <div className="text-sm text-gray-500">Cost: {r.coins_required} coins</div>
                </div>
                <Button
                  onClick={() => handleRedeem(r.id)}
                  disabled={redeeming === r.id}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {redeeming === r.id ? 'Processing...' : 'Redeem'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
