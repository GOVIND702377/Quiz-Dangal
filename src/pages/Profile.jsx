import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { User, Mail, Phone, Wallet, Edit, LogOut, Trophy, Calendar } from 'lucide-react';
import Spinner from '@/components/Spinner';

function Profile() {
  const { user, userProfile, loading, signOut } = useAuth();
  const { toast } = useToast();
  const [walletBalance, setWalletBalance] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  // Fetch wallet balance and recent transactions
  useEffect(() => {
    if (user) {
      fetchWalletData();
    }
  }, [user]);

  const fetchWalletData = async () => {
    setLoadingTransactions(true);
    try {
      // Fetch wallet balance from profiles table
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('wallet_balance')
        .eq('id', user.id)
        .single();

      if (profileData) {
        setWalletBalance(profileData.wallet_balance || 0);
      }

      // Fetch recent transactions
      const { data: transactions, error: transactionError } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (transactions) {
        setRecentTransactions(transactions);
      }
    } catch (error) {
      console.error('Error fetching wallet data:', error);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: "Signed out successfully",
        description: "You have been logged out.",
      });
    } catch (error) {
      toast({
        title: "Sign out failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spinner className="h-12 w-12 text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Profile Header */}
      <div className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 mb-6 shadow-lg">
        <div className="flex items-center space-x-4 mb-6">
          <div className="w-20 h-20 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
            <User className="w-10 h-10 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-800">
              {userProfile?.full_name || 'User Profile'}
            </h2>
            <p className="text-gray-600 flex items-center">
              <Mail className="w-4 h-4 mr-2" />
              {user?.email}
            </p>
            {userProfile?.phone_number && (
              <p className="text-gray-600 flex items-center">
                <Phone className="w-4 h-4 mr-2" />
                {userProfile.phone_number}
              </p>
            )}
          </div>
          <Button
            onClick={handleSignOut}
            variant="outline"
            className="flex items-center space-x-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link to="/profile-update">
            <Button className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700">
              <Edit className="w-4 h-4 mr-2" />
              Edit Profile
            </Button>
          </Link>
          <Link to="/my-quizzes">
            <Button variant="outline" className="w-full">
              <Trophy className="w-4 h-4 mr-2" />
              My Quizzes
            </Button>
          </Link>
        </div>
      </div>

      {/* Wallet Section */}
      <div className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 mb-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-gray-800 flex items-center">
            <Wallet className="w-5 h-5 mr-2" />
            Wallet Balance
          </h3>
          <Link to="/wallet">
            <Button variant="outline" size="sm">
              View Details
            </Button>
          </Link>
        </div>
        
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg p-4 text-white">
          <div className="text-2xl font-bold">₹{walletBalance.toFixed(2)}</div>
          <div className="text-sm opacity-90">Available Balance</div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 shadow-lg">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Recent Transactions</h3>
        
        {loadingTransactions ? (
          <div className="flex justify-center py-4">
            <Spinner className="h-6 w-6 text-indigo-500" />
          </div>
        ) : recentTransactions.length > 0 ? (
          <div className="space-y-3">
            {recentTransactions.map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${
                    transaction.transaction_type === 'credit' ? 'bg-green-500' : 'bg-red-500'
                  }`}></div>
                  <div>
                    <div className="font-medium text-gray-800">{transaction.description}</div>
                    <div className="text-sm text-gray-500 flex items-center">
                      <Calendar className="w-3 h-3 mr-1" />
                      {new Date(transaction.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className={`font-semibold ${
                  transaction.transaction_type === 'credit' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {transaction.transaction_type === 'credit' ? '+' : '-'}₹{transaction.amount}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Wallet className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No transactions yet</p>
            <p className="text-sm">Start participating in quizzes to see your transactions!</p>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      {userProfile?.role === 'admin' && (
        <div className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 mt-6 shadow-lg">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Admin Panel</h3>
          <Link to="/admin">
            <Button className="w-full bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700">
              Manage Quizzes & Users
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

export default Profile;
