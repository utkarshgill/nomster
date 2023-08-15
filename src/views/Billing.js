import React, { useState, useEffect } from 'react';
import { supabase } from '../App';
import { useNavigate, useParams, useLocation } from 'react-router-dom';

function Billing() {
    const [user, setUser] = useState(null);
    const [billAmount, setBillAmount] = useState('');
    const [finalBill, setFinalBill] = useState(0);
    const [discount, setDiscount] = useState(0);
    const [transactions, setTransactions] = useState([]);
    const navigate = useNavigate();

    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const userId = queryParams.get('userId');
    // Extract the user ID from URL parameters

    useEffect(() => {


        fetchUserData();
    }, [userId]);

    async function fetchUserData() {
        console.log(userId);
        try {
            const { data } = await supabase
                .from('users')
                .select('full_name, avatar_url, balance')
                .eq('user_id', userId) // Use the scanned user ID here
                .single();
            if (data) {
                setUser(data);

            }
        } catch (error) {
            console.error('Error fetching user data:', error);
        }
    }
    async function fetchTransactions() {
        if (user) {
            console.log('user is: ' + user);
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            if (data) {
                setTransactions(data);
            }
            if (error) {
                console.error('Error fetching transactions:', error);
            }
        }
    }
    useEffect(() => {


        fetchTransactions();
    }, [user]);

    useEffect(() => {
        // Calculate final bill amount based on user input and wallet balance
        if (user && billAmount !== '') {
            const walletBalance = parseFloat(user.balance);
            const calculatedFinalBill = Math.max(0, parseFloat(billAmount) - walletBalance);
            setFinalBill(calculatedFinalBill);

            // Calculate discount
            const calculatedDiscount = Math.min(parseFloat(billAmount), walletBalance);
            setDiscount(calculatedDiscount);
        } else {
            setFinalBill(0);
            setDiscount(0);
        }
    }, [billAmount, user]);

    const handleConfirm = async () => {
        if (user && billAmount !== '') {  // Add check to ensure non-empty input
            try {
                // Calculate the earned loyalty reward (20% of final bill)
                const loyaltyReward = finalBill * 0.2;

                // Update user balance, subtracting the redeemed amount and adding the loyalty reward
                const updatedBalance = parseFloat(user.balance) - discount + loyaltyReward;

                // Prepare transactions if discount or loyalty reward is non-zero
                const transactionsToUpsert = [];

                if (discount !== 0) {
                    const redeemTransaction = {
                        user_id: userId,
                        brand_id: '4e24e5ce-23ce-40d2-bf93-f12273e1b746',
                        type: 'REDEEM',
                        amount: -discount,
                        bill_value: billAmount
                    };
                    transactionsToUpsert.push(redeemTransaction);
                }

                if (loyaltyReward !== 0) {
                    const earnTransaction = {
                        user_id: userId,
                        brand_id: '4e24e5ce-23ce-40d2-bf93-f12273e1b746',
                        type: 'EARN',
                        amount: loyaltyReward,
                        bill_value: finalBill
                    };
                    transactionsToUpsert.push(earnTransaction);
                }

                // Only add transactions if there are non-zero amounts
                if (transactionsToUpsert.length > 0) {
                    // Insert REDEEM transaction
                    const { error: redeemError } = await supabase.from('transactions').upsert([transactionsToUpsert[0]]);

                    // Insert EARN transaction if REDEEM insertion was successful
                    if (!redeemError && transactionsToUpsert.length > 1) {
                        const { error: earnError } = await supabase.from('transactions').upsert([transactionsToUpsert[1]]);
                        if (earnError) {
                            console.error('Error inserting EARN transaction:', earnError);
                        }
                    }

                    // Clear input field after confirming the bill
                    setBillAmount('');
                }


                // Update user balance in the 'users' table
                await supabase
                    .from('users')
                    .upsert({ user_id: userId, balance: updatedBalance, is_activated: true });

                // Refresh transaction history and user balance
                fetchTransactions();
                fetchUserData();
            } catch (error) {
                console.error('Error confirming the bill:', error);
            }
        }
    };


    const formatDate = (dateString) => {
        const options = { day: 'numeric', month: 'short' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    };

    const renderTransactionAmount = (transaction) => {
        const formattedAmount = Math.abs(transaction.amount).toFixed(2);
        return (
            <span style={{ color: transaction.amount < 0 ? 'grey' : 'green', fontWeight: 'bold' }}>
                {transaction.amount < 0 ? `- ₹${formattedAmount}` : `+ ₹${formattedAmount}`}
            </span>
        );
    };

    return (
        <div className='styled-container'>

            {user && (

                <div className='billing-navbar'>
                    <button className='secondary-button' onClick={() => navigate('/admin')}>◀ Admin</button><div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div><h3>{user.full_name}</h3><p>Balance: ₹{user.balance.toFixed(2)}</p></div>
                        <img src={user.avatar_url} className='profile-pic' alt={user.full_name} />
                    </div> </div>



            )}

            <input className='bill-input'
                type="number"
                placeholder="Enter bill amount"
                value={billAmount}
                onChange={(e) => setBillAmount(e.target.value)}
            />
            {/* Disable confirm button for empty input */}

            {user && (

                <div className='wallet-balance'>
                    <p >Calculated Discount:</p> <p>₹{discount.toFixed(2)}</p> </div>
            )}
            <div className='wallet-balance'>
                <h1 >Final Bill:</h1> <h1>₹{finalBill.toFixed(2)}</h1> </div>

            <button className='scanner' onClick={handleConfirm} disabled={billAmount === ''}>
                Confirm
            </button>

            <ul className='list'>
                {transactions.map((transaction) => (
                    <li key={transaction.id} style={{ listStyleType: 'none' }}>
                        <div className='list-item'  >
                            <div className='wallet-balance'>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                    <p style={{ fontWeight: 'bold', fontSize: '24px', backgroundColor: '#eee', height: '32px', width: '32px', textAlign: 'center', borderRadius: '100px', padding: '2px' }}> {transaction.amount > 0 ? '₹' : '✓'}</p>
                                    <div><p>{transaction.amount < 0 ? 'Redeemed' : 'Earned'}</p> <p style={{ color: 'gray' }}>{formatDate(transaction.created_at)}</p>
                                    </div>
                                </div>
                                <p>{renderTransactionAmount(transaction)}</p></div>


                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default Billing;
