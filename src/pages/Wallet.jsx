import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { Wallet as WalletIcon, Plus, ArrowUpRight, ArrowDownLeft, Trophy } from 'lucide-react';

const Wallet = () => {
  const { toast } = useToast();
  const { user, userProfile } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (error) {
          console.error('Error fetching transactions:', error);
        } else {
          setTransactions(data || []);
        }
      } catch (error) {
        console.error('Error fetching transactions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [user]);

  const handleAddMoney = () => {
    toast({
      title: "🚧 Payment Integration Coming Soon!",
      description: "Wallet top-up will be available once payment is integrated! 🚀",
    });
  };

  const handleWithdraw = () => {
    toast({
      title: "🚧 Withdrawal Feature Coming Soon!",
      description: "Money withdrawal will be available soon! 🚀",
    });
  };

  const walletBalance = userProfile?.wallet_balance || 0;

  return (
    <div className="container mx-auto px-4 py-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-3xl font-bold gradient-text mb-8 text-center">My Wallet</h1>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 mb-6 text-center shadow-lg"
        >
          <div className="flex justify-center mb-4">
            <div className="bg-gradient-to-r from-pink-500 to-violet-500 p-4 rounded-full">
              <WalletIcon size={32} className="text-white" />
            </div>
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Current Balance</h2>
          <div className="text-4xl font-bold gradient-text mb-6">₹{walletBalance}</div>
          
          <div className="flex space-x-4">
            <Button
              onClick={handleAddMoney}
              className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold py-3 rounded-lg"
            >
              <Plus size={20} className="mr-2" />
              Add Money
            </Button>
            <Button
              onClick={handleWithdraw}
              className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold py-3 rounded-lg"
            >
              <ArrowUpRight size={20} className="mr-2" />
              Withdraw
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 shadow-lg"
        >
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Recent Transactions</h3>
          
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800 mx-auto"></div>
              <p className="text-gray-700 mt-2">Loading transactions...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">💳</div>
              <p className="text-gray-700">No transactions yet</p>
              <p className="text-gray-500 text-sm mt-2">Start playing quizzes to see your transaction history!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction, index) => (
                <motion.div
                  key={transaction.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className="flex items-center justify-between p-3 bg-gray-50/80 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-full ${
                      ['reward','bonus','credit','referral','refund'].includes(transaction.type) ? 'bg-green-500/20' : 'bg-red-500/20'
                    }`}>
                      {['reward','bonus','credit','referral','refund'].includes(transaction.type) ? (
                        <Trophy size={16} className="text-green-500" />
                      ) : (
                        <ArrowDownLeft size={16} className="text-red-500" />
                      )}
                    </div>
                    <div>
                      <p className="text-gray-800 font-medium">
                        {transaction.type ? transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1) : 'Transaction'}
                      </p>
                      <p className="text-gray-600 text-sm">
                        {new Date(transaction.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className={`font-semibold ${
                    ['reward','bonus','credit','referral','refund'].includes(transaction.type) ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {['reward','bonus','credit','referral','refund'].includes(transaction.type) ? '+' : '-'}₹{Math.abs(Number(transaction.amount) || 0)}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Wallet;